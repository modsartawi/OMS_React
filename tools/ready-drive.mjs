// Ready for collection drive (spec 308, ticket 317) — drives the REAL app in Chromium against
// STUBBED envelopes shaped exactly as BackOffice 1994 and 1995 record them under `## Web contract`:
// `CollectionWeb/Access` gains `canOpenReady`, and `GET CollectionWeb/Ready` lists closed days and
// prepared receipts, oldest first, with CollectorId / ServedByKind+ServedById / BusinessDateFrom/To.
//
// ⚠️ Stubbed, never live: no SIS.Api with 1994 is up for this wave, and the assertions are about
// SPECIFIC rows — a day whose Z has not reached head office, a Bahraini day, a receipt whose entry
// is gone — which a live door will not produce on demand.
//
// Verifies ticket 317's screen Proof:
//   1. the menu: the leaf appears on its own grant, and a collector supervisor (1995's sample
//      answer) sees the five read screens and no act; a session without the grant is refused by
//      the in-page gate on a hand-typed URL;
//   2. the landing query: once, no dates, scoped to the caller's own branches (default-to-mine);
//   3. the columns: the contract sample's cells, the server's storeText as sent, a dash for
//      every null, 3 decimals for BHD, no row action;
//   4. the toolbar: business date (and the receipts-hidden note), collector, Served by — each only
//      on Search; Reset returns to the landing;
//   5. loading, empty, error (500), refusal (bare 403 from the door, the Served-by resolver's 400
//      envelope, and the 400 binding failure);
//   6. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/ready-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/ready'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = null } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

/** 1995's COLLECTOR_SUPERVISOR sample answer, verbatim. */
const COLLECTOR_SUPERVISOR = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenAssignment: false,
  canOpenSettlement: false,
  canSuperviseSettlement: false,
  canOpenReady: true,
}
/** An accountant: the Ready grant and nothing else of this area's. */
const READY_ONLY = {
  canOpenCollections: false,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenAssignment: false,
  canOpenSettlement: false,
  canSuperviseSettlement: false,
  canOpenReady: true,
}

/** 1994's sample rows, VERBATIM. */
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
}
const RECEIPT = {
  kind: 'SETTLEMENT',
  storeId: 'P019',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  currencyKey: 'SAR',
  businessDay: null,
  shiftId: '',
  zNumber: null,
  settlementDocumentId: '01K5ZC1A2B3C4D5E6F7G8H9J0K',
  entryNumber: 143,
  cashToHandOver: 120.5,
  surplusDeducted: null,
  readySince: '2026-09-23T10:41:00',
  daysWaiting: 2,
}
/** A day whose Z has not reached head office — null figures. */
const DAY_NO_Z = {
  ...DAY,
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X1A',
  businessDay: '2026-09-24T00:00:00',
  zNumber: null,
  cashToHandOver: null,
  surplusDeducted: null,
  readySince: '2026-09-24T22:58:00',
  daysWaiting: 1,
}
/** A Bahraini day, no profit center recorded — the server sends the code alone. */
const DAY_BHD = {
  ...DAY,
  storeId: 'B004',
  storeName: 'Al-Dawaa Manama',
  profitCenter: '',
  storeText: 'B004',
  currencyKey: 'BHD',
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X2B',
  zNumber: 77,
  cashToHandOver: 95.255,
  surplusDeducted: 0,
  readySince: '2026-09-21T23:30:00',
  daysWaiting: 4,
}
const ROWS = [DAY, DAY_BHD, RECEIPT, DAY_NO_Z]

let access = READY_ONLY
let defaultScope = { kind: 'MINE', staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى' }
let scenario = {}
let calls = 0
let lastQuery = ''
/** Held open to show a loading state; released by the scenario. */
let hold = null

async function run() {
  const browser = await chromium.launch()
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
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(access))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(
        envelope({
          accountants: [{ staffId: '4466', displayName: 'ضحى' }],
          collectors: [{ staffId: 'COLL-9', displayName: 'فهد القحطاني' }],
          supervisors: [],
          defaultScope,
        }),
      )
    if (path === 'CollectionWeb/Ready') {
      calls++
      lastQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      if (hold) await hold
      if (scenario.list === 'error')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The inquiry failed.' }))
      // The contract's 403: the session lacks CollectionReady — bare, no body.
      if (scenario.list === 'forbidden') return route.fulfill({ status: 403, body: '' })
      // The binding 400 (ProblemDetails, before the handler).
      if (scenario.list === 'binding')
        return route.fulfill({
          status: 400,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            title: 'One or more validation errors occurred.',
            status: 400,
            errors: { BusinessDateFrom: ["The value 'x' is not valid."] },
          }),
        })
      // The shared Served-by resolver's refusal — an envelope with errors[0].errorCode.
      if (scenario.list === 'servedByRefusal')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'A Served-by id needs a Kind.',
            errors: [{ errorCode: 'ServedByKindRequired', message: 'A Served-by id needs a Kind.' }],
          }),
        )
      if (scenario.list === 'empty') return route.fulfill(envelope([]))
      return route.fulfill(envelope(ROWS))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/317-${name}.png`, fullPage: true })
  const mainText = async () => page.locator('main').innerText()
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(ready|collection|common|access|servedBy|grid)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const cell = async (rowId, colId) =>
    (await page.locator(`.ag-row[row-id="${rowId}"] [col-id="${colId}"]`).first().innerText()).trim()
  const headers = async () => (await page.locator('.ag-header-cell-text').allInnerTexts()).map((s) => s.trim())
  const load = async (path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
  }
  const field = (label) => page.getByLabel(label, { exact: true })
  const search = async () => {
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForLoadState('networkidle')
  }
  const q = () => new URLSearchParams(lastQuery)
  const keys = () => [...q().keys()].sort().join(',')
  const readLeaf = () => page.getByRole('link', { name: 'Ready for Collection' })
  const readLinks = async () =>
    (await page.getByRole('link', { name: /^Cash Collections$|^ACRs$|^Deposits$|^Collection Attempts$|^Ready for Collection$/ }).all()).length
  const actLinks = async () =>
    (await page.getByRole('link', { name: /^Collection Assignment$|^Settlement/ }).all()).length

  // ---- 1. the menu and the gate ----
  access = READY_ONLY
  await load(ROUTE)
  await page.locator('.ag-row').first().waitFor()
  check('menu — the Ready grant alone lights the one leaf', (await readLeaf().count()) === 1 && (await readLinks()) === 1, `${await readLinks()} read links`)

  access = COLLECTOR_SUPERVISOR
  defaultScope = null
  await load(ROUTE)
  await page.locator('.ag-row').first().waitFor()
  check('menu — a collector supervisor sees the five read screens', (await readLinks()) === 5, `${await readLinks()} links`)
  check('menu — …and no act: no Assignment, no Settlement', (await actLinks()) === 0, `${await actLinks()} act links`)
  check('collector supervisor — lands on the estate (no roster row), every collector visible', !q().has('ServedByKind'), lastQuery)
  check('collector supervisor — no row action, no selection, no button inside any row', (await page.locator('.ag-row button').count()) === 0)
  await shot('supervisor')

  access = { ...COLLECTOR_SUPERVISOR, canOpenReady: false }
  await load(ROUTE)
  const denied = await mainText()
  check('gate — without canOpenReady the leaf is hidden', (await readLeaf().count()) === 0)
  check('gate — a hand-typed URL is refused by the in-page gate, no query sent', denied.includes('No access to this screen') && (await page.locator('.ag-root').count()) === 0, denied.replace(/\n/g, ' ').slice(0, 100))

  // ---- 2. the landing ----
  access = READY_ONLY
  defaultScope = { kind: 'MINE', staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى' }
  calls = 0
  await load(ROUTE)
  await page.locator('.ag-row').first().waitFor()
  await shot('landing')
  check('landing — queries once on mount', calls === 1, `${calls} calls`)
  check(
    'landing — scoped to the accountant’s own branches, no date, the cap',
    keys() === 'Limit,ServedById,ServedByKind' && q().get('ServedByKind') === 'MINE' && q().get('ServedById') === '4466',
    lastQuery,
  )
  check('landing — no receipts-hidden note', !(await mainText()).includes('Prepared settlement receipts have no business date'))
  check('landing — the Filtered chip is not lit', !(await page.locator('form').innerText()).includes('Filtered'))

  // ---- 3. the columns ----
  const hs = await headers()
  const expected = ['Waiting', 'Profit Center (Store)', 'Store Name', 'Business Date', 'Z No#', 'Shortage Entry', 'Cash to Hand Over', 'Surplus Deducted', 'Ready Since', 'Days Waiting']
  check('columns — the landing grid, in reading order', expected.every((h, i) => (hs[i] ?? '').startsWith(h)), hs.join(' | '))
  check('columns — a mixed SAR/BHD list promotes Currency and keeps the money headers bare', hs.includes('Currency') && hs.includes('Cash to Hand Over'), hs.join(' | '))

  const dayId = `DAY:${DAY.shiftId}`
  const receiptId = `SETTLEMENT:${RECEIPT.settlementDocumentId}`
  const noZId = `DAY:${DAY_NO_Z.shiftId}`
  const bhdId = `DAY:${DAY_BHD.shiftId}`
  check('day — the kind reads as a closed day', (await cell(dayId, 'kind')) === 'Closed day')
  check('day — storeText as the server sent it', (await cell(dayId, 'storeText')) === 'PH-019 (P019)')
  check('day — business day, Z, figures, readySince, days waiting',
    (await cell(dayId, 'businessDay')) === '2026-09-20' &&
      (await cell(dayId, 'zNumber')) === '412' &&
      (await cell(dayId, 'cashToHandOver')) === '1,000.50' &&
      (await cell(dayId, 'surplusDeducted')) === '250.00' &&
      (await cell(dayId, 'readySince')) === '2026-09-20 23:05' &&
      (await cell(dayId, 'daysWaiting')) === '5',
  )
  check('day — no shortage entry: a dash', (await cell(dayId, 'entryNumber')) === '—')
  check('receipt — reads as a prepared receipt with its shortage entry and amount',
    (await cell(receiptId, 'kind')) === 'Prepared settlement receipt' &&
      (await cell(receiptId, 'entryNumber')) === '143' &&
      (await cell(receiptId, 'cashToHandOver')) === '120.50',
  )
  check('receipt — a dash for its business day, Z and surplus (absences, not zeros)',
    (await cell(receiptId, 'businessDay')) === '—' &&
      (await cell(receiptId, 'zNumber')) === '—' &&
      (await cell(receiptId, 'surplusDeducted')) === '—',
  )
  check('day without its Z — a dash for the Z and both figures, never 0.00',
    (await cell(noZId, 'zNumber')) === '—' &&
      (await cell(noZId, 'cashToHandOver')) === '—' &&
      (await cell(noZId, 'surplusDeducted')) === '—',
  )
  check('BHD day — three decimals, a real zero stays a zero, the store code alone',
    (await cell(bhdId, 'cashToHandOver')) === '95.255' &&
      (await cell(bhdId, 'surplusDeducted')) === '0.000' &&
      (await cell(bhdId, 'storeText')) === 'B004',
  )
  check('the server’s order is kept (oldest first as sent)',
    (await page.locator(".ag-row").evaluateAll((rows) =>
      rows.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((r) => r.getAttribute('row-id')),
    )).join(',') === [dayId, bhdId, receiptId, noZId].join(','),
  )

  await page.getByRole('button', { name: 'More columns' }).click()
  await page.waitForTimeout(300)
  const more = await headers()
  check('more columns — the raw parts and both row keys join the tail', ['Store Code', 'Profit Center', 'Currency', 'Shift Id', 'Settlement Document Id'].every((h) => more.includes(h)), more.join(' | '))
  check('more columns — the raw profit center as sent', (await cell(dayId, 'profitCenter')) === 'PH-019')
  await page.getByRole('button', { name: 'More columns' }).click()
  await noRawKeys('grid')

  // ---- 4. the toolbar ----
  const picker = page.locator('form select')
  check('toolbar — the Served-by picker lands on the caller’s own scope', (await picker.count()) === 1 && (await picker.inputValue()) === 'MINE:4466', await picker.inputValue())
  const groups = await picker.locator('optgroup').evaluateAll((els) => els.map((el) => el.label))
  check('toolbar — …offering Accountants, on the assignment reading', groups.includes('Accountants'), groups.join(', '))
  check('toolbar — no collection-date box: nothing here has been collected', (await page.getByLabel('Collection date from').count()) === 0)

  calls = 0
  await picker.selectOption('ACCOUNTANT:4466')
  await page.getByPlaceholder('Staff id').fill('COLL-9')
  check('toolbar — a draft does not query', calls === 0)
  await search()
  check(
    'toolbar — the contract’s example: the accountant pair, the assigned collector ANDed beside it',
    q().get('ServedByKind') === 'ACCOUNTANT' && q().get('ServedById') === '4466' && q().get('CollectorId') === 'COLL-9' && !q().has('BusinessDateFrom'),
    lastQuery,
  )
  check('toolbar — the Filtered chip lights', (await page.locator('form').innerText()).includes('Filtered'))

  await field('Business date from').fill('2026-09-01')
  await search()
  check('toolbar — a business date end travels alone, as typed', q().get('BusinessDateFrom') === '2026-09-01' && !q().has('BusinessDateTo'), lastQuery)
  check('toolbar — …and the screen says receipts are not listed under a business date', (await mainText()).includes('Prepared settlement receipts have no business date'))
  await shot('filtered')

  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check('toolbar — Reset returns to the landing query', keys() === 'Limit,ServedById,ServedByKind' && q().get('ServedByKind') === 'MINE', lastQuery)
  check('toolbar — …clearing the boxes and the note', (await field('Business date from').inputValue()) === '' && !(await mainText()).includes('Prepared settlement receipts have no business date'))
  await noRawKeys('toolbar')

  // ---- 5. the list's other states ----
  let release
  hold = new Promise((r) => (release = r))
  scenario = {}
  await page.goto(BASE + ROUTE)
  const loading = page.getByRole('status', { name: 'Loading what is ready for collection…' })
  await loading.first().waitFor({ timeout: 5000 }).catch(() => {})
  check('loading — the list says it is loading, no grid yet', (await loading.count()) > 0 && (await page.locator('.ag-root').count()) === 0)
  release()
  hold = null
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor()

  scenario = { list: 'empty' }
  await load(ROUTE)
  const emptyText = await mainText()
  check('empty — nothing waiting is the honest empty state, not an error', emptyText.includes('Nothing is waiting for a collector') && (await page.locator('.ag-root').count()) === 0)
  await shot('empty')

  const SERVER_FAULT = 'The OMS API encountered an unexpected error. Please try again.'
  scenario = { list: 'error' }
  await load(ROUTE)
  await page.getByText(SERVER_FAULT).first().waitFor({ timeout: 8000 }).catch(() => {})
  const errorText = await mainText()
  check('error — a 500 reads as a server fault, no grid, never the empty state', errorText.includes(SERVER_FAULT) && !errorText.includes('Nothing is waiting') && (await page.locator('.ag-root').count()) === 0, errorText.replace(/\n/g, ' ').slice(-160))

  scenario = { list: 'forbidden' }
  await load(ROUTE)
  await page.getByText('not allowed to read').first().waitFor({ timeout: 8000 }).catch(() => {})
  const forbiddenText = await mainText()
  check('refusal — the door’s bare 403 reads as a refusal, not "unexpected (HTTP 403)"', forbiddenText.includes('Your account is not allowed to read the ready-for-collection list') && !forbiddenText.includes('HTTP 403') && (await page.locator('.ag-root').count()) === 0, forbiddenText.replace(/\n/g, ' ').slice(-160))
  await shot('refused')

  scenario = { list: 'servedByRefusal' }
  await load(ROUTE)
  await page.getByText('A Served-by id needs a Kind.').first().waitFor({ timeout: 8000 }).catch(() => {})
  const sbText = await mainText()
  check('refusal — the Served-by resolver’s 400 envelope shows the server’s own message', sbText.includes('A Served-by id needs a Kind.') && !sbText.includes('Nothing is waiting'), sbText.replace(/\n/g, ' ').slice(-160))

  scenario = { list: 'binding' }
  await load(ROUTE)
  await page.getByText('The request was rejected by the server.').first().waitFor({ timeout: 8000 }).catch(() => {})
  const bindText = await mainText()
  check('refusal — the 400 binding failure reads as a rejection, not an empty list', bindText.includes('The request was rejected by the server.') && !bindText.includes('Nothing is waiting'), bindText.replace(/\n/g, ' ').slice(-160))
  await noRawKeys('states')
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
