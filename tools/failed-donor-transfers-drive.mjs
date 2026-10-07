// Failed donor transfers drive (ticket 434, spec 430 D2/D5/D12/D18).
//
// Drives the REAL app in Chromium against a STUB of the spec 430 wire contract — the door
// (`GET SdDocumentWeb/FailedDonorTransfers`, BackOffice ask BO-4) is NOT built, so there is no live
// SIS.Api to point at. 🚩 Never point this at a live SIS.Api: 435's re-run posts stock in DRS.
// Stubbed, exactly as D2/D5 propose:
//   GET SdDocumentWeb/Access               → { canOpenList, canOpenDetail, canOpenFailedTransfers?, canReRunFailedTransfer? }
//   GET SdDocumentWeb/FailedDonorTransfers → FailedDonorTransferRow[]
//   GET SdDocumentWeb/DonorRequests        → { rows, limited } (only to see the `?request=` seed arrive)
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"), it asserts:
//   1. without the flag (an older server that omits it) the leaf is hidden and the URL shows the
//      denied card, with no queue call;
//   2. with it, the leaf sits between Donor requests and Document payments, the group costs ONE
//      probe call, and the queue loads on open;
//   3. each line says what it asks — re-run, retrying on its own, reverse STO … in DRS — with the
//      job label, a raw unknown status, blank unset times, and the STO and DRS's error isolated;
//   4. no Re-run is drawn yet (435), even for a grant holder;
//   5. the filters narrow the loaded lines: stores trimmed and case-insensitive, the last-attempt
//      range, a line with no attempt never hidden by it; the status bar says how many are shown;
//   6. Reload reads the queue again, and a failed reload keeps the last good list under a banner;
//   7. the request opens Donor requests seeded on it (`?request=<no>` → `requestNo`), the delivery
//      opens Document Details;
//   8. a refused first load shows its own message and no "the queue is clear"; no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/failed-donor-transfers-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.failed-donor-transfers-shots'
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

/** A `FailedDonorTransferRow` exactly as 2371's class has it, in camelCase. */
const line = (requestNo, over) => ({
  requestNo,
  deliveryNo: '8000000501',
  donorStore: 'P019',
  orderStore: 'P001',
  requestState: 'FULFILLED',
  transferStoNo: '',
  outboxId: 'OB-' + requestNo.slice(-3),
  outboxStatus: 'F',
  attemptCount: 5,
  lastAttemptTime: '2026-10-05T09:41:00',
  retryDeadline: '2026-10-08T09:00:00',
  errorMessage: 'DRS: material 100234 is blocked for posting',
  reverseByHand: false,
  ...over,
})

function rows(rtl) {
  return [
    // A: failed, re-runnable.
    line('DR-1001'),
    // B: still retrying, another pair of stores, attempted a day later.
    line('DR-1002', {
      deliveryNo: '8000000502',
      donorStore: 'P020',
      orderStore: 'P002',
      outboxStatus: 'P',
      attemptCount: 2,
      lastAttemptTime: '2026-10-06T14:05:00',
      errorMessage: rtl ? 'انتهت مهلة الاتصال بـ DRS' : 'Timeout talking to DRS',
    }),
    // C: a cancelled request whose transfer posted, no job left — reverse by hand, unset times.
    line('DR-1003', {
      deliveryNo: '8000000503',
      requestState: 'CANCELLED',
      transferStoNo: '4500012345',
      outboxId: '',
      outboxStatus: '',
      attemptCount: 0,
      lastAttemptTime: UNSET,
      retryDeadline: UNSET,
      errorMessage: '',
      reverseByHand: true,
    }),
    // D: a status this side does not know — shown raw.
    line('DR-1004', { deliveryNo: '8000000504', donorStore: 'P019', orderStore: 'P003', outboxStatus: 'X', lastAttemptTime: '2026-10-07T08:00:00' }),
  ]
}

const browser = await chromium.launch()

async function open(dir, { grant, reRun = false, queue = () => 'rows' }) {
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1800, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const donorQueries = []
  let queueCalls = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') {
      const flags = { canOpenList: true, canOpenDetail: true, canOpenDonorRequests: true, canOpenDocumentPayments: true }
      if (grant) flags.canOpenFailedTransfers = true
      if (reRun) flags.canReRunFailedTransfer = true
      return route.fulfill(envelope(flags))
    }
    if (p === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'SdDocumentWeb/FailedDonorTransfers') {
      queueCalls++
      const mode = queue(queueCalls)
      if (mode === 'refused')
        return route.fulfill(
          envelope(null, { status: 403, success: false, message: 'You do not hold FailedDonorTransfers (03).', errorCode: 'FORBIDDEN' }),
        )
      if (mode === 'down') return route.fulfill({ status: 500, contentType: 'text/plain', body: 'boom' })
      return route.fulfill(envelope(rows(rtl)))
    }
    if (p === 'SdDocumentWeb/DonorRequests') {
      donorQueries.push(url.searchParams)
      return route.fulfill(envelope({ rows: [], limited: false }))
    }
    // Document Details' own reads: not this drive's to draw — only that it was asked for.
    if (/^SdDocumentWeb\/(?:Delivery|Document)\/\d+/.test(p)) return route.fulfill(envelope(null))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, donorQueries, queueCount: () => queueCalls }
}

const omsLinks = (page) =>
  page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

const waitRows = async (page, n) => {
  await page.waitForFunction((count) => document.querySelectorAll('[data-line-list] .ag-row').length === count, n, {
    timeout: 20000,
  })
  await page.waitForTimeout(150)
}

/** The request numbers of the lines drawn, in order. */
const drawn = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-line-list] .ag-row')]
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((r) => r.querySelector('[col-id="requestNo"]')?.textContent ?? ''),
  )

/** One line's cells, by column id, as drawn. */
const lineOf = (page, requestNo) =>
  page.evaluate((no) => {
    const rows = [...document.querySelectorAll('[data-line-list] .ag-row')]
    const row = rows.find((r) => r.querySelector('[col-id="requestNo"]')?.textContent === no)
    if (!row) return null
    const cell = (id) => row.querySelector(`[col-id="${id}"]`)
    const text = (id) => cell(id)?.textContent ?? ''
    return {
      action: text('action'),
      actionKind: cell('action')?.querySelector('[data-line-action]')?.getAttribute('data-line-action') ?? '',
      stoIsolated: !!cell('action')?.querySelector('bdi[dir="ltr"]'),
      job: text('job'),
      state: text('requestState'),
      attempts: text('attemptCount'),
      lastAttempt: text('lastAttempt'),
      deadline: text('deadline'),
      sto: text('transferStoNo'),
      reverse: text('reverseByHand'),
      error: text('errorMessage'),
      errorIsolated: !!cell('errorMessage')?.querySelector('bdi[data-line-error]'),
      linksIsolated: ['requestNo', 'deliveryNo'].every((id) => !!cell(id)?.querySelector('button[data-line-open] bdi[dir="ltr"]')),
      cellsIsolated: ['donorStore', 'orderStore', 'attemptCount'].every((id) => !!cell(id)?.querySelector('bdi')),
    }
  }, requestNo)

const statusText = (page) => page.locator('[data-status-count]').innerText()

async function drive(dir) {
  const label = dir

  // ── 1: no flag → hidden leaf, denied card, no queue call ────────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir, { grant: false })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/donor-requests"]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    const links = await omsLinks(page)
    check(`${label}: without the flag the Failed donor transfers leaf is hidden`, !links.includes('/oms/failed-donor-transfers'), links.join(' · '))
    await page.goto(`${BASE}/oms/failed-donor-transfers`)
    const card = page.locator('[role="alert"]', { hasText: 'No access to failed donor transfers' })
    await card.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: the URL shows the denied card and never asks for the queue`,
      (await card.count()) === 1 && !calls.includes('SdDocumentWeb/FailedDonorTransfers'),
    )
    check(`${label}: no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–7: granted (and holding the re-run grant: still no Re-run drawn until 435) ────────────
  {
    const { context, page, errors, calls, donorQueries, queueCount } = await open(dir, {
      grant: true,
      reRun: true,
      // The third read (the second Reload) fails: the last good list must stay.
      queue: (n) => (n === 3 ? 'down' : 'rows'),
    })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/failed-donor-transfers"]').first().waitFor({ timeout: 20000 })
    const links = await omsLinks(page)
    const at = links.indexOf('/oms/failed-donor-transfers')
    check(
      `${label}: the leaf sits between Donor requests and Document payments (D18)`,
      at === links.indexOf('/oms/donor-requests') + 1 && links.indexOf('/oms/document-payments') === at + 1,
      links.join(' · '),
    )
    check(`${label}: the queue is not read before the screen opens`, queueCount() === 0)
    await page.locator('nav a[href="/oms/failed-donor-transfers"]').first().click()
    await waitRows(page, 4)
    check(`${label}: the queue loads on open, once`, queueCount() === 1, String(queueCount()))
    check(
      `${label}: the OMS group and the page gate cost ONE probe call`,
      calls.filter((c) => c === 'SdDocumentWeb/Access').length === 1,
      String(calls.filter((c) => c === 'SdDocumentWeb/Access').length),
    )
    check(`${label}: dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

    // 3: what each line asks
    const a = await lineOf(page, 'DR-1001')
    const b = await lineOf(page, 'DR-1002')
    const c = await lineOf(page, 'DR-1003')
    const d = await lineOf(page, 'DR-1004')
    check(`${label}: a failed line asks for a re-run once the cause is fixed`, a?.action === 'Re-run once the cause is fixed' && a.job === 'Failed', JSON.stringify(a))
    check(`${label}: a retrying line is retrying on its own`, b?.action === 'Retrying on its own' && b.job === 'Retrying', JSON.stringify(b))
    check(
      `${label}: a reverse-by-hand line names its STO to reverse in DRS, isolated`,
      c?.action === 'Reverse STO 4500012345 in DRS' && c.actionKind === 'reverse' && c.stoIsolated && c.reverse === 'Yes' && c.sto === '4500012345',
      JSON.stringify(c),
    )
    check(`${label}: an unknown job status is shown as sent`, d?.job === 'X' && d.action === 'Retrying on its own', JSON.stringify(d))
    check(
      `${label}: times are day and time; an unset (0001-…) time is blank`,
      a?.lastAttempt === '2026-10-05 09:41' && a.deadline === '2026-10-08 09:00' && c?.lastAttempt === '' && c.deadline === '',
      `${a?.lastAttempt} / ${a?.deadline} / "${c?.lastAttempt}"`,
    )
    check(`${label}: the request state is worded`, a?.state === 'Fulfilled' && c?.state === 'Cancelled', `${a?.state} ${c?.state}`)
    check(
      `${label}: DRS's error is free text in <bdi>; links, stores and counts are isolated`,
      [a, b].every((l) => l?.errorIsolated && l.linksIsolated && l.cellsIsolated) && (rtlError(dir, b?.error)),
      b?.error,
    )
    check(
      `${label}: no Re-run is drawn yet (435), even for a grant holder`,
      (await page.locator('[data-line-list] button', { hasText: /^Re-run$/ }).count()) === 0 &&
        (await page.locator('[data-line-rerun]').count()) === 0,
    )
    check(`${label}: the status bar counts the lines`, /^4 lines$/.test((await statusText(page)).trim()), await statusText(page))
    await page.screenshot({ path: `${SHOTS}/${dir}-queue.png` })

    // 5: filters on the loaded lines
    await page.locator('[data-line-filter="donorStore"]').fill(' p019 ')
    await waitRows(page, 3)
    check(`${label}: the donor store matches trimmed and case-insensitive`, (await drawn(page)).sort().join(',') === 'DR-1001,DR-1003,DR-1004', (await drawn(page)).join(','))
    await page.locator('[data-line-filter="orderStore"]').fill('P003')
    await waitRows(page, 1)
    check(`${label}: the order store narrows it further`, (await drawn(page)).join(',') === 'DR-1004')
    const filteredText = (await statusText(page)).trim()
    check(`${label}: the status bar says how many of the loaded lines are shown`, /^1 \/ 4 lines? shown$/.test(filteredText), filteredText)
    check(`${label}: filtering never reads the queue again`, queueCount() === 1)
    await page.locator('[data-line-clear]').click()
    await waitRows(page, 4)
    await page.locator('[data-line-filter="from"]').fill('2026-10-06')
    await page.locator('[data-line-filter="to"]').fill('2026-10-06')
    await waitRows(page, 2)
    check(
      `${label}: the last-attempt range keeps its own day, and the line with no attempt is never hidden`,
      (await drawn(page)).sort().join(',') === 'DR-1002,DR-1003',
      (await drawn(page)).join(','),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-filtered.png` })
    await page.locator('[data-line-filter="from"]').fill('2026-10-09')
    await page.locator('[data-line-filter="to"]').fill('2026-10-09')
    await waitRows(page, 1)
    check(`${label}: a range with no attempts in it still keeps the reverse-by-hand line`, (await drawn(page)).join(',') === 'DR-1003')
    await page.locator('[data-line-filter="to"]').fill('2026-10-01')
    await page.locator('[data-line-problem="reversed"]').waitFor({ timeout: 5000 })
    check(`${label}: a range that ends before it starts is said so`, (await page.locator('[data-line-problem="reversed"]').count()) === 1)
    await page.locator('[data-line-clear]').click()
    await waitRows(page, 4)
    await page.locator('[data-line-filter="donorStore"]').fill('P999')
    await waitRows(page, 0)
    const empty = await page.locator('[data-line-empty]').innerText()
    check(`${label}: filters that hide every line say so, not "the queue is clear"`, /No line matches these filters/.test(empty), empty)
    await page.locator('[data-line-clear]').click()
    await waitRows(page, 4)

    // 6: Reload, then a failed reload
    await page.locator('[data-line-reload]').click()
    await page.waitForFunction(() => !document.querySelector('[data-line-reload]')?.hasAttribute('disabled'), null, { timeout: 10000 })
    await waitRows(page, 4)
    check(`${label}: Reload reads the queue again`, queueCount() === 2, String(queueCount()))
    await page.locator('[data-line-reload]').click()
    const banner = page.locator('[role="alert"]', { hasText: 'could not be reloaded' })
    await banner.waitFor({ timeout: 20000 })
    await waitRows(page, 4)
    check(`${label}: a failed reload keeps the last good list under a banner`, queueCount() === 3 && (await banner.count()) === 1)

    // 7: the links
    await page.locator('[data-line-list] .ag-row', { has: page.locator('[col-id="requestNo"]', { hasText: /^DR-1002$/ }) }).locator('[data-line-open="request"]').click()
    await page.waitForURL('**/oms/donor-requests?request=DR-1002', { timeout: 10000 })
    await page.waitForTimeout(800)
    const dq = donorQueries.at(-1)
    check(
      `${label}: the request opens Donor requests seeded on it, with no date bound`,
      dq?.get('requestNo') === 'DR-1002' && !dq.get('fromDate') && !dq.get('toDate'),
      dq ? [...dq.entries()].map((e) => e.join('=')).join('&') : 'no call',
    )
    await page.goBack()
    await waitRows(page, 4)
    await page.locator('[data-line-list] .ag-row', { has: page.locator('[col-id="requestNo"]', { hasText: /^DR-1003$/ }) }).locator('[data-line-open="delivery"]').click()
    await page.waitForURL('**/oms/delivery/8000000503', { timeout: 10000 })
    await page.waitForTimeout(400)
    check(
      `${label}: the delivery opens in Document Details`,
      calls.some((c) => /^SdDocumentWeb\/(Delivery|Document)\/.*8000000503/.test(c)),
      calls.filter((c) => /^SdDocumentWeb\/(Delivery|Document)\//.test(c)).join(','),
    )
    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: a refused first load ─────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { grant: true, queue: () => 'refused' })
    await page.goto(`${BASE}/oms/failed-donor-transfers`)
    const banner = page.locator('[role="alert"]', { hasText: 'You do not hold FailedDonorTransfers (03).' })
    await banner.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: a refused load is shown with its own message`,
      (await banner.count()) === 1 && /The queue could not be loaded/.test(await banner.innerText()),
      await banner.innerText(),
    )
    check(
      `${label}: and no "queue is clear" or count contradicts it`,
      (await page.locator('[data-status-count]').count()) === 0 && !/queue is clear/.test(await page.locator('[data-line-list]').innerText()),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-refused.png` })
    check(`${label}: no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

/** Under RTL the retrying line's error is Arabic text; under LTR English. Either way it reached the cell whole. */
function rtlError(dir, text) {
  return dir === 'rtl' ? text === 'انتهت مهلة الاتصال بـ DRS' : text === 'Timeout talking to DRS'
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
