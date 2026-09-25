// Collections four-filter drive (spec 308, ticket 315) — drives the REAL app in Chromium against
// STUBBED envelopes shaped exactly as BackOffice 1992 records them under `## Web contract`:
// `GET CollectionWeb/Collections` gains BusinessDateFrom/To and CollectionDateFrom/To (the web
// stops sending the legacy FromDate/ToDate), and the row's `businessDay` + `collectedAt` become
// the two default date columns.
//
// ⚠️ Stubbed, never live: no SIS.Api with 1992 is up for this wave, and the assertions are about
// SPECIFIC rows — a day collected late, a settlement receipt with no business day, a pre-049 day —
// which a live door will not produce on demand.
//
// Verifies ticket 315's screen Proof:
//   1. the landing query is today..today by COLLECTION date, under the new names, with no
//      business range and no legacy FromDate/ToDate;
//   2. Business Date and Collection Date are default columns, side by side; a null business day
//      is blank (never 0001-01-01), and the floating filter matches the shown day;
//   3. the toolbar sends a business range, both ranges together, an end alone, and the
//      collection range cleared — each only on Search; the collector and the served-by pair
//      ride beside the dates; Reset returns to the landing query;
//   4. the `?acr=` scope disables all four date ends and sends none of them;
//   5. loading, empty, error (500), refusal (the contract's 400 binding failure) and a bare 403
//      on the list, and the access probe's denial;
//   6. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/collections-filters-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/collections'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const DENIED = 'No access to this screen'
const EMPTY_TITLE = 'No collections in this period'

const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
}

/** 1992's sample row, VERBATIM — sold on the 2nd, collected on the 12th. */
const SAMPLE = {
  storeId: 'P019',
  openedAt: '2026-09-02T08:00:12',
  closedAt: '2026-09-02T23:10:40',
  systemCash: 5420.5,
  countedCash: 5420.5,
  variance: 0.0,
  varianceReasonCode: '',
  varianceReasonText: '',
  amendmentCount: 0,
  lastAmendedBy: '',
  openingFloat: 200.0,
  countedCashNet: 5220.5,
  retainedFloat: 200.0,
  netCollected: 5220.5,
  cardTotal: 1310.25,
  cardTransactionCount: 9,
  receiptKind: 'SHIFT',
  settlementAdjustmentTotal: 0.0,
  settlementEntryNumber: 0,
  cashSales: 5220.5,
  settlement: 0.0,
  shiftSettlementAdjustment: 0.0,
  shiftSettlementEntryNumber: 0,
  settlementDescription: '',
  shiftCardTotal: 1310.25,
  isSettlement: false,
  collectionStatus: 'COLLECTED',
  isOffSystem: false,
  offSystemAt: null,
  offSystemBy: '',
  offSystemReasonCode: '',
  offSystemReasonText: '',
  businessDay: '2026-09-02T00:00:00',
  zNumber: 318,
  collectorOperatorId: 'COLL-9',
  collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
  collectionReceiptNo: 91234,
  collectedAt: '2026-09-12T10:15:00',
  zReportIds: '01K5XW0A1B2C3D4E5F6G7H8J9K',
  collectorName: 'فهد القحطاني',
  storeName: 'Al-Dawaa P019',
  closerOperatorId: 'MGR-01',
  closerName: 'Pharmacist One',
  salesDate: '2026-09-02T00:00:00',
  currencyKey: 'SAR',
}

/** Row order = row-index (the stub returns them as the server orders them). */
const ROWS = [
  SAMPLE,
  // A settlement receipt covers no sales day: `businessDay: null`, `salesDate` year-1.
  {
    ...SAMPLE,
    collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X01',
    collectionReceiptNo: 91235,
    receiptKind: 'SETTLEMENT',
    isSettlement: true,
    businessDay: null,
    salesDate: '0001-01-01T00:00:00',
    collectedAt: '2026-09-12T09:00:00',
  },
  // A pre-049 trading day with no recorded business day.
  {
    ...SAMPLE,
    collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X02',
    collectionReceiptNo: 91236,
    businessDay: null,
    collectedAt: '2026-09-12T08:30:00',
  },
]

let scenario = {}
let calls = 0
let lastQuery = ''
/** Held open to show a loading state; released by the scenario. */
let hold = null

async function run() {
  const browser = await chromium.launch()
  // Wide enough that AG Grid's column virtualisation draws every default column.
  const page = await browser.newPage({ viewport: { width: 2400, height: 900 } })
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
    if (path === 'CollectionWeb/Access') {
      if (scenario.access403) return route.fulfill({ status: 403, body: '' })
      return route.fulfill(envelope(ACCESS))
    }
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(
        envelope({
          accountants: [{ staffId: '4466', displayName: 'ضحى' }],
          collectors: [],
          supervisors: [],
          defaultScope: scenario.scoped
            ? { kind: 'MINE', staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى' }
            : null,
        }),
      )
    if (path === 'CollectionWeb/Collections') {
      calls++
      lastQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      if (hold) await hold
      if (scenario.list === 'error')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The inquiry failed.' }))
      // The contract's 400: an unparseable date fails ASP.NET Core's [AsParameters] binding before
      // the handler runs, so the body is a ProblemDetails, NOT the SIS.Api envelope.
      if (scenario.list === 'refusal')
        return route.fulfill({
          status: 400,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
            title: 'One or more validation errors occurred.',
            status: 400,
            errors: { BusinessDateFrom: ['The value \'x\' is not valid.'] },
          }),
        })
      if (scenario.list === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (scenario.list === 'empty') return route.fulfill(envelope([]))
      return route.fulfill(envelope(ROWS))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/315-${name}.png`, fullPage: true })
  const mainText = async () => page.locator('main').innerText()
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(collections|collection|common|access)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const q = () => new URLSearchParams(lastQuery)
  const keys = () => [...q().keys()].sort().join(',')
  const cellText = async (rowIndex, colId) =>
    (await page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`).innerText()).trim()
  const headers = async () =>
    (await page.locator('.ag-header-cell-text').allInnerTexts()).map((s) => s.trim())
  const load = async (path = ROUTE) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
  }
  const field = (label) => page.getByLabel(label, { exact: true })
  const search = async () => {
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForLoadState('networkidle')
  }

  // ---- 1. the landing query ----
  scenario = {}
  calls = 0
  await load()
  await page.locator('.ag-row').first().waitFor()
  await shot('landing')
  check('the screen queries on mount', calls === 1, `${calls} calls`)
  check(
    'it lands on TODAY by collection date, under the new names',
    q().get('CollectionDateFrom') === TODAY && q().get('CollectionDateTo') === TODAY,
    lastQuery,
  )
  check('…with the legacy FromDate/ToDate retired', !q().has('FromDate') && !q().has('ToDate'), lastQuery)
  check('…and no business range — it is open on landing', !q().has('BusinessDateFrom') && !q().has('BusinessDateTo'), lastQuery)
  check('…exactly the collection pair and the cap', keys() === 'CollectionDateFrom,CollectionDateTo,Limit', keys())
  check(
    'the toolbar shows the landing state: business ends empty, collection ends today',
    (await field('Business date from').inputValue()) === '' &&
      (await field('Business date to').inputValue()) === '' &&
      (await field('Collection date from').inputValue()) === TODAY &&
      (await field('Collection date to').inputValue()) === TODAY,
  )
  check(
    'no date end is `required` any more — every one is optional on the contract',
    await page.locator('form input[type="date"]').evaluateAll((els) => els.length === 4 && els.every((el) => !el.required)),
  )
  check('the Filtered chip is dark on landing', (await page.getByText('Filtered').count()) === 0)

  // ---- 2. the two date columns ----
  const defaultHeaders = await headers()
  check('Business Date is a DEFAULT column', defaultHeaders.includes('Business Date'), defaultHeaders.join(' | '))
  check('Collection Date is a DEFAULT column', defaultHeaders.includes('Collection Date'), defaultHeaders.join(' | '))
  check(
    '…side by side, the sales day first',
    defaultHeaders.indexOf('Collection Date') === defaultHeaders.indexOf('Business Date') + 1,
    defaultHeaders.join(' | '),
  )
  check('Sales Date stays in the tail — it is not the business column', !defaultHeaders.includes('Sales Date'))
  check('the sample’s business day is the date part only', (await cellText(0, 'businessDay')) === '2026-09-02', await cellText(0, 'businessDay'))
  check('the sample’s collection date is a date-time', (await cellText(0, 'collectedAt')) === '2026-09-12 10:15', await cellText(0, 'collectedAt'))
  check('a settlement receipt’s null business day is BLANK, not 0001-01-01', (await cellText(1, 'businessDay')) === '')
  check('a pre-049 day’s null business day is blank too', (await cellText(2, 'businessDay')) === '')

  const businessFilter = page.locator('.ag-floating-filter[col-id="businessDay"] input')
  await businessFilter.fill('2026-09-02')
  await page.waitForTimeout(900)
  check(
    'the floating filter matches the day the cell SHOWS',
    (await page.locator('.ag-row').count()) === 1 && (await cellText(0, 'collectionReceiptNo')) === '91234',
    `${await page.locator('.ag-row').count()} rows`,
  )
  await businessFilter.fill('')
  await page.waitForTimeout(900)
  check('…and clearing it brings every row back', (await page.locator('.ag-row').count()) === ROWS.length)
  await noRawKeys('grid')

  // ---- 3. the toolbar sends the ranges ----
  const before = calls
  await field('Business date from').fill('2026-09-01')
  await field('Business date to').fill('2026-09-10')
  await page.waitForTimeout(300)
  check('typing a business range fires NO query (a draft is not a search)', calls === before, `${calls} vs ${before}`)
  await field('Collection date from').fill('2026-09-12')
  await field('Collection date to').fill('2026-09-12')
  await search()
  check(
    'Search sends BOTH ranges together — the contract’s example',
    q().get('BusinessDateFrom') === '2026-09-01' &&
      q().get('BusinessDateTo') === '2026-09-10' &&
      q().get('CollectionDateFrom') === '2026-09-12' &&
      q().get('CollectionDateTo') === '2026-09-12',
    lastQuery,
  )
  check('…as bare days, no time part', !lastQuery.includes('T00') && !lastQuery.includes('%3A'), lastQuery)
  check('…and never the legacy pair', !q().has('FromDate') && !q().has('ToDate'))
  check('…and the Filtered chip lights', (await page.getByText('Filtered').count()) > 0)
  await shot('both-ranges')

  // An end alone, and the collection range cleared: asking about sales days only.
  await field('Business date to').fill('')
  await field('Collection date from').fill('')
  await field('Collection date to').fill('')
  await search()
  check(
    'an open-ended business range sends its one end, and the cleared collection range sends nothing',
    keys() === 'BusinessDateFrom,Limit' && q().get('BusinessDateFrom') === '2026-09-01',
    lastQuery,
  )

  // The collector ANDs beside the dates.
  await page.getByPlaceholder('Operator id').fill('COLL-9')
  await search()
  check(
    '"Collected by" rides beside the dates — no filter clears another',
    q().get('CollectorOperatorId') === 'COLL-9' && q().get('BusinessDateFrom') === '2026-09-01',
    lastQuery,
  )

  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    'Reset returns to the landing query — today by collection date, nothing else',
    keys() === 'CollectionDateFrom,CollectionDateTo,Limit' && q().get('CollectionDateFrom') === TODAY,
    lastQuery,
  )
  check(
    '…and the toolbar with it',
    (await field('Business date from').inputValue()) === '' &&
      (await field('Collection date from').inputValue()) === TODAY &&
      (await page.getByPlaceholder('Operator id').inputValue()) === '',
  )
  check('…and the chip goes dark', (await page.getByText('Filtered').count()) === 0)

  // The served-by pair: a caller with a landing scope sends it WITH the dates.
  scenario = { scoped: true }
  await load()
  check(
    'a default Served-by scope rides with the collection range on landing',
    q().get('ServedByKind') === 'MINE' && q().get('ServedById') === '4466' && q().get('CollectionDateFrom') === TODAY,
    lastQuery,
  )
  await field('Business date from').fill('2026-09-01')
  await search()
  check(
    '…and a business range added to it keeps the pair',
    q().get('ServedByKind') === 'MINE' && q().get('BusinessDateFrom') === '2026-09-01',
    lastQuery,
  )
  scenario = {}

  // ---- 4. the ACR scope disables and omits all four ----
  await load(`${ROUTE}?acr=01K5ACR0000000000000000001`)
  const dateInputs = page.locator('form input[type="date"]')
  check(
    'under ?acr= all four date ends are disabled and show nothing',
    await dateInputs.evaluateAll((els) => els.length === 4 && els.every((el) => el.disabled && el.value === '')),
  )
  check(
    '…and the scoped query sends NO date parameter at all',
    keys() === 'AcrId,Limit',
    lastQuery,
  )

  // ---- 5. the list's other states ----
  let release
  hold = new Promise((r) => (release = r))
  scenario = {}
  await page.goto(BASE + ROUTE)
  const loading = page.getByRole('status', { name: "Loading today's collections…" })
  await loading.first().waitFor({ timeout: 5000 }).catch(() => {})
  check('loading — the list says it is loading', (await loading.count()) > 0 && (await page.locator('.ag-root').count()) === 0)
  release()
  hold = null
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor()
  check('…and then draws the rows', (await page.locator('.ag-row').count()) === ROWS.length)

  // A filter that matches nothing is 200 with data: [] — the contract's "no new refusal".
  scenario = { list: 'empty' }
  await field('Business date from').fill('2026-09-10')
  await field('Business date to').fill('2026-09-01')
  await search()
  const emptyText = await mainText()
  check(
    'empty — a From later than its To is sent, and the honest empty state answers',
    q().get('BusinessDateFrom') === '2026-09-10' && emptyText.includes(EMPTY_TITLE) && (await page.locator('.ag-root').count()) === 0,
    lastQuery,
  )
  check('…whose hint names both date ranges', emptyText.includes('Widen the business or collection dates'))
  await shot('empty')

  const SERVER_FAULT = 'The OMS API encountered an unexpected error. Please try again.'
  scenario = { list: 'error' }
  await load()
  await page.getByText(SERVER_FAULT).first().waitFor({ timeout: 8000 }).catch(() => {})
  const errorText = await mainText()
  check('error — a 500 reads as a server fault, no grid', errorText.includes(SERVER_FAULT) && (await page.locator('.ag-root').count()) === 0, errorText.replace(/\n/g, ' ').slice(-160))
  check('…and never the empty state', !errorText.includes(EMPTY_TITLE))

  const REJECTED = 'The request was rejected by the server.'
  scenario = { list: 'refusal' }
  await load()
  await page.getByText(REJECTED).first().waitFor({ timeout: 8000 }).catch(() => {})
  const refusalText = await mainText()
  check(
    'refusal — the 400 binding failure reads as a rejection, not an empty day',
    refusalText.includes(REJECTED) && !refusalText.includes(EMPTY_TITLE) && (await page.locator('.ag-root').count()) === 0,
    refusalText.replace(/\n/g, ' ').slice(-160),
  )

  scenario = { list: 'forbidden' }
  await load()
  await page.getByText('Unexpected API error (HTTP 403).').first().waitFor({ timeout: 8000 }).catch(() => {})
  const forbiddenText = await mainText()
  check(
    'a bare 403 on the list is an error banner naming the status, never an empty list',
    (await page.locator('.ag-root').count()) === 0 && !forbiddenText.includes(EMPTY_TITLE) && forbiddenText.includes('Unexpected API error (HTTP 403).'),
    forbiddenText.replace(/\n/g, ' ').slice(-160),
  )
  await noRawKeys('states')

  scenario = { access403: true }
  await load()
  check('the probe refusing → the denied backstop', (await mainText()).includes(DENIED))

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
