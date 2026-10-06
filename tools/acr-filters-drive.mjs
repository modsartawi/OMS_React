// ACR filters + ACR number drive (spec 2423, ticket 425) — drives the REAL app in Chromium against
// STUBBED envelopes shaped exactly as oms ticket 425's `## Wire contract` records them:
// `GET CollectionWeb/Acrs` gains AmountFrom/AmountTo, ProfitCenter and CollectorText (PascalCase),
// accepts ServedByKind=ACCOUNTANT on ACRs only, takes AcrNumber as TEXT, and its rows (and deposit
// lines, and the ACR form) gain the server-formatted `acrNo`.
//
// ⚠️ Stubbed, never live: BackOffice 2426–2428 were not merged when this was written, and the
// assertions are about SPECIFIC rows — a new-form number, a legacy one, an older SIS.Api's row
// with no acrNo at all — which a live door will not produce on demand.
//
// Verifies ticket 425's screen Proof:
//   1. the ACR list opens BLANK: no request on landing, every box empty, Served by on the
//      caller's own collections (a collector) or on Everyone (an accountant), the "press
//      Search" state; Reset returns there without asking;
//   2. the toolbar's new filters reach the door under their contract names, empties never
//      sent, and the ACR No# goes as typed (a full number, a malformed one) — the server's
//      refusal of a malformed one shows through apiErrorMessage;
//   3. the Accountants group is offered on ACRs and travels as ACCOUNTANT, and is NOT offered
//      on Deposits;
//   4. the grid shows acrNo (new and legacy), falls back to acrNumber when absent, and its
//      header offers no sort that could scramble the server's order;
//   5. a deposit line and the ACR form header show acrNo, isolated left-to-right;
//   6. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/acr-filters-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/acrs'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

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

const ACCESS = { canOpenCollections: true, canOpenAcrs: true, canOpenDeposits: true, canOpenAttempts: true }

const ROSTER = {
  accountants: [{ staffId: '4466', displayName: 'ضحى الجعفري' }],
  collectors: [{ staffId: '6498', displayName: 'فهد القحطاني' }],
  supervisors: [],
}
const AS_COLLECTOR = { ...ROSTER, defaultScope: { kind: 'MINE', staffId: '6498', role: 'COLLECTOR', displayName: 'فهد القحطاني' } }
const AS_ACCOUNTANT = { ...ROSTER, defaultScope: { kind: 'MINE', staffId: '4466', role: 'ACCOUNTANT', displayName: 'ضحى الجعفري' } }

const ACR = {
  acrId: '01K6ACR0000000000000000001',
  acrNumber: 1,
  acrNo: '6498-2610-0001',
  label: '03/10/2026 - north round',
  collectorOperatorId: '6498',
  collectorName: 'فهد القحطاني',
  acrDate: '2026-10-03T00:00:00',
  status: 'CLOSED',
  createdAt: '2026-10-03T08:12:40',
  closedAt: '2026-10-03T23:59:00',
  closedBy: 'SYSTEM',
  closedByName: 'SYSTEM',
  linkedCollectionCount: 2,
  firstCollectedAt: '2026-10-03T10:15:00',
  lastCollectedAt: '2026-10-03T18:40:00',
  cashSalesTotal: 1000,
  settlementTotal: 0,
  bankedTotal: 1000,
  cardTotalSum: 0,
  cardTransactionCountSum: 0,
  depositId: '',
  depositNumber: 0,
  depositStatus: '',
}
/** The server's order, kept: month newest first, then number; legacy last. */
const ROWS = [
  { ...ACR, acrId: '01K6ACR0000000000000000002', acrNumber: 2, acrNo: '6498-2610-0002' },
  ACR,
  { ...ACR, acrId: '01K6ACR0000000000000000003', acrNumber: 7, acrNo: '6498-2609-0007', acrDate: '2026-09-30T00:00:00' },
  // A legacy ACR: its acrNo IS the plain number.
  { ...ACR, acrId: '01K6ACR0000000000000000004', acrNumber: 1834, acrNo: '1834', acrDate: '2026-09-20T00:00:00' },
  // An older SIS.Api's row: no acrNo on the wire at all.
  (({ acrNo: _x, ...older }) => ({ ...older, acrId: '01K6ACR0000000000000000005', acrNumber: 41 }))(ACR),
]

const DEPOSIT = {
  depositId: '06GDAB7RKXGGYTJ7Y9NGBVH2D6',
  depositNumber: 5501,
  collectorOperatorId: '6498',
  collectorName: 'فهد القحطاني',
  bankCode: 'RB',
  bankName: 'Riyad Bank',
  status: 'POSTED',
  depositedAt: '2026-10-04T11:30:00',
  createdAt: '2026-10-04T11:34:12',
  calculatedAmount: 1250,
  realAmount: 1250,
  diffAmount: 0,
  reasonCode: '',
  noteText: '',
  voidedBy: '',
  voidedAt: '0001-01-01T00:00:00',
  voidReason: '',
  lines: [
    { acrId: ACR.acrId, acrNumber: 1, acrNo: '6498-2610-0001', acrDate: '2026-10-03T00:00:00', netCollectedAtDeposit: 1000, netCollectedNow: 1000, drift: 0, hasDrift: false },
    { acrId: '01K6ACR0000000000000000004', acrNumber: 1834, acrNo: '1834', acrDate: '2026-09-20T00:00:00', netCollectedAtDeposit: 200, netCollectedNow: 200, drift: 0, hasDrift: false },
    // An older SIS.Api's line: no acrNo, the bare count shows.
    { acrId: '01K6ACR0000000000000000005', acrNumber: 41, acrDate: '2026-09-02T00:00:00', netCollectedAtDeposit: 50, netCollectedNow: 50, drift: 0, hasDrift: false },
  ],
  attachments: [],
}

let options = AS_COLLECTOR
let scenario = {}
let acrsCalls = 0
let lastQuery = ''
let DOCS = {}

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
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'CollectionWeb/AssignmentOptions') return route.fulfill(envelope(options))
    if (path === 'CollectionWeb/Acrs') {
      acrsCalls++
      lastQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      if (scenario.acrs === 'malformed')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The ACR number is not in a form the inquiry reads.',
            errors: [{ errorCode: 'AcrNumberMalformed', internalErrorCode: '', errorMessage: 'The ACR number is not in a form the inquiry reads.' }],
          }),
        )
      return route.fulfill(envelope(ROWS))
    }
    if (path === 'CollectionWeb/Deposits') return route.fulfill(envelope({ rows: [DEPOSIT], balances: [] }))
    if (path.startsWith('CollectionWeb/AcrForm/')) {
      const id = decodeURIComponent(path.slice('CollectionWeb/AcrForm/'.length))
      if (DOCS[id]) return route.fulfill(envelope(DOCS[id]))
      return route.fulfill(envelope(null, { status: 400, success: false, message: 'No such ACR.' }))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/425-${name}.png`, fullPage: true })
  const mainText = async () => page.locator('main').innerText()
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(acrs|deposits|collection|servedBy|common|access)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const q = () => new URLSearchParams(lastQuery)
  const keys = () => [...q().keys()].sort().join(',')
  const field = (label) => page.getByLabel(label, { exact: true })
  const picker = () => page.locator('form select')
  const cellText = async (rowIndex, colId) =>
    (await page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`).innerText()).trim()
  // ⚠️ Waits on the Acrs RESPONSE: the page is already idle when Search is clicked, so a
  // load-state wait would return before the request left.
  const search = async () => {
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/CollectionWeb/Acrs')),
      page.getByRole('button', { name: 'Search', exact: true }).click(),
    ])
    await page.waitForTimeout(300)
  }
  const land = async () => {
    acrsCalls = 0
    lastQuery = ''
    await page.goto(BASE + ROUTE)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Search', exact: true }).waitFor()
  }

  // The ACR form documents, out of the app's OWN fixture module.
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  DOCS = await page.evaluate(async () => {
    const a = await import('/src/features/collection/inquiry/acr-fixture.ts')
    return Object.fromEntries(a.ACR_SCENARIOS.map((s) => [s.key, s.document]))
  })

  // ---- 1. the blank landing ----
  options = AS_COLLECTOR
  await land()
  await shot('landing')
  check('landing — NO request until Search', acrsCalls === 0, `${acrsCalls} calls`)
  check(
    'landing — every date end is empty',
    await page.locator('form input[type="date"]').evaluateAll((els) => els.length === 4 && els.every((el) => el.value === '')),
  )
  check(
    'landing — the new boxes are empty too',
    (await field('Amount from').inputValue()) === '' &&
      (await field('Amount to').inputValue()) === '' &&
      (await field('Profit center').inputValue()) === '' &&
      (await page.getByPlaceholder('Id or name').inputValue()) === '' &&
      (await page.getByPlaceholder('Number').inputValue()) === '',
  )
  check('landing — a collector lands on their own collections (Served by keeps its default)', (await picker().inputValue()) === 'MINE:6498', await picker().inputValue())
  check('landing — Status stays All', (await page.locator('[role="radio"][data-status="ALL"]').getAttribute('aria-checked')) === 'true')
  check('landing — the grid says to press Search, and there is no grid', (await mainText()).includes('Press Search to see ACRs') && (await page.locator('.ag-root').count()) === 0)
  check('landing — the Filtered chip is dark', (await page.getByText('Filtered', { exact: true }).count()) === 0)
  await noRawKeys('landing')

  await search()
  check('Search as it stands — one request, the scope and the cap, no date', acrsCalls === 1 && keys() === 'Limit,ServedById,ServedByKind' && q().get('ServedByKind') === 'MINE', lastQuery)
  check('…and the chip stays dark: that IS the landing query', (await page.getByText('Filtered', { exact: true }).count()) === 0)
  await search()
  check('a repeated Search re-asks the door', acrsCalls === 2, `${acrsCalls} calls`)

  options = AS_ACCOUNTANT
  await land()
  check('an ACCOUNTANT still lands on the estate on ACRs (Everyone), not on their own', (await picker().inputValue()) === '', await picker().inputValue())
  check('…and asks nothing either', acrsCalls === 0)

  // ---- 2 + 3. the new filters, the text number, the Accountants group ----
  options = AS_COLLECTOR
  await land()
  const groups = await picker().locator('optgroup').evaluateAll((els) => els.map((el) => el.label))
  check('Served by on ACRs offers the Accountants group', groups.includes('Accountants'), groups.join(', '))
  await field('Amount from').fill('1000')
  await field('Amount to').fill(' 2500.50 ')
  await field('Profit center').fill('019')
  await page.getByPlaceholder('Id or name').fill('فهد')
  await page.getByPlaceholder('Number').fill(' 6498-2610-0001 ')
  await picker().selectOption('ACCOUNTANT:4466')
  await page.waitForTimeout(300)
  check('typing the filters fires NO query (a draft is not a search)', acrsCalls === 0)
  await search()
  check(
    'Search sends the 2426 filters under their PascalCase names',
    q().get('AmountFrom') === '1000' &&
      q().get('AmountTo') === '2500.50' &&
      q().get('ProfitCenter') === '019' &&
      q().get('CollectorText') === 'فهد',
    lastQuery,
  )
  check('…the ACR No# as typed, trimmed — never parsed, never AcrId', q().get('AcrNumber') === '6498-2610-0001' && !q().has('AcrId'), lastQuery)
  check('…and the accountant as the ordinary ACCOUNTANT pair', q().get('ServedByKind') === 'ACCOUNTANT' && q().get('ServedById') === '4466', lastQuery)
  check('…with no date', !lastQuery.includes('Date'), lastQuery)
  check('…and the Filtered chip lights', (await page.getByText('Filtered', { exact: true }).count()) > 0)
  await shot('filtered')

  await field('Amount from').fill('')
  await field('Profit center').fill('   ')
  await page.getByPlaceholder('Id or name').fill('')
  await search()
  check('an emptied box is never sent', !q().has('AmountFrom') && !q().has('ProfitCenter') && !q().has('CollectorText') && q().get('AmountTo') === '2500.50', lastQuery)

  scenario = { acrs: 'malformed' }
  await page.getByPlaceholder('Number').fill('6498/2610')
  await search()
  await page.getByText('The ACR number is not in a form the inquiry reads.').first().waitFor({ timeout: 8000 }).catch(() => {})
  check('a malformed number is SENT (the client does not parse it)', q().get('AcrNumber') === '6498/2610', lastQuery)
  check(
    '…and the server’s refusal shows as its own message, not an empty list',
    (await mainText()).includes('The ACR number is not in a form the inquiry reads.') && !(await mainText()).includes('No ACRs match this search'),
  )
  scenario = {}

  const callsBeforeReset = acrsCalls
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForTimeout(300)
  check(
    'Reset returns to the un-searched landing — no request, every box empty, the scope back',
    acrsCalls === callsBeforeReset &&
      (await mainText()).includes('Press Search to see ACRs') &&
      (await field('Amount to').inputValue()) === '' &&
      (await page.getByPlaceholder('Number').inputValue()) === '' &&
      (await picker().inputValue()) === 'MINE:6498',
    `${acrsCalls} vs ${callsBeforeReset}`,
  )
  await noRawKeys('toolbar')

  // ---- 3b. Deposits does NOT offer accountants ----
  await page.goto(BASE + '/collection/deposits')
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor()
  const depositGroups = await page.locator('form select').locator('optgroup').evaluateAll((els) => els.map((el) => el.label))
  check('Served by on Deposits does NOT offer the Accountants group', !depositGroups.includes('Accountants'), depositGroups.join(', '))

  // ---- 5a. a deposit line keeps the number it was deposited under ----
  const lineNumbers = await page.locator('table tbody th[scope="row"]').allInnerTexts()
  check(
    'a deposit line shows its acrNo — full, legacy, and the bare count from an older SIS.Api',
    JSON.stringify(lineNumbers.map((s) => s.trim())) === JSON.stringify(['6498-2610-0001', '1834', '41']),
    JSON.stringify(lineNumbers),
  )
  check(
    '…each isolated left-to-right, whole',
    (await page.locator('table tbody th[scope="row"] bdi[dir="ltr"]').count()) === 3,
  )
  await shot('deposit-lines')

  // ---- 4. the grid's ACR No# ----
  await land()
  await search()
  await page.locator('.ag-row').first().waitFor()
  const shown = []
  for (let i = 0; i < ROWS.length; i++) shown.push(await cellText(i, 'acrNo'))
  check(
    'the grid shows acrNo in the SERVER’s order — new, then legacy, then an older row’s bare count',
    JSON.stringify(shown) === JSON.stringify(['6498-2610-0002', '6498-2610-0001', '6498-2609-0007', '1834', '41']),
    JSON.stringify(shown),
  )
  const header = page.locator('.ag-header-cell[col-id="acrNo"][role="columnheader"]')
  check('the ACR No# column is headed "ACR No#"', (await header.innerText()).includes('ACR No#'))
  await header.locator('.ag-header-cell-label').click()
  await page.waitForTimeout(300)
  const afterClick = []
  for (let i = 0; i < ROWS.length; i++) afterClick.push(await cellText(i, 'acrNo'))
  check('clicking its header does NOT re-sort: no client order over the server’s', JSON.stringify(afterClick) === JSON.stringify(shown), JSON.stringify(afterClick))
  const filter = page.locator('.ag-floating-filter[col-id="acrNo"] input')
  await filter.fill('2610')
  await page.waitForTimeout(700)
  check('its floating filter matches the number as shown, dashes and all', (await page.locator('.ag-row').count()) === 2)
  await filter.fill('')
  await page.waitForTimeout(500)
  await shot('grid')
  await noRawKeys('grid')

  // ---- 5b. the ACR form header ----
  const serialCell = () => page.locator('.acr-doc').first().locator('.acr-meta-cell').nth(1)
  await page.goto(`${BASE}/collection/acr/three-pages`)
  await page.waitForLoadState('networkidle')
  await page.locator('.acr-doc').first().waitFor()
  check('the form header prints a new ACR’s full number', ((await serialCell().textContent()) ?? '').includes('40219-2606-0003'), await serialCell().textContent())
  check('…isolated left-to-right, so its dashes keep their order on the RTL sheet', (await serialCell().locator('bdi[dir="ltr"]').innerText()) === '40219-2606-0003')
  await shot('form-new')
  await page.goto(`${BASE}/collection/acr/empty`)
  await page.waitForLoadState('networkidle')
  await page.locator('.acr-doc').first().waitFor()
  check('the form header prints a legacy ACR’s plain number', ((await serialCell().textContent()) ?? '').includes('4482'), await serialCell().textContent())

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
