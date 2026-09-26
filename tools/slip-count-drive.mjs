// Slip count drive (spec 319, ticket 320) — drives the REAL app in Chromium against STUBBED
// envelopes shaped exactly as BackOffice 2034 records them under `## Web contract` (cross-checked
// against CollectionReadyRowModel.cs, CollectionInquiryModel.cs, SlipCountedResponse.cs and
// AttachmentWebEndpoints.cs on pricing2): `CollectionWeb/Ready` rows gain `cardTotal` + `slipCount`,
// `CollectionWeb/Collections` rows gain `slipCount`, both answers carry `slipCountsUnavailable`
// BESIDE `data`, and `GET AttachmentWeb/Access` answers `{ categories, withdrawCategories }` (or a
// 503 NOT_SET_UP until the File Server key exists).
//
// ⚠️ Stubbed, never live: no SIS.Api with the File Server key set is up for this wave.
//
// Verifies ticket 320's drive Proof, on BOTH grids:
//   1. the Slips column + the "No slip" filter shown when the probe holds CASH_CLOSE, and hidden
//      for a 503 NOT_SET_UP, a bare 403, a network failure, a pending probe, a bare-string
//      "CASH_CLOSE", an empty list and a withdraw-only answer;
//   2. a dash (with its accessible text) for a null count, a real 0 as 0, and on Ready a dash for a
//      null card total (never 0.000) under the currency header;
//   3. the "Slip counts unavailable" banner on `slipCountsUnavailable: true`, the rows still drawn;
//   4. the filter keeping only the 0 rows, sending no query, and following Reset;
//   5. loading, empty, error and refusal still as before; the probe asked once per page;
//   6. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/slip-count-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const READY = '/collection/ready'
const COLLECTIONS = '/collection/collections'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

/** The SIS.Api envelope; `siblings` ride BESIDE `data`, as SlipCountedResponse<T> puts them. */
const envelope = (data, { status = 200, success = true, message = '', errors = null, siblings = {} } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, serverTime: '2026-09-26T09:00:00', data, ...siblings }),
})

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenAssignment: false,
  canOpenSettlement: false,
  canSuperviseSettlement: false,
  canOpenReady: true,
}

// ---- Ready: 1994's rows + 2034's two fields ----
const DAY = {
  kind: 'DAY',
  storeId: 'P019',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  currencyKey: 'SAR',
  businessDay: '2026-09-20T00:00:00',
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X0Y',
  zNumber: 412,
  settlementDocumentId: '',
  entryNumber: 0,
  cashToHandOver: 1000.5,
  surplusDeducted: 250.0,
  readySince: '2026-09-20T23:05:12',
  daysWaiting: 5,
  // 2034's sample.
  cardTotal: 640.0,
  slipCount: 2,
}
/** A receipt: not a store day — both new fields null. */
const RECEIPT = {
  ...DAY,
  kind: 'SETTLEMENT',
  businessDay: null,
  shiftId: '',
  zNumber: null,
  settlementDocumentId: '01K5ZC1A2B3C4D5E6F7G8H9J0K',
  entryNumber: 143,
  cashToHandOver: 120.5,
  surplusDeducted: null,
  readySince: '2026-09-23T10:41:00',
  daysWaiting: 2,
  cardTotal: null,
  slipCount: null,
}
/** A day whose Z has not reached head office: no card figure, and no slip yet — a REAL 0. */
const DAY_NO_Z = {
  ...DAY,
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X1A',
  businessDay: '2026-09-24T00:00:00',
  zNumber: null,
  cashToHandOver: null,
  surplusDeducted: null,
  readySince: '2026-09-24T22:58:00',
  daysWaiting: 1,
  cardTotal: null,
  slipCount: 0,
}
/** A mirrored Z with no CARD line: a card total of 0 is a figure, not an absence. */
const DAY_ZERO_CARD = {
  ...DAY,
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X3C',
  businessDay: '2026-09-22T00:00:00',
  zNumber: 413,
  cardTotal: 0,
  slipCount: 1,
}
const READY_ROWS = [DAY, DAY_ZERO_CARD, RECEIPT, DAY_NO_Z]
const readyId = (row) => (row.kind === 'SETTLEMENT' ? `SETTLEMENT:${row.settlementDocumentId}` : `DAY:${row.shiftId}`)

// ---- Collections: 1992's sample row + 2034's slipCount, keyed by each row's OWN day ----
const SHIFT = {
  storeId: 'P019',
  openedAt: '2026-09-01T08:00:12',
  closedAt: '2026-09-01T23:10:40',
  systemCash: 5420.5,
  countedCash: 5420.5,
  variance: 0.0,
  varianceReasonCode: '',
  varianceReasonText: '',
  openingFloat: 200.0,
  countedCashNet: 5220.5,
  retainedFloat: 200.0,
  netCollected: 5220.5,
  cardTotal: 1310.25,
  cardTransactionCount: 9,
  businessDay: '2026-09-01T00:00:00',
  collectorOperatorId: 'COLL-9',
  collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
  collectionReceiptNo: 91234,
  collectedAt: '2026-09-12T10:15:00',
  zReportIds: '01K5XW0A1B2C3D4E5F6G7H8J9K',
  collectorName: 'فهد القحطاني',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  closerOperatorId: 'MGR-01',
  closerName: 'Pharmacist One',
  salesDate: '2026-09-01T00:00:00',
  currencyKey: 'SAR',
  slipCount: 0,
}
const COLLECTION_ROWS = [
  // One multi-shift receipt: two rows, two business days, two different counts — never merged.
  SHIFT,
  { ...SHIFT, openedAt: '2026-09-02T08:00:00', businessDay: '2026-09-02T00:00:00', salesDate: '2026-09-02T00:00:00', slipCount: 3 },
  // A settlement receipt: no business day, and its count is always null.
  {
    ...SHIFT,
    collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X01',
    collectionReceiptNo: 91235,
    businessDay: null,
    salesDate: '0001-01-01T00:00:00',
    collectedAt: '2026-09-12T09:00:00',
    slipCount: null,
  },
]

/** The probe's answers, by name. */
const PROBES = {
  holder: () => envelope({ categories: ['CASH_CLOSE'], withdrawCategories: ['CASH_CLOSE'] }),
  notSetUp: () =>
    envelope(null, {
      status: 503,
      success: false,
      message: 'The attachment store is not set up on this server. / مخزن المرفقات غير مُعدّ على هذا الخادم.',
      errors: [{ errorCode: 'NOT_SET_UP', internalErrorCode: '', errorMessage: '' }],
    }),
  forbidden: () => ({ status: 403, body: '' }),
  bareString: () => envelope({ categories: 'CASH_CLOSE', withdrawCategories: 'CASH_CLOSE' }),
  empty: () => envelope({ categories: [], withdrawCategories: [] }),
  withdrawOnly: () => envelope({ categories: [], withdrawCategories: ['CASH_CLOSE'] }),
  malformed: () => envelope({}),
}

let probe = 'holder'
let probeCalls = 0
let probeHold = null
let scenario = {}
let listCalls = 0
let hold = null

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 2600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    if (path === 'AttachmentWeb/Access') {
      probeCalls++
      if (probeHold) await probeHold
      if (probe === 'network') return route.abort('failed')
      return route.fulfill(PROBES[probe]())
    }
    if (path === 'CollectionWeb/Ready' || path === 'CollectionWeb/Collections') {
      listCalls++
      if (hold) await hold
      if (scenario.list === 'error')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The inquiry failed.' }))
      if (scenario.list === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (scenario.list === 'empty') return route.fulfill(envelope([], { siblings: { slipCountsUnavailable: false } }))
      const rows = path === 'CollectionWeb/Ready' ? READY_ROWS : COLLECTION_ROWS
      if (scenario.unavailable)
        return route.fulfill(
          envelope(rows.map((r) => ({ ...r, slipCount: null })), { siblings: { slipCountsUnavailable: true } }),
        )
      return route.fulfill(envelope(rows, { siblings: { slipCountsUnavailable: false } }))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/320-${name}.png`, fullPage: true })
  const mainText = async () => page.locator('main').innerText()
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(slips|ready|collections|collection|common)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const headers = async () => (await page.locator('.ag-header-cell-text').allInnerTexts()).map((s) => s.trim())
  const load = async (path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
  }
  const readyCell = (row, colId) => page.locator(`.ag-row[row-id="${readyId(row)}"] [col-id="${colId}"]`).first()
  const indexCell = (index, colId) => page.locator(`.ag-row[row-index="${index}"] [col-id="${colId}"]`).first()
  /** What a SIGHTED reader sees in a cell: the text minus any screen-reader-only span. */
  const seen = async (cell) =>
    cell.evaluate((el) => {
      const copy = el.cloneNode(true)
      copy.querySelectorAll('.sr-only').forEach((n) => n.remove())
      return copy.textContent.trim()
    })
  const heard = async (cell) => ((await cell.locator('.sr-only').allTextContents()).join(' ').trim())
  const noSlipButton = () => page.getByRole('button', { name: 'No slip', exact: true })
  const displayedRows = async () => page.locator('.ag-row[row-index]').count()
  const BANNER = 'Slip counts unavailable'

  // ════════════════════════════ READY ════════════════════════════
  // ---- 1. shown for a CASH_CLOSE holder ----
  probe = 'holder'
  probeCalls = 0
  await load(READY)
  await page.locator('.ag-row').first().waitFor()
  await shot('ready-holder')
  let hs = await headers()
  check('ready — the Slips column is shown for a CASH_CLOSE holder', hs.includes('Slips'), hs.join(' | '))
  check('ready — the Slips column sits right after Card Total', hs.indexOf('Slips') === hs.indexOf('Card Total (SAR)') + 1, hs.join(' | '))
  check('ready — Card Total wears the currency header like its neighbours', hs.includes('Card Total (SAR)') && hs.includes('Cash to Hand Over (SAR)'))
  check('ready — the probe is asked once for the page', probeCalls === 1, `${probeCalls} calls`)
  check('ready — the "No slip" filter is offered', (await noSlipButton().count()) === 1)

  // ---- 2. dashes for null ----
  check('ready — a count as sent', (await seen(readyCell(DAY, 'slipCount'))) === '2')
  check('ready — a real 0 draws 0', (await seen(readyCell(DAY_NO_Z, 'slipCount'))) === '0')
  check('ready — a receipt’s null count draws a dash, never 0', (await seen(readyCell(RECEIPT, 'slipCount'))) === '—')
  check('ready — the dash says what it means to a screen reader', (await heard(readyCell(RECEIPT, 'slipCount'))) === 'Slip count unknown')
  check('ready — a known count carries no "unknown" text', (await heard(readyCell(DAY_NO_Z, 'slipCount'))) === '')
  check('ready — card total to the row’s currency', (await seen(readyCell(DAY, 'cardTotal'))) === '640.00')
  check('ready — a null card total is a dash, never 0.000', (await seen(readyCell(DAY_NO_Z, 'cardTotal'))) === '—' && (await seen(readyCell(RECEIPT, 'cardTotal'))) === '—')
  check('ready — a card total of 0 is a figure', (await seen(readyCell(DAY_ZERO_CARD, 'cardTotal'))) === '0.00')
  // Ticket 321 made a known count a button that opens the drawer (tools/slip-drawer-drive.mjs);
  // what stays true from 320 is that an unknown (null) count is never one.
  check('ready — an unknown count is not a link or a button', (await readyCell(RECEIPT, 'slipCount').locator('a, button').count()) === 0)
  check('ready — no banner while the counts were read', !(await mainText()).includes(BANNER))

  // ---- 4. the filter ----
  listCalls = 0
  await noSlipButton().click()
  await page.waitForTimeout(300)
  check('ready — "No slip" keeps only the day with exactly 0 slips', (await displayedRows()) === 1 && (await readyCell(DAY_NO_Z, 'slipCount').count()) === 1, `${await displayedRows()} rows`)
  check('ready — …never the receipt’s unknown (null) count', (await readyCell(RECEIPT, 'slipCount').count()) === 0)
  check('ready — the filter is pressed, and sent no query', (await noSlipButton().getAttribute('aria-pressed')) === 'true' && listCalls === 0, `${listCalls} list calls`)
  await shot('ready-no-slip')
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  await page.locator(`.ag-row[row-id="${readyId(RECEIPT)}"]`).first().waitFor()
  check('ready — Reset turns the filter off and every row returns', (await noSlipButton().getAttribute('aria-pressed')) === 'false' && (await displayedRows()) === READY_ROWS.length, `${await displayedRows()} rows`)

  // ---- 3. the banner ----
  scenario = { unavailable: true }
  await load(READY)
  await page.locator('.ag-row').first().waitFor()
  let text = await mainText()
  check('ready — the "Slip counts unavailable" banner over the grid', text.includes(BANNER))
  check('ready — …the rows still render', (await displayedRows()) === READY_ROWS.length)
  const dashes = await Promise.all(READY_ROWS.map((r) => seen(readyCell(r, 'slipCount'))))
  check('ready — …and every count is a dash', dashes.every((d) => d === '—'), dashes.join(','))
  await shot('ready-unavailable')
  await noRawKeys('ready — unavailable')

  // ---- 1b. hidden by the probe — every refusal and every malformed answer ----
  for (const [name, answer] of [
    ['a 503 NOT_SET_UP', 'notSetUp'],
    ['a bare 403', 'forbidden'],
    ['a network failure', 'network'],
    ['a bare-string "CASH_CLOSE"', 'bareString'],
    ['an empty categories list', 'empty'],
    ['a withdraw-only answer', 'withdrawOnly'],
    ['a malformed answer', 'malformed'],
  ]) {
    probe = answer
    // Unavailable too, so the banner's own gating is proved alongside the column's.
    scenario = { unavailable: true }
    await load(READY)
    await page.locator('.ag-row').first().waitFor()
    hs = await headers()
    text = await mainText()
    check(
      `ready — hidden for ${name}: no column, no filter, no banner`,
      !hs.includes('Slips') && (await noSlipButton().count()) === 0 && !text.includes(BANNER),
      hs.join(' | '),
    )
  }
  check('ready — …and Card Total still shows under a hidden probe', (await headers()).includes('Card Total (SAR)'))
  probe = 'notSetUp'
  scenario = {}
  await load(READY)
  await page.locator('.ag-row').first().waitFor()
  await shot('ready-not-set-up')

  // Pending: the probe never answers, the grid does.
  let release
  probe = 'holder'
  probeHold = new Promise((r) => (release = r))
  await page.goto(BASE + READY)
  await page.locator('.ag-row').first().waitFor()
  check('ready — hidden while the probe is pending', !(await headers()).includes('Slips') && (await noSlipButton().count()) === 0)
  release()
  probeHold = null
  await page.getByRole('columnheader', { name: 'Slips' }).first().waitFor({ timeout: 8000 }).catch(() => {})
  check('ready — …and shown once it answers yes', (await headers()).includes('Slips'))

  // ---- 5. loading, empty, error, refusal — as before ----
  let releaseList
  hold = new Promise((r) => (releaseList = r))
  await page.goto(BASE + READY)
  await page.getByRole('status', { name: 'Loading what is ready for collection…' }).first().waitFor({ timeout: 8000 }).catch(() => {})
  check('ready — loading still shows the shimmer', (await page.getByRole('status', { name: 'Loading what is ready for collection…' }).count()) > 0)
  releaseList()
  hold = null
  await page.waitForLoadState('networkidle')

  scenario = { list: 'empty' }
  await load(READY)
  await page.getByText('Nothing is waiting for a collector').first().waitFor({ timeout: 8000 }).catch(() => {})
  check('ready — empty still shows the empty state', (await mainText()).includes('Nothing is waiting for a collector') && (await page.locator('.ag-root').count()) === 0)

  scenario = { list: 'error' }
  await load(READY)
  await page.getByText('The ready-for-collection list could not be loaded.').first().waitFor({ timeout: 8000 }).catch(() => {})
  text = await mainText()
  check('ready — a 500 still shows the error banner and no grid', (await page.locator('.ag-root').count()) === 0 && !text.includes('Nothing is waiting'), text.replace(/\n/g, ' ').slice(-160))

  scenario = { list: 'forbidden' }
  await load(READY)
  await page.getByText('not allowed to read').first().waitFor({ timeout: 8000 }).catch(() => {})
  check('ready — the door’s bare 403 still reads as a refusal', (await mainText()).includes('Your account is not allowed to read the ready-for-collection list'))
  await noRawKeys('ready — states')
  scenario = {}

  // ═════════════════════════ CASH COLLECTIONS ═════════════════════════
  probe = 'holder'
  probeCalls = 0
  await load(COLLECTIONS)
  await page.locator('.ag-row').first().waitFor()
  await shot('collections-holder')
  hs = await headers()
  check('collections — the Slips column is shown for a CASH_CLOSE holder', hs.includes('Slips'), hs.join(' | '))
  check('collections — right after the existing Card Total', hs.indexOf('Slips') === hs.indexOf('Card Total (SAR)') + 1, hs.join(' | '))
  check('collections — the probe is asked once for the page', probeCalls === 1, `${probeCalls} calls`)
  check('collections — the existing card total is untouched', (await seen(indexCell(0, 'cardTotal'))) === '1,310.25')
  check(
    'collections — a multi-shift receipt’s rows keep their OWN day’s counts (0 and 3, never merged)',
    (await seen(indexCell(0, 'slipCount'))) === '0' && (await seen(indexCell(1, 'slipCount'))) === '3',
  )
  check('collections — a settlement row’s null count is a dash, with its accessible text', (await seen(indexCell(2, 'slipCount'))) === '—' && (await heard(indexCell(2, 'slipCount'))) === 'Slip count unknown')

  listCalls = 0
  await noSlipButton().click()
  await page.waitForTimeout(300)
  check('collections — "No slip" keeps only the 0 row', (await displayedRows()) === 1 && (await seen(indexCell(0, 'slipCount'))) === '0', `${await displayedRows()} rows`)
  check('collections — …and sent no query', listCalls === 0, `${listCalls} list calls`)
  await shot('collections-no-slip')
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
  check('collections — Reset turns the filter off and every row returns', (await noSlipButton().getAttribute('aria-pressed')) === 'false' && (await displayedRows()) === COLLECTION_ROWS.length, `${await displayedRows()} rows`)

  scenario = { unavailable: true }
  await load(COLLECTIONS)
  await page.locator('.ag-row').first().waitFor()
  text = await mainText()
  const cDashes = await Promise.all(COLLECTION_ROWS.map((_, i) => seen(indexCell(i, 'slipCount'))))
  check('collections — the banner on slipCountsUnavailable, rows still drawn, every count a dash', text.includes(BANNER) && (await displayedRows()) === COLLECTION_ROWS.length && cDashes.every((d) => d === '—'), cDashes.join(','))
  await shot('collections-unavailable')

  for (const [name, answer] of [
    ['a 503 NOT_SET_UP', 'notSetUp'],
    ['a bare 403', 'forbidden'],
    ['a network failure', 'network'],
    ['a bare-string "CASH_CLOSE"', 'bareString'],
    ['an empty categories list', 'empty'],
    ['a withdraw-only answer', 'withdrawOnly'],
    ['a malformed answer', 'malformed'],
  ]) {
    probe = answer
    scenario = { unavailable: true }
    await load(COLLECTIONS)
    await page.locator('.ag-row').first().waitFor()
    hs = await headers()
    text = await mainText()
    check(`collections — hidden for ${name}: no column, no filter, no banner`, !hs.includes('Slips') && (await noSlipButton().count()) === 0 && !text.includes(BANNER), hs.join(' | '))
  }

  check('collections — …and the existing Card Total still shows under a hidden probe', (await headers()).includes('Card Total (SAR)'))

  // Pending: the probe never answers, the grid does.
  probe = 'holder'
  scenario = {}
  probeHold = new Promise((r) => (release = r))
  await page.goto(BASE + COLLECTIONS)
  await page.locator('.ag-row').first().waitFor()
  check('collections — hidden while the probe is pending', !(await headers()).includes('Slips') && (await noSlipButton().count()) === 0)
  release()
  probeHold = null
  await page.getByRole('columnheader', { name: 'Slips' }).first().waitFor({ timeout: 8000 }).catch(() => {})
  check('collections — …and shown once it answers yes', (await headers()).includes('Slips'))

  hold = new Promise((r) => (releaseList = r))
  await page.goto(BASE + COLLECTIONS)
  await page.getByRole('status', { name: "Loading today's collections…" }).first().waitFor({ timeout: 8000 }).catch(() => {})
  check('collections — loading still shows the shimmer', (await page.getByRole('status', { name: "Loading today's collections…" }).count()) > 0)
  releaseList()
  hold = null
  await page.waitForLoadState('networkidle')

  scenario = { list: 'empty' }
  await load(COLLECTIONS)
  await page.getByText('No collections in this period').first().waitFor({ timeout: 8000 }).catch(() => {})
  check('collections — empty still shows the empty state', (await mainText()).includes('No collections in this period'))
  scenario = { list: 'error' }
  await load(COLLECTIONS)
  await page.waitForTimeout(500)
  check('collections — a 500 still shows the error banner and no grid', (await page.locator('.ag-root').count()) === 0 && !(await mainText()).includes('No collections in this period'))
  scenario = { list: 'forbidden' }
  await load(COLLECTIONS)
  await page.waitForTimeout(500)
  check('collections — the door’s bare 403 still reads as a failure, not an empty period', (await page.locator('.ag-root').count()) === 0 && !(await mainText()).includes('No collections in this period'))
  await noRawKeys('collections — states')
  scenario = {}

  check('no page error anywhere', errors.length === 0, errors.slice(0, 3).join(' || '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
