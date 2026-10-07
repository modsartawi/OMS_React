// Document source users drive (ticket 438, spec 430 D2/D7/D8/D14/D15/D16/D18/D20).
//
// Drives the REAL app in Chromium against a STUB of the spec 430 wire contract — the doors
// (`GET SdDocumentWeb/DocumentSourceUsers` and `POST …/Import`, BackOffice asks BO-6/BO-7) are NOT
// built, so there is no live SIS.Api to point at. Never point this at a live SIS.Api.
// Stubbed, exactly as D2/D7/D8 propose:
//   GET  SdDocumentWeb/Access                     → { canOpenList, canOpenDetail, canOpenDocumentSourceUsers?, canImportDocumentSourceUsers? }
//   GET  SdDocumentWeb/DocumentSourceUsers        → SdDocumentSourceUserModel[]
//   POST SdDocumentWeb/DocumentSourceUsers/Import { lines: [{ userId, documentSource, isDeleted }] }
//                                                 → { applied, unchanged, skipped: [{ line, key, reason }] }
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"), it asserts:
//   1. without the flag (an older server that omits it) the leaf is hidden and the URL shows the
//      denied card, with no list call; the import flag alone does not show it;
//   2. with it, the leaf is LAST in the OMS group (D18), after Cities & districts; the group and the
//      page gate cost ONE probe call; the list loads on open, once;
//   3. the columns: user ID, document source, updated by, updated at (an unset time blank), every
//      value isolated; no row edit (D20);
//   4. the text filter narrows by user or source; the status bar says how many are shown; a filter
//      matching nothing says so;
//   5. the export writes the rows as shown, IDs as text, no isolates;
//   6. no Import without canImportDocumentSourceUsers;
//   7. with it: a pasted file with a header, a short line and an X previews every line, flags the
//      short line and keeps Send off; fixed, Send posts { lines } with isDeleted (never isDelete);
//      the result counts applied/unchanged/skipped and words UNKNOWN_STAFF and UNKNOWN_SOURCE,
//      an unknown reason shown as its code; the list reloads; a failed send says it may not have
//      applied and reloads;
//   8. a refused list load is shown with its own message;
//   9. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/document-source-users-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.document-source-users-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message }] : [],
    data,
  }),
})

const UNSET = '0001-01-01T00:00:00'

/** An `SdDocumentSourceUserModel` exactly as WPF's class has it, in camelCase. */
const user = (userId, documentSource, updatedAt, updatedBy) => ({
  userId,
  documentSource,
  updatedAt,
  updatedBy,
})

const USERS = [
  user('10234', 'WEB', '2026-09-01T10:30:00', 'oms.admin'),
  user('10871', 'APP', '2026-08-15T14:05:00', 'hq.lead'),
  user('00042', 'CALLCENTER', UNSET, null),
]

const browser = await chromium.launch()

async function open(dir, { grant, importGrant = false, importAnswer = () => null, list = () => 'rows' }) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const importBodies = []
  let listCalls = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    // A stubbed 4xx/5xx is the drive's own doing.
    (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()),
  )
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'msartawi',
          currentStoreCode: 'P001',
        }),
      )
    if (p === 'SdDocumentWeb/Access') {
      const flags = {
        canOpenList: true,
        canOpenDetail: true,
        canOpenGeography: true,
      }
      if (grant) flags.canOpenDocumentSourceUsers = true
      if (importGrant) flags.canImportDocumentSourceUsers = true
      return route.fulfill(envelope(flags))
    }
    if (p === 'SdDocumentWeb/DocumentSourceUsers/Import') {
      const body = route.request().postDataJSON()
      importBodies.push({ method: route.request().method(), body })
      const answer = importAnswer(body)
      if (answer === 'down')
        return route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'boom',
        })
      return route.fulfill(envelope(answer))
    }
    if (p === 'SdDocumentWeb/DocumentSourceUsers') {
      listCalls++
      if (list(listCalls) === 'refused')
        return route.fulfill(
          envelope(null, {
            status: 403,
            success: false,
            message: 'You do not hold DocumentSourceUsersInquiry (03).',
            errorCode: 'FORBIDDEN',
          }),
        )
      return route.fulfill(envelope(USERS))
    }
    if (p === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
    if (/Access$/.test(p))
      return route.fulfill(
        envelope({
          canOpen: false,
          screenAllowed: false,
          allowed: false,
          canAdmin: false,
          canSupport: false,
        }),
      )
    return route.fulfill(envelope([]))
  })
  return {
    context,
    page,
    errors,
    calls,
    importBodies,
    listCount: () => listCalls,
  }
}

const omsLinks = (page) => page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

const waitRows = async (page, n) => {
  await page.waitForFunction((count) => document.querySelectorAll('[data-dsu-list] .ag-row').length === count, n, { timeout: 20000 })
  await page.waitForTimeout(150)
}

const drawn = (page, colId) =>
  page.evaluate(
    (id) =>
      [...document.querySelectorAll('[data-dsu-list] .ag-row')]
        .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
        .map((r) => r.querySelector(`[col-id="${id}"]`)?.textContent ?? ''),
    colId,
  )

const rowOf = (page, userId) =>
  page.evaluate((no) => {
    const row = [...document.querySelectorAll('[data-dsu-list] .ag-row')].find((r) => r.querySelector('[col-id="userId"]')?.textContent === no)
    if (!row) return null
    const out = {}
    let isolated = true
    for (const cell of row.querySelectorAll('[col-id]')) {
      out[cell.getAttribute('col-id')] = cell.textContent ?? ''
      if (cell.textContent && !cell.querySelector('bdi')) isolated = false
    }
    out.isolated = isolated
    return out
  }, userId)

const statusOf = (page) => page.locator('[data-status-count]').innerText()

const previewRows = (page, n) =>
  page.waitForFunction((count) => document.querySelectorAll('[data-import-preview] .ag-row').length === count, n, { timeout: 10000 })

const previewLines = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-import-preview] .ag-row')]
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((r) => {
        const out = {}
        for (const cell of r.querySelectorAll('[col-id]')) out[cell.getAttribute('col-id')] = cell.textContent ?? ''
        return out
      }),
  )

const resultCounts = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-import-count]')]
      .map((e) => `${e.getAttribute('data-import-count')}=${e.querySelector('dd')?.textContent}`)
      .join(','),
  )

const skippedLines = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-import-skipped] tbody tr')].map((tr) => {
      const [line, key, reason] = [...tr.querySelectorAll('td')]
      return {
        line: line.textContent,
        key: key.textContent,
        reason: reason.textContent,
        isolated: !!line.querySelector('bdi[dir="ltr"]') && !!key.querySelector('bdi[dir="ltr"]'),
      }
    }),
  )

async function drive(dir) {
  const label = dir
  // `lng` stays `en` (`@/core/i18n`): RTL flips the direction, the words stay English.
  const S = {
    denied: 'No access to document source users',
    count3: '3 users',
    filtered: '1 / 3 users shown',
    noneMatch: 'Nothing matches this filter',
    sheetHeader: 'User ID|Document source|Updated by|Updated at',
    format: /user ID, document source/,
    blocked: '1 line has the wrong number of columns',
    send3: 'Send 3 lines',
    unknownStaff: 'Unknown staff ID',
    unknownSource: 'Unknown document source',
    mayNot: 'The import may not have been applied',
    failedTitle: 'The document source users could not be loaded',
    line3: 'This line has 1 column; it needs 2, or 3 ending in X.',
    upsert: 'Add or update',
    del: 'Delete',
    error: 'Cannot be read',
  }

  // ── 1: no flag → hidden leaf, denied card, no list call ────────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir, {
      grant: false,
      importGrant: true,
    })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/geography"]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    const links = await omsLinks(page)
    check(`${label}: without the flag (the import flag alone) the leaf is hidden`, !links.includes('/oms/document-source-users'), links.join(' · '))
    await page.goto(`${BASE}/oms/document-source-users`)
    const card = page.locator('[role="alert"]', { hasText: S.denied })
    await card.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: the URL shows the denied card and never asks for the list`,
      (await card.count()) === 1 && !calls.some((c) => c.startsWith('SdDocumentWeb/DocumentSourceUsers')),
    )
    check(`${label}: no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–6: granted, no import grant ──────────────────────────────────────────────────────────
  {
    const { context, page, errors, calls, listCount } = await open(dir, {
      grant: true,
    })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/document-source-users"]').first().waitFor({ timeout: 20000 })
    const links = await omsLinks(page)
    check(
      `${label}: the leaf is last in the OMS group, after Cities & districts (D18)`,
      links.at(-1) === '/oms/document-source-users' && links.indexOf('/oms/document-source-users') === links.indexOf('/oms/geography') + 1,
      links.join(' · '),
    )
    check(`${label}: the list is not read before the screen opens`, listCount() === 0)
    await page.locator('nav a[href="/oms/document-source-users"]').first().click()
    await waitRows(page, 3)
    check(`${label}: the list loads on open, once`, listCount() === 1, String(listCount()))
    check(
      `${label}: the OMS group and the page gate cost ONE probe call`,
      calls.filter((c) => c === 'SdDocumentWeb/Access').length === 1,
      String(calls.filter((c) => c === 'SdDocumentWeb/Access').length),
    )
    check(`${label}: dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${label}: without canImportDocumentSourceUsers there is no Import`, (await page.locator('[data-dsu-import]').count()) === 0)

    // 3: columns
    const headers = await page.locator('[data-dsu-list] .ag-header-cell').evaluateAll((els) => els.map((e) => e.getAttribute('col-id')))
    check(
      `${label}: the columns are user ID, document source, updated by, updated at`,
      headers.join(',') === 'userId,documentSource,updatedBy,updatedAt',
      headers.join(','),
    )
    const a = await rowOf(page, '10234')
    const c = await rowOf(page, '00042')
    check(
      `${label}: a pin shows its user, source and last change, every value isolated`,
      a?.documentSource === 'WEB' && a.updatedBy === 'oms.admin' && a.updatedAt === '2026-09-01 10:30' && a.isolated,
      JSON.stringify(a),
    )
    check(
      `${label}: an unset time and a missing updater are blank; a leading-zero ID reads whole`,
      c?.updatedAt === '' && c.updatedBy === '' && c.userId === '00042',
      JSON.stringify(c),
    )
    check(`${label}: the status bar counts them`, (await statusOf(page)).trim() === S.count3, await statusOf(page))
    // D20: no single-row edit — a double click opens nothing and no cell is editable.
    await page.locator('[data-dsu-list] .ag-row [col-id="documentSource"]').first().dblclick()
    await page.waitForTimeout(200)
    check(
      `${label}: there is no single-row edit (D20)`,
      (await page.locator('[data-dsu-list] .ag-cell-inline-editing, [data-dsu-list] .ag-row input').count()) === 0 &&
        (await page.locator('dialog[open]').count()) === 0,
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-list.png` })

    // 4: filter
    const filter = page.locator('[data-dsu-filter]')
    await filter.fill('callcenter')
    await waitRows(page, 1)
    check(`${label}: the filter matches a source, any case`, (await drawn(page, 'userId')).join(',') === '00042')
    check(`${label}: the status bar says how many are shown`, (await statusOf(page)).includes(S.filtered), await statusOf(page))
    await filter.fill('10871')
    await waitRows(page, 1)
    check(`${label}: the filter matches a user ID`, (await drawn(page, 'documentSource')).join(',') === 'APP')
    await filter.fill('nobody')
    await waitRows(page, 0)
    await page.locator('[data-dsu-empty]').waitFor({ timeout: 5000 })
    check(
      `${label}: a filter matching nothing says so, and Export is off`,
      (await page.locator('[data-dsu-empty]').innerText()).includes(S.noneMatch) && (await page.locator('[data-dsu-export]').isDisabled()),
    )
    await filter.fill('web')
    await waitRows(page, 1)

    // 5: export
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-dsu-export]').click()])
    const name = dl.suggestedFilename()
    const sheet = sheetText(unzipText(readFileSync(await dl.path())))
    const lines = sheet.split('\n')
    check(`${label}: the export is its own xlsx`, /^document-source-users-\d{8}-\d{4}\.xlsx$/.test(name), name)
    check(
      `${label}: the sheet holds the header and the filtered rows as drawn, IDs as text, no isolates`,
      lines[0] === S.sheetHeader && lines.length === 2 && lines[1] === '10234|WEB|oms.admin|2026-09-01 10:30' && !/[\u2066-\u2069]/.test(sheet),
      lines.join(' ¶ '),
    )
    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: import ──────────────────────────────────────────────────────────────────────────────
  {
    const ANSWER = {
      applied: 1,
      unchanged: 0,
      skipped: [
        { line: 3, key: '99999', reason: 'UNKNOWN_STAFF' },
        { line: 1, key: 'UserId', reason: 'UNKNOWN_STAFF' },
        { line: 2, key: '10234', reason: 'UNKNOWN_SOURCE' },
      ],
    }
    let down = false
    const { context, page, errors, importBodies, listCount } = await open(dir, {
      grant: true,
      importGrant: true,
      importAnswer: (body) =>
        down
          ? 'down'
          : body.lines.length === 1
            ? {
                applied: 0,
                unchanged: 0,
                skipped: [{ line: 1, key: '10234', reason: 'STAFF_INACTIVE' }],
              }
            : ANSWER,
    })
    await page.goto(`${BASE}/oms/document-source-users`)
    await waitRows(page, 3)
    const importButton = page.locator('[data-dsu-import]')
    check(`${label}: with canImportDocumentSourceUsers Import is offered`, (await importButton.count()) === 1)
    await importButton.click()
    const dialog = page.locator('[data-import-dialog="document-source-users"]')
    await dialog.waitFor({ timeout: 10000 })
    check(`${label}: the dialog names WPF's columns and the X`, S.format.test(await dialog.locator('[data-import-format]').innerText()))
    const send = page.locator('[data-import-send]')
    check(`${label}: Send is off before any line`, await send.isDisabled())
    const text = dialog.locator('[data-import-text]')
    await text.fill('UserId\tDocumentSource\r\n10234\tWEB2\tX\r\n99999\r\n')
    await previewRows(page, 3)
    const pl = await previewLines(page)
    check(
      `${label}: the preview shows every line under the grid's labels, the header as a line, a delete by its X`,
      pl.map((l) => `${l.line}:${l.userId}:${l.action}`).join(',') === `1:UserId:${S.upsert},2:10234:${S.del},3:99999:${S.error}`,
      pl.map((l) => `${l.line}:${l.userId}:${l.action}`).join(','),
    )
    const pHeaders = await dialog.locator('[data-import-preview] .ag-header-cell').evaluateAll((els) => els.map((e) => e.textContent?.trim()))
    check(
      `${label}: the preview's file columns read like the grid's`,
      pHeaders.slice(2, 4).join('|') === S.sheetHeader.split('|').slice(0, 2).join('|'),
      pHeaders.join('|'),
    )
    check(`${label}: the short line says why`, pl[2]?.problem.startsWith(S.line3), pl[2]?.problem)
    check(
      `${label}: an error line blocks Send and says so`,
      (await send.isDisabled()) && (await dialog.locator('[data-import-blocked]').innerText()).includes(S.blocked),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-import-blocked.png` })
    await text.fill('UserId\tDocumentSource\n10234\tWEB2\tX\n99999\tAPP')
    await page.waitForFunction(() => !document.querySelector('[data-import-blocked]'), null, { timeout: 5000 })
    check(
      `${label}: fixed, Send is offered for every line`,
      !(await send.isDisabled()) && (await send.innerText()).trim() === S.send3,
      await send.innerText(),
    )
    const before = listCount()
    await send.click()
    await dialog.locator('[data-import-result]').waitFor({ timeout: 10000 })
    const sent = importBodies.at(-1)
    check(
      `${label}: Send posts { lines } with isDeleted (never isDelete), in file order`,
      sent?.method === 'POST' &&
        JSON.stringify(sent.body) ===
          JSON.stringify({
            lines: [
              {
                userId: 'UserId',
                documentSource: 'DocumentSource',
                isDeleted: false,
              },
              { userId: '10234', documentSource: 'WEB2', isDeleted: true },
              { userId: '99999', documentSource: 'APP', isDeleted: false },
            ],
          }),
      JSON.stringify(sent?.body),
    )
    const counts = await resultCounts(page)
    check(`${label}: the result says applied, unchanged and skipped`, counts === 'applied=1,unchanged=0,skipped=3', counts)
    const sk = await skippedLines(page)
    check(
      `${label}: the skipped lines in file order, UNKNOWN_STAFF and UNKNOWN_SOURCE worded, line and key isolated`,
      sk.map((s) => `${s.line}:${s.key}:${s.reason}`).join(',') ===
        `1:UserId:${S.unknownStaff},2:10234:${S.unknownSource},3:99999:${S.unknownStaff}` && sk.every((s) => s.isolated),
      JSON.stringify(sk),
    )
    await page.waitForTimeout(500)
    check(`${label}: the list reloads after the import`, listCount() === before + 1, `${before} → ${listCount()}`)
    await page.screenshot({ path: `${SHOTS}/${dir}-import-result.png` })

    // An unknown reason is shown as its code.
    await page.locator('[data-import-again]').click()
    await text.fill('10234\tWEB')
    await previewRows(page, 1)
    await send.click()
    await dialog.locator('[data-import-result]').waitFor({ timeout: 10000 })
    const sk2 = await skippedLines(page)
    check(`${label}: an unknown reason is shown as its own code`, sk2.length === 1 && sk2[0].reason === 'STAFF_INACTIVE', JSON.stringify(sk2))

    // A failed send: said, the preview kept, the list read again.
    await page.locator('[data-import-again]').click()
    await text.fill('10234\tWEB')
    await previewRows(page, 1)
    down = true
    const beforeDown = listCount()
    await send.click()
    const banner = dialog.locator('[role="alert"]', { hasText: S.mayNot })
    await banner.waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
    check(
      `${label}: a failed send says it may not have applied, keeps the preview, and reloads`,
      (await dialog.locator('[data-import-result]').count()) === 0 && !(await send.isDisabled()) && listCount() === beforeDown + 1,
      `${beforeDown} → ${listCount()}`,
    )
    check(`${label}: no page errors (import)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: a refused load ──────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, {
      grant: true,
      list: () => 'refused',
    })
    await page.goto(`${BASE}/oms/document-source-users`)
    const banner = page.locator('[role="alert"]', {
      hasText: 'You do not hold DocumentSourceUsersInquiry (03).',
    })
    await banner.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: a refused load is shown with its own message, and no count contradicts it`,
      (await banner.innerText()).includes(S.failedTitle) && (await page.locator('[data-status-count]').count()) === 0,
      await banner.innerText(),
    )
    check(`${label}: no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

/** The entries of a zip, name → text (stored or deflated). Enough of a reader for the writer's own output. */
function unzipText(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  const entries = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const out = {}
  for (let i = 0; i < entries; i++) {
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataAt, dataAt + size)
    out[name] = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8')
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** Sheet 1's text with shared strings resolved, cells joined by | and rows by newline; numbers marked `n:`. */
function sheetText(files) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
  const xml = files['xl/worksheets/sheet1.xml'] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)]
    .map((r) =>
      [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
        .map(([, attrs, body]) => {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? body.replace(/<[^>]+>/g, '')
          if (/t="s"/.test(attrs)) return shared[Number(v)]
          return (/t="n"|^(?![\s\S]*t=)/.test(attrs) && v !== '' ? 'n:' : '') + v
        })
        .join('|'),
    )
    .join('\n')
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
