// GS1 check drive (ticket 454, BackOffice spec 2544).
//
// Drives the REAL app in Chromium against STUBS of the Materials door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md) — none of the
// `MaterialWeb/*` doors is built, so there is no live SIS.Api to point at. Every stub is built from
// the contract's own example values (material 101234, GTIN 06281234567890, expiry 2027-03-31,
// lot A12, serial X9, SOLD at store 1007 / till 03 / invoice 200311, history count 3, a history row
// at 2026-09-02 14:31:07 in store 1001 / till 02 / invoice 100045):
//   GET  MaterialWeb/Access       → { canSearchMaterials, canCheckStock, canCheckGs1 }
//   POST MaterialWeb/Gs1/Check    → one answer per code, in request order (a repeat in one request
//                                   gets duplicate: true and the same answer)
//   GET  MaterialWeb/Gs1/History  → the unit's trail, oldest → newest, lotMismatch per row
// The envelope is the REAL SIS.Api shape `@/core/api` reads (copied from
// tools/coupon-import-delete-drive.mjs).
//
// It asserts:
//   1. the GS1 check leaf opens the GS1 check's OWN page (the static route, not the placeholder,
//      not `:no`), marked alone in the rail; without `canCheckGs1` the leaf is hidden, the typed URL
//      shows the denied card, and no GS1 call is made;
//   2. the scan box is focused on landing; Enter sends the scan as typed, and a valid unit shows
//      SOLD with its store / till / invoice;
//   3. a raw scan keeps its GS (0x1D) byte for byte in the request; SELLABLE shows the sync note
//      (card AND grid), and an unknown batch is a warning;
//   4. a malformed code shows "Not well-formed" and its issues by category, and why there is no
//      material;
//   5. a duplicate is flagged on its own row, never merged; pasted lines become separate scans in
//      ONE request;
//   6. history is asked only when a row is expanded, once per unit (re-opening, or the duplicate's
//      row, asks no more); its rows show date+time, SALE/RETURN, store, till, invoice, lot, and the
//      lot-mismatch row is highlighted through a token;
//   7. Export writes xlsx: the verdicts as text, GS shown as <GS>, no control characters, no
//      isolates, no expand column;
//   7b. a failed batch shows the server's message and Check again re-sends only its scans;
//   8. the 501st scan is refused on the client; Clear list empties the list;
//   9. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/materials-gs1-drive.mjs          (DRIVE_PORT=5244 for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.materials-gs1-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/coupon-import-delete-drive.mjs).
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const GS = '\u001d'
// GTIN (01) and expiry (17) are fixed-length; the lot (10) is closed by # (pasted) or GS (scanned).
const SOLD_CODE = '01062812345678901727033110A12#21X9'
const SELLABLE_RAW = `01062812345678901727033110A12${GS}21X7`
const HELD_CODE = '01062812345678901727033110A12#21X8'
const MALFORMED = '0106281234567899'
const UNKNOWN_GTIN = '01062899999999901727033110A12#21Q1'
// The first check of this code is refused by the server (a coded MAT-00005); the next one answers.
const FLAKY = '01062812345678901727033110A12#21F1'
let flakyFailed = false

const PANADOL = { materialNumber: '101234', description: 'PANADOL 500MG 24 TAB', description2: 'بنادول ٥٠٠ ملغ ٢٤ قرص' }
const parsed = (serial, over = {}) => ({ valid: true, gtin: '06281234567890', expiry: '2027-03-31', lot: 'A12', serial, issues: [], ...over })
const base = { duplicate: false, materialReason: null, soldRef: null, heldBy: null, historyCount: 0 }

/** The server's answer to one code — as the contract has it. */
function answerFor(code) {
  if (code === SOLD_CODE)
    return { ...base, code, parse: parsed('X9'), material: PANADOL, batch: 'known', status: 'SOLD', soldRef: { storeCode: '1007', machine: '03', trxNumber: '200311' }, historyCount: 3 }
  if (code === SELLABLE_RAW) return { ...base, code, parse: parsed('X7'), material: PANADOL, batch: 'unknown', status: 'SELLABLE' }
  if (code === HELD_CODE)
    return { ...base, code, parse: parsed('X8'), material: PANADOL, batch: 'known', status: 'HELD', heldBy: { documentNo: '4500012345', storeCode: '1001' }, historyCount: 1 }
  if (code === MALFORMED)
    return {
      ...base,
      code,
      parse: {
        valid: false, gtin: null, expiry: null, lot: null, serial: null,
        issues: [
          { category: 'GtinIntegrity', message: 'GTIN check digit is wrong. / رقم التحقق في GTIN خاطئ.' },
          { category: 'Structure', message: 'No serial (21) element. / لا يوجد عنصر رقم تسلسلي (21).' },
        ],
      },
      material: null, materialReason: 'NOT_PARSED', batch: 'notApplicable', status: null,
    }
  if (code === UNKNOWN_GTIN)
    return { ...base, code, parse: parsed('Q1', { gtin: '06289999999990' }), material: null, materialReason: 'GTIN_UNKNOWN', batch: 'notApplicable', status: null }
  // Anything else (the cap test's filler): a well-formed code with an unknown GTIN.
  return { ...base, code, parse: parsed(null, { gtin: null, lot: null }), material: null, materialReason: 'GTIN_UNKNOWN', batch: 'notApplicable', status: null }
}

const HISTORY = [
  { date: '2026-09-02', time: '14:31:07', trxType: 'SALE', storeCode: '1001', storeName: 'Riyadh - Olaya', machine: '02', trxNumber: '100045', lot: 'A12', lotMismatch: false },
  { date: '2026-09-05', time: '09:12:44', trxType: 'RETURN', storeCode: '1001', storeName: 'Riyadh - Olaya', machine: '02', trxNumber: '100101', lot: 'A12', lotMismatch: false },
  { date: '2026-09-20', time: '18:03:51', trxType: 'SALE', storeCode: '1007', storeName: 'جدة - التحلية', machine: '03', trxNumber: '200311', lot: 'B77', lotMismatch: true },
]

const ALL = { canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }

const browser = await chromium.launch()

async function open({ access = ALL } = {}) {
  const context = await browser.newContext({ viewport: { width: 2600, height: 1300 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const checkBodies = []
  const historyCalls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4|5)\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'MaterialWeb/Access') return route.fulfill(envelope(access))
    if (p === 'MaterialWeb/Gs1/Check') {
      const raw = route.request().postData() ?? '{}'
      const body = JSON.parse(raw)
      checkBodies.push({ method: route.request().method(), raw, body })
      if (!Array.isArray(body.codes) || body.codes.length < 1 || body.codes.length > 500)
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Send 1 to 500 codes. / أرسل من 1 إلى 500 رمز.', errorCode: 'MAT-00005' }))
      if (body.codes.includes(FLAKY) && !flakyFailed) {
        flakyFailed = true
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'The GS1 check is unavailable. / فحص GS1 غير متاح.', errorCode: 'MAT-00005' }))
      }
      const seen = new Set()
      return route.fulfill(
        envelope(
          body.codes.map((code) => {
            const answer = { ...answerFor(code), duplicate: seen.has(code) }
            seen.add(code)
            return answer
          }),
        ),
      )
    }
    if (p === 'MaterialWeb/Gs1/History') {
      historyCalls.push(url.searchParams.toString())
      const ok = url.searchParams.get('material') === '101234' && url.searchParams.get('serial') === 'X9'
      return route.fulfill(envelope(ok ? HISTORY : []))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, checkBodies, historyCalls }
}

const box = (page) => page.locator('[data-gs1-scan]')

/** Type a scan into the box and press Enter; wait until the list holds `rows` rows, all answered. */
async function scan(page, code, rows) {
  await box(page).fill(code)
  await box(page).press('Enter')
  await settle(page, rows)
}

async function settle(page, rows) {
  await page.waitForFunction(
    (n) => document.querySelector('[data-gs1-count]')?.getAttribute('data-gs1-count') === String(n) && !document.querySelector('[data-gs1-card="pending"]'),
    rows,
    { timeout: 10000 },
  )
  await page.waitForTimeout(150)
}

/** Paste text into the box through a real paste event. */
const paste = (page, text) =>
  page.locator('[data-gs1-scan]').evaluate((el, value) => {
    const dt = new DataTransfer()
    dt.setData('text', value)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text)

/** The grid's rows by row-index → { colId: text }. */
const gridRows = (page) =>
  page.evaluate(() => {
    const byIndex = new Map()
    for (const r of document.querySelectorAll('[data-gs1-grid] .ag-row[row-index]')) {
      const i = Number(r.getAttribute('row-index'))
      const cells = byIndex.get(i) ?? {}
      for (const c of r.querySelectorAll('[col-id]')) cells[c.getAttribute('col-id')] = c.textContent.trim()
      byIndex.set(i, cells)
    }
    return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c)
  })

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

const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function sheetText(files) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unescapeXml(m[1].replace(/<[^>]+>/g, '')))
  const xml = files['xl/worksheets/sheet1.xml'] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)]
    .map((r) =>
      [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
        .map(([, attrs, body]) => {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? unescapeXml(body.replace(/<[^>]+>/g, ''))
          if (/t="s"/.test(attrs)) return shared[Number(v)]
          return (/t="n"|^(?![\s\S]*t=)/.test(attrs) && v !== '' ? 'n:' : '') + v
        })
        .join('|'),
    )
    .join('\n')
}

// ── 1: the menu, the static route, the gate ───────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Materials$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  const leaf = page.locator('nav a[href="/materials/gs1"]').first()
  await leaf.waitFor({ timeout: 5000 })
  check('1: the GS1 check leaf is shown under Materials', (await leaf.textContent()).trim() === 'GS1 check')
  await leaf.click()
  await box(page).waitFor({ timeout: 20000 })
  check('1: /materials/gs1 renders the GS1 check itself — the STATIC route, not the placeholder or :no', (await page.locator('[data-material-placeholder]').count()) === 0 && (await page.locator('h1', { hasText: 'GS1 check' }).count()) === 1)
  const marked = await page.locator('nav a[aria-current="page"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: the rail marks the GS1 check leaf alone', JSON.stringify(marked) === JSON.stringify(['/materials/gs1']), marked.join())
  check('1: landing asks the GS1 doors nothing', !calls.some((c) => c.startsWith('MaterialWeb/Gs1')))
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open({ access: { canSearchMaterials: true, canCheckStock: true, canCheckGs1: false } })
  await page.goto(`${BASE}/materials/gs1`)
  await page.locator('nav a[href="/materials"]').first().waitFor({ timeout: 20000 })
  await page.locator('[role="alert"]', { hasText: 'No access to the GS1 check' }).waitFor({ timeout: 10000 })
  check('1: without canCheckGs1 the GS1 leaf is hidden (search and stock stay)', (await page.locator('nav a[href="/materials/gs1"]').count()) === 0 && (await page.locator('nav a[href="/materials/stock"]').count()) === 1)
  check('1: …and the typed URL shows the denied card, with no GS1 call', (await box(page).count()) === 0 && !calls.some((c) => c.startsWith('MaterialWeb/Gs1')))
  check('1: no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–8: the check ────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, checkBodies, historyCalls } = await open()
  await page.goto(`${BASE}/materials/gs1`)
  await box(page).waitFor({ timeout: 20000 })
  check('2: the scan box is focused on landing', await box(page).evaluate((el) => el === document.activeElement))
  check('2: the card waits for a scan', (await page.locator('[data-gs1-card="empty"]').count()) === 1)

  // 2: a valid unit → SOLD
  await scan(page, SOLD_CODE, 1)
  const b1 = checkBodies.at(-1)
  check('2: Enter POSTs the scan to MaterialWeb/Gs1/Check, as typed', b1?.method === 'POST' && b1.raw === JSON.stringify({ codes: [SOLD_CODE] }), b1?.raw)
  check('2: the box is cleared and focused again for the next scan', (await box(page).inputValue()) === '' && (await box(page).evaluate((el) => el === document.activeElement)))
  const card = page.locator('[data-gs1-card]')
  check('2: the card shows SOLD', (await card.locator('[data-gs1-card-status="SOLD"]').count()) === 1 && /Sold/.test(await card.locator('[data-gs1-card-status]').textContent()))
  const sold = (await card.locator('[data-gs1-sold-ref]').textContent()).trim()
  check('2: …with its store, till and invoice', sold === 'Sold at store 1007, till 03, invoice 200311', sold)
  const cardText = await card.textContent()
  check('2: well-formed, with GTIN, expiry, lot and serial as sent', (await card.locator('[data-gs1-card-well-formed="true"]').count()) === 1 && ['06281234567890', '2027-03-31', 'A12', 'X9'].every((v) => cardText.includes(v)))
  check('2: the material with its EN and AR descriptions', (await card.locator('[data-gs1-card-material="101234"]').count()) === 1 && /PANADOL 500MG 24 TAB/.test(await card.textContent()) && /بنادول/.test(await card.textContent()))
  check('2: a known batch', (await card.locator('[data-gs1-card-batch="known"]').count()) === 1)
  check('2: SOLD carries no sync note', (await card.locator('[data-gs1-sync-note]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/2-sold.png`, fullPage: true })

  // 3: a raw scan with GS → SELLABLE + the sync note; unknown batch = warning
  await scan(page, SELLABLE_RAW, 2)
  const b2 = checkBodies.at(-1)
  check('3: the GS character reaches the request byte for byte', b2?.body.codes?.[0] === SELLABLE_RAW && b2.raw.includes('\\u001d'), b2?.raw)
  check('3: the card shows the scan with GS made visible', (await card.locator('[data-gs1-card-code]').textContent()).includes('10A12<GS>21X7'))
  check('3: SELLABLE shows "History only covers invoices already synced to HQ" beside it', (await card.locator('[data-gs1-card-status="SELLABLE"] [data-gs1-sync-note]').textContent()).trim() === 'History only covers invoices already synced to HQ')
  check('3: an unknown batch is shown as a warning', (await card.locator('[data-gs1-card-batch="unknown"]').textContent()).trim() === 'Unknown batch' && /attention/.test(await card.locator('[data-gs1-card-batch="unknown"] span').getAttribute('class')))
  check('3: the grid\'s SELLABLE cell carries the sync note too', (await page.locator('[data-gs1-grid] [data-verdict="status"][data-sev="ok"] [data-sync-note]').count()) === 1)

  // 4: a malformed code
  await scan(page, MALFORMED, 3)
  check('4: a malformed code is "Not well-formed"', (await card.locator('[data-gs1-card-well-formed="false"]').count()) === 1 && /Not well-formed/.test(await card.textContent()))
  const issues = await card.locator('[data-gs1-issue]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-gs1-issue')}:${e.textContent}`))
  check('4: …with each issue and its category', issues.length === 2 && issues[0].startsWith('GtinIntegrity:GTIN check digit') && issues[0].includes('GTIN check digit is wrong') && issues[1].startsWith('Structure:Structure'), issues.join(' | '))
  check('4: …and the reason it has no material', (await card.locator('[data-gs1-card-reason="NOT_PARSED"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/4-malformed.png`, fullPage: true })

  // 5: a duplicate, and pasted lines
  await scan(page, SOLD_CODE, 4)
  let rows = await gridRows(page)
  check('5: a duplicate is a row of its own — the list is not merged', rows.length === 4 && rows[0].code === SOLD_CODE && rows[3].code === SOLD_CODE)
  check('5: …and it is flagged on that row, not on the first', rows[3].duplicate === 'Duplicate' && rows[0].duplicate === '')
  check('5: the card flags it too', (await card.locator('[data-gs1-card-duplicate]').count()) === 1)
  const beforePaste = checkBodies.length
  await paste(page, `${HELD_CODE}\r\n${UNKNOWN_GTIN}\n\n${HELD_CODE}`)
  await settle(page, 7)
  const b3 = checkBodies.at(-1)
  check('5: pasted lines become separate scans, sent in ONE request', checkBodies.length === beforePaste + 1 && JSON.stringify(b3.body.codes) === JSON.stringify([HELD_CODE, UNKNOWN_GTIN, HELD_CODE]), b3?.raw)
  rows = await gridRows(page)
  check('5: …the repeat inside the paste is flagged too', rows[6].duplicate === 'Duplicate' && rows[4].duplicate === '')
  check('5: an unknown GTIN says so in the material column', rows[5].materialNumber === 'GTIN not in the barcode master', rows[5].materialNumber)
  check('5: HELD shows its document and store on the card', (await card.locator('[data-gs1-held-by]').textContent()).trim() === 'Held by document 4500012345 at store 1001')
  check('5: the grid shows code, material, lot, serial, expiry, verdicts and history count', rows[0].materialNumber === '101234' && rows[0].lot === 'A12' && rows[0].serial === 'X9' && rows[0].expiry === '2027-03-31' && rows[0].wellFormed === 'Well-formed' && rows[0].batch === 'Known batch' && rows[0].status === 'Sold' && rows[0].historyCount === '3', JSON.stringify(rows[0]))

  // 6: history on demand
  check('6: no history has been asked for yet', historyCalls.length === 0, historyCalls.join(' | '))
  check('6: a row with nothing to ask (no material) cannot be expanded', await page.locator('[data-gs1-grid] [data-expand="3"]').first().isDisabled())
  await page.locator('[data-gs1-grid] [data-expand="1"]').first().click()
  await page.locator('[data-gs1-history-row]').first().waitFor({ timeout: 10000 })
  check('6: expanding a row asks its history once, by material + serial + lot', JSON.stringify(historyCalls) === JSON.stringify(['material=101234&serial=X9&lot=A12']), historyCalls.join(' | '))
  const hist = await page.locator('[data-gs1-history-row]').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('td')].map((td) => td.textContent.trim()).join('|')))
  check(
    '6: history rows show date and time, SALE/RETURN, store and name, till, invoice and lot — oldest first',
    hist[0] === '2026-09-02 14:31:07|Sale|1001 · Riyadh - Olaya|02|100045|A12' && hist[1].startsWith('2026-09-05 09:12:44|Return|') && hist[2].startsWith('2026-09-20 18:03:51|Sale|1007 · جدة - التحلية|03|200311|B77'),
    hist.join(' / '),
  )
  const mismatch = page.locator('[data-gs1-history-row][data-lot-mismatch="true"]')
  check('6: the lot-mismatch row is highlighted through a token, and says so', (await mismatch.count()) === 1 && /bg-attention-050/.test(await mismatch.getAttribute('class')) && /Lot differs from the scan/.test(await mismatch.textContent()))
  check('6: the other rows are not highlighted', (await page.locator('[data-gs1-history-row][data-lot-mismatch="false"].bg-attention-050').count()) === 0)
  check('6: the history title names the serial and material', /History of serial X9, material 101234/.test(await page.locator('[data-gs1-history] h2').textContent()))
  await page.screenshot({ path: `${SHOTS}/6-history.png`, fullPage: true })
  // Collapse, re-open, then open the duplicate row of the same unit: no new request.
  await page.locator('[data-gs1-grid] [data-expand="1"]').first().click()
  check('6: collapsing closes the pane', (await page.locator('[data-gs1-history]').count()) === 0)
  await page.locator('[data-gs1-grid] [data-expand="1"]').first().click()
  await page.locator('[data-gs1-history-row]').first().waitFor({ timeout: 10000 })
  await page.locator('[data-gs1-grid] [data-expand="4"]').first().click()
  await page.locator('[data-gs1-history="4"] [data-gs1-history-row]').first().waitFor({ timeout: 10000 })
  check('6: re-opening, and the duplicate row of the same unit, ask no more (one per unit)', historyCalls.length === 1, historyCalls.join(' | '))
  await page.locator('[data-gs1-grid] [data-expand="5"]').first().click()
  await page.locator('[data-gs1-history-empty]').waitFor({ timeout: 10000 })
  check('6: another unit is its own request', historyCalls.length === 2 && historyCalls[1] === 'material=101234&serial=X8&lot=A12', historyCalls.join(' | '))

  // 7: export
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-gs1-export]').click()])
  const files = unzipText(readFileSync(await download.path()))
  const sheet = sheetText(files)
  const lines = sheet.split('\n')
  check('7: the file is named for the GS1 check', /^gs1-check.*\.xlsx$/.test(download.suggestedFilename()), download.suggestedFilename())
  check(
    '7: the header row is the list\'s columns, without the expand button',
    lines[0] === 'Code|Duplicate|Material|Description|Arabic description|Lot|Serial|Expiry|Well-formed|Issues|Batch|Status|History count',
    lines[0],
  )
  // (The writer leaves an empty cell out, so a row with no duplicate flag and no issue has no `||`.)
  check('7: a row carries its verdicts as text', lines[1] === `${SOLD_CODE}|101234|PANADOL 500MG 24 TAB|بنادول ٥٠٠ ملغ ٢٤ قرص|A12|X9|2027-03-31|Well-formed|Known batch|Sold|n:3`, lines[1])
  check('7: the GS of a raw scan is written as <GS> — not dropped', lines[2].startsWith('01062812345678901727033110A12<GS>21X7|') && /\|Unknown batch\|Sellable\|/.test(lines[2]), lines[2])
  check('7: the malformed row lists its issue categories', /\|Not well-formed\|GTIN check digit, Structure\|Not applicable\|No status\|/.test(lines[3]) && lines[3].includes('Not parsed'), lines[3])
  check('7: the duplicate is flagged in the file', lines[4].split('|')[1] === 'Duplicate', lines[4])
  check('7: no control character and no bidi isolate reaches the file', !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u2066-\u2069]/.test(Object.values(files).join('')))

  // 7b: a failed batch says so in the server's words, and Check again re-sends it
  await box(page).fill(FLAKY)
  await box(page).press('Enter')
  await page.locator('[data-gs1-failed]').waitFor({ timeout: 10000 })
  check('7b: a failed batch shows the banner in the server’s words, and the card says unchecked', /The GS1 check is unavailable/.test(await page.locator('[data-gs1-failed]').textContent()) && (await page.locator('[data-gs1-card="failed"]').count()) === 1)
  const beforeRetry = checkBodies.length
  await page.locator('[data-gs1-retry]').click()
  await settle(page, 8)
  check('7b: Check again re-sends only the failed scan, and the banner clears', checkBodies.length === beforeRetry + 1 && JSON.stringify(checkBodies.at(-1).body.codes) === JSON.stringify([FLAKY]) && (await page.locator('[data-gs1-failed]').count()) === 0)

  // 8: the cap, and Clear
  const beforeCap = checkBodies.length
  await paste(page, Array.from({ length: 500 }, (_, i) => `CAP${String(i).padStart(3, '0')}`).join('\n'))
  await settle(page, 500)
  const capBody = checkBodies.at(-1)
  check('8: the list fills to 500 and no further', (await page.locator('[data-gs1-count]').getAttribute('data-gs1-count')) === '500' && checkBodies.length === beforeCap + 1 && capBody.body.codes.length === 492, String(capBody?.body.codes.length))
  const refusal = page.locator('[data-gs1-cap-refused]')
  check('8: the 501st and after are refused on the client, and the cap is shown', (await refusal.getAttribute('data-gs1-cap-refused')) === '8' && /at most 500 scans: 8 scans were not added/.test(await refusal.textContent()) && /500 scans of at most 500/.test(await page.locator('[data-gs1-count]').textContent()), await refusal.textContent())
  const beforeOne = checkBodies.length
  await box(page).fill(SOLD_CODE)
  await box(page).press('Enter')
  await page.waitForTimeout(400)
  check('8: one more scan on a full list is refused with no call', checkBodies.length === beforeOne && /1 scan was not added/.test(await refusal.textContent()))
  await page.screenshot({ path: `${SHOTS}/8-cap.png`, fullPage: true })
  await page.locator('[data-gs1-clear]').click()
  check('8: Clear list empties the list, the card and the pane', (await page.locator('[data-gs1-count]').getAttribute('data-gs1-count')) === '0' && (await page.locator('[data-gs1-card="empty"]').count()) === 1 && (await page.locator('[data-gs1-history]').count()) === 0 && (await refusal.count()) === 0)
  check('8: …and the box is ready for the next scan', await box(page).evaluate((el) => el === document.activeElement))

  check('9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
