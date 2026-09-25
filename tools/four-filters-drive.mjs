// ACRs · Deposits · Attempts four-filter drive (spec 308, ticket 316) — drives the REAL app in
// Chromium against STUBBED envelopes shaped exactly as BackOffice 1993 records them under
// `## Web contract`: the three doors gain 1992's BusinessDateFrom/To + CollectionDateFrom/To (the web
// stops sending the legacy FromDate/ToDate), the ACR-number / deposit-number boxes reach AcrNumber /
// DepositNumber, Attempts gains the Served-by pair, the ACR row gains firstCollectedAt /
// lastCollectedAt, and each deposit line gains acrDate.
//
// ⚠️ Stubbed, never live: no SIS.Api with 1993 is up for this wave, and the assertions are about
// SPECIFIC rows — an ACR collected across two days, an idle ACR, a deposit banking two ACRs dated
// weeks apart — which a live door will not produce on demand.
//
// Verifies ticket 316's screen Proof, on each of the three screens:
//   1. the landing query is today..today on the window the screen always had — the ACR date
//      (business) on ACRs, deposited-at / attempt time (collection) on the other two — under the
//      new names, with no legacy FromDate/ToDate, and four optional date ends in the toolbar;
//   2. Business Date and Collection Date are default columns, side by side; the multi-valued one
//      draws as a span of days (one date when they share a day, blank when there is none);
//   3. the toolbar sends both ranges, an end alone, the number box (digits only — a non-digit box
//      does not search), and on Attempts the Served-by pair beside the collector — each only on
//      Search; Reset returns to the landing query;
//   4. loading, empty (a From later than its To), error (500), refusal (the 400 binding failure,
//      and on Attempts the Served-by resolver's 400 envelope);
//   5. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/four-filters-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

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

/** 1993's ACR sample, VERBATIM — dated the 2nd, collected on the 5th and the 12th. */
const ACR_SAMPLE = {
  acrId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
  acrNumber: 1207,
  label: '02/09/2026 - north round',
  collectorOperatorId: 'COLL-9',
  collectorName: 'فهد القحطاني',
  acrDate: '2026-09-02T00:00:00',
  status: 'CLOSED',
  createdAt: '2026-09-05T08:12:40',
  closedAt: '2026-09-12T23:59:00.31',
  closedBy: 'SYSTEM',
  closedByName: 'SYSTEM',
  linkedCollectionCount: 2,
  firstCollectedAt: '2026-09-05T10:15:00',
  lastCollectedAt: '2026-09-12T23:40:00',
  cashSalesTotal: 350.5,
  settlementTotal: 0.0,
  bankedTotal: 350.5,
  cardTotalSum: 0.0,
  cardTransactionCountSum: 0,
  depositId: '',
  depositNumber: 0,
  depositStatus: '',
}
const ACR_ROWS = [
  ACR_SAMPLE,
  // An idle ACR: no collection, so no collected-at at all.
  {
    ...ACR_SAMPLE,
    acrId: '01K5YQ2M8N3P4R5S6T7V8W9X01',
    acrNumber: 1208,
    status: 'OPEN',
    linkedCollectionCount: 0,
    firstCollectedAt: null,
    lastCollectedAt: null,
  },
  // Both collections on one day: one date, not a span.
  {
    ...ACR_SAMPLE,
    acrId: '01K5YQ2M8N3P4R5S6T7V8W9X02',
    acrNumber: 1209,
    firstCollectedAt: '2026-09-12T08:00:00',
    lastCollectedAt: '2026-09-12T23:40:00',
  },
]

/** 1993's deposit sample, VERBATIM — two ACRs dated the 10th of September and the 20th of August. */
const DEPOSIT_SAMPLE = {
  depositId: '06GDAB7RKXGGYTJ7Y9NGBVH2D6',
  depositNumber: 5501,
  collectorOperatorId: 'COLL-9',
  collectorName: 'فهد القحطاني',
  bankCode: 'RB',
  bankName: 'Riyad Bank',
  status: 'POSTED',
  depositedAt: '2026-09-21T11:30:00',
  createdAt: '2026-09-21T11:34:12',
  calculatedAmount: 250.0,
  realAmount: 250.0,
  diffAmount: 0.0,
  reasonCode: '',
  noteText: '',
  voidedBy: '',
  voidedAt: '0001-01-01T00:00:00',
  voidReason: '',
  lines: [
    {
      acrId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
      acrNumber: 1207,
      acrDate: '2026-09-10T00:00:00',
      netCollectedAtDeposit: 200.0,
      netCollectedNow: 200.0,
      drift: 0.0,
      hasDrift: false,
    },
    {
      acrId: '01K5YQ3A1B2C3D4E5F6G7H8J9K',
      acrNumber: 1188,
      acrDate: '2026-08-20T00:00:00',
      netCollectedAtDeposit: 50.0,
      netCollectedNow: 50.0,
      drift: 0.0,
      hasDrift: false,
    },
  ],
  attachments: [
    {
      attachmentId: '01K5YQ4X5Y6Z7A8B9C0D1E2F3G',
      url: 'https://mobile.example/slips/5501.jpg',
      fileName: 'slip.jpg',
      createdAt: '2026-09-21T11:34:12',
    },
  ],
}
const DEPOSIT_ROWS = [
  DEPOSIT_SAMPLE,
  // One ACR only: one date.
  {
    ...DEPOSIT_SAMPLE,
    depositId: '06GDAB7RKXGGYTJ7Y9NGBVH2D7',
    depositNumber: 5502,
    lines: [DEPOSIT_SAMPLE.lines[0]],
    attachments: [],
  },
]
const BALANCES = [
  {
    collectorOperatorId: 'COLL-9',
    collectorName: 'فهد القحطاني',
    depositCount: 1,
    totalCalculated: 250.0,
    totalReal: 250.0,
    outstanding: 0.0,
  },
]

/** 1993's attempt sample, VERBATIM — came on the 5th for the 2nd. */
const ATTEMPT_ROWS = [
  {
    attemptId: '01K5YQ5H6J7K8M9N0P1Q2R3S4T',
    collectorStaffId: 'COLL-9',
    collectorName: 'فهد القحطاني',
    storeCode: 'P019',
    storeName: 'Al-Dawaa P019',
    shiftId: '',
    businessDay: '2026-09-02T00:00:00',
    attemptTime: '2026-09-05T10:15:00',
    reasonCode: 'NOT_PREPARED',
    reasonText: 'branch had not closed the day',
  },
]

const SCREENS = {
  acrs: {
    route: '/collection/acrs',
    door: 'CollectionWeb/Acrs',
    rows: () => ACR_ROWS,
    empty: () => [],
    loading: "Loading today's ACRs…",
    emptyTitle: 'No ACRs in this period',
    landingKeys: 'BusinessDateFrom,BusinessDateTo,Limit',
    landingBusiness: true,
  },
  deposits: {
    route: '/collection/deposits',
    door: 'CollectionWeb/Deposits',
    rows: () => ({ rows: DEPOSIT_ROWS, balances: BALANCES }),
    empty: () => ({ rows: [], balances: [] }),
    loading: "Loading today's deposits…",
    emptyTitle: 'No deposits in this period',
    landingKeys: 'CollectionDateFrom,CollectionDateTo,Limit',
    landingBusiness: false,
  },
  attempts: {
    route: '/collection/attempts',
    door: 'CollectionWeb/Attempts',
    rows: () => ATTEMPT_ROWS,
    empty: () => [],
    loading: "Loading today's attempts…",
    emptyTitle: 'No attempts in this period',
    landingKeys: 'CollectionDateFrom,CollectionDateTo,Limit',
    landingBusiness: false,
  },
}

let scenario = {}
const calls = { acrs: 0, deposits: 0, attempts: 0 }
const lastQuery = { acrs: '', deposits: '', attempts: '' }
/** Held open to show a loading state; released by the scenario. */
let hold = null

async function run() {
  const browser = await chromium.launch()
  // Wide enough that AG Grid's column virtualisation draws every default column.
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
      return route.fulfill(
        envelope({
          accountants: [{ staffId: '4466', displayName: 'ضحى' }],
          collectors: [{ staffId: 'COLL-9', displayName: 'فهد القحطاني' }],
          supervisors: [],
          defaultScope: null,
        }),
      )
    const key = Object.keys(SCREENS).find((k) => SCREENS[k].door === path)
    if (key) {
      const screen = SCREENS[key]
      calls[key]++
      lastQuery[key] = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      if (hold) await hold
      if (scenario.list === 'error')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The inquiry failed.' }))
      // The contract's binding 400: an unparseable date / non-integer number fails ASP.NET Core's
      // [AsParameters] binding before the handler, so the body is ProblemDetails, not the envelope.
      if (scenario.list === 'refusal')
        return route.fulfill({
          status: 400,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
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
      if (scenario.list === 'empty') return route.fulfill(envelope(screen.empty()))
      return route.fulfill(envelope(screen.rows()))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/316-${name}.png`, fullPage: true })
  const mainText = async () => page.locator('main').innerText()
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(acrs|deposits|attempts|collection|common|access|servedBy|grid)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const cellText = async (rowIndex, colId) =>
    (await page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`).innerText()).trim()
  const headers = async () =>
    (await page.locator('.ag-header-cell-text').allInnerTexts()).map((s) => s.trim())
  const load = async (path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
  }
  const field = (label) => page.getByLabel(label, { exact: true })
  const search = async () => {
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForLoadState('networkidle')
  }

  for (const [key, screen] of Object.entries(SCREENS)) {
    const q = () => new URLSearchParams(lastQuery[key])
    const keys = () => [...q().keys()].sort().join(',')

    // ---- 1. the landing query ----
    scenario = {}
    calls[key] = 0
    await load(screen.route)
    await page.locator('.ag-row').first().waitFor()
    await shot(`${key}-landing`)
    check(`${key} — queries once on mount`, calls[key] === 1, `${calls[key]} calls`)
    check(
      `${key} — lands on today by ${screen.landingBusiness ? 'BUSINESS' : 'COLLECTION'} date, under the new names, and nothing else`,
      keys() === screen.landingKeys &&
        q().get(screen.landingBusiness ? 'BusinessDateFrom' : 'CollectionDateFrom') === TODAY,
      lastQuery[key],
    )
    check(`${key} — …with the legacy FromDate/ToDate retired`, !q().has('FromDate') && !q().has('ToDate'))
    check(
      `${key} — the toolbar shows four optional date ends, today on the landing range`,
      (await page.locator('form input[type="date"]').evaluateAll((els) => els.length === 4 && els.every((el) => !el.required))) &&
        (await field(screen.landingBusiness ? 'Business date from' : 'Collection date from').inputValue()) === TODAY &&
        (await field(screen.landingBusiness ? 'Collection date from' : 'Business date from').inputValue()) === '',
    )
    check(`${key} — the Filtered chip is dark on landing`, (await page.getByText('Filtered').count()) === 0)

    // ---- 2. the two date columns ----
    const hs = await headers()
    check(
      `${key} — Business Date and Collection Date are DEFAULT columns, side by side, business first`,
      hs.includes('Business Date') && hs.indexOf('Collection Date') === hs.indexOf('Business Date') + 1,
      hs.join(' | '),
    )
    await noRawKeys(`${key} grid`)

    // ---- 3. the toolbar sends the ranges ----
    const before = calls[key]
    await field('Business date from').fill('2026-09-01')
    await field('Business date to').fill('2026-09-10')
    await field('Collection date from').fill('2026-09-12')
    await field('Collection date to').fill('2026-09-21')
    await page.waitForTimeout(300)
    check(`${key} — typing the ranges fires NO query (a draft is not a search)`, calls[key] === before)
    await search()
    check(
      `${key} — Search sends BOTH ranges together, as bare days`,
      q().get('BusinessDateFrom') === '2026-09-01' &&
        q().get('BusinessDateTo') === '2026-09-10' &&
        q().get('CollectionDateFrom') === '2026-09-12' &&
        q().get('CollectionDateTo') === '2026-09-21' &&
        !q().has('FromDate') &&
        !q().has('ToDate'),
      lastQuery[key],
    )
    check(`${key} — …and the Filtered chip lights`, (await page.getByText('Filtered').count()) > 0)

    await field('Business date to').fill('')
    await field('Collection date from').fill('')
    await field('Collection date to').fill('')
    await search()
    check(
      `${key} — an end alone travels alone, and a cleared range sends nothing`,
      keys() === 'BusinessDateFrom,Limit',
      lastQuery[key],
    )

    await page.getByRole('button', { name: 'Reset' }).click()
    await page.waitForLoadState('networkidle')
    check(`${key} — Reset returns to the landing query`, keys() === screen.landingKeys, lastQuery[key])
    check(`${key} — …and the chip goes dark`, (await page.getByText('Filtered').count()) === 0)
  }

  // ---- ACRs: the span column and the ACR number ----
  {
    const q = () => new URLSearchParams(lastQuery.acrs)
    scenario = {}
    await load(SCREENS.acrs.route)
    await page.locator('.ag-row').first().waitFor()
    check('acrs — Business Date is the ACR date, the date part only', (await cellText(0, 'acrDate')) === '2026-09-02', await cellText(0, 'acrDate'))
    check(
      'acrs — Collection Date is the span of days its collections were taken on',
      (await cellText(0, 'collectionDate')) === '2026-09-05 – 2026-09-12',
      await cellText(0, 'collectionDate'),
    )
    check('acrs — an idle ACR’s Collection Date is BLANK', (await cellText(1, 'collectionDate')) === '')
    check('acrs — two collections on one day read as ONE date', (await cellText(2, 'collectionDate')) === '2026-09-12', await cellText(2, 'collectionDate'))

    await page.getByPlaceholder('Number').fill('1207')
    await search()
    check('acrs — the ACR No# box reaches AcrNumber (and never AcrId)', q().get('AcrNumber') === '1207' && !q().has('AcrId'), lastQuery.acrs)

    const before = calls.acrs
    await page.getByPlaceholder('Number').fill('12a')
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForTimeout(400)
    check('acrs — a non-digit ACR No# does not search (the door would 400 its int binding)', calls.acrs === before, `${calls.acrs} vs ${before}`)
    await shot('acrs-bad-number')
    await page.getByRole('button', { name: 'Reset' }).click()
    await page.waitForLoadState('networkidle')
  }

  // ---- Deposits: the span column and the deposit number ----
  {
    const q = () => new URLSearchParams(lastQuery.deposits)
    scenario = {}
    await load(SCREENS.deposits.route)
    await page.locator('.ag-row').first().waitFor()
    check(
      'deposits — Business Date is the span of the deposit’s ACRs’ days',
      (await cellText(0, 'businessDate')) === '2026-08-20 – 2026-09-10',
      await cellText(0, 'businessDate'),
    )
    check('deposits — one ACR reads as ONE date', (await cellText(1, 'businessDate')) === '2026-09-10', await cellText(1, 'businessDate'))
    check('deposits — Collection Date is deposited-at', (await cellText(0, 'depositedAt')) === '2026-09-21 11:30', await cellText(0, 'depositedAt'))

    await page.getByPlaceholder('Number').fill('5501')
    await field('Business date from').fill('2026-09-01')
    await field('Business date to').fill('2026-09-30')
    await field('Collection date from').fill('')
    await field('Collection date to').fill('')
    await search()
    check(
      'deposits — the contract’s example: a business range and DepositNumber (never DepositId)',
      q().get('DepositNumber') === '5501' &&
        q().get('BusinessDateFrom') === '2026-09-01' &&
        q().get('BusinessDateTo') === '2026-09-30' &&
        !q().has('CollectionDateFrom') &&
        !q().has('DepositId'),
      lastQuery.deposits,
    )
    const before = calls.deposits
    await page.getByPlaceholder('Number').fill('no.5501')
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForTimeout(400)
    check('deposits — a non-digit Deposit No# does not search', calls.deposits === before, `${calls.deposits} vs ${before}`)
    await page.getByRole('button', { name: 'Reset' }).click()
    await page.waitForLoadState('networkidle')
  }

  // ---- Attempts: the two dates and the Served-by pair ----
  {
    const q = () => new URLSearchParams(lastQuery.attempts)
    scenario = {}
    await load(SCREENS.attempts.route)
    await page.locator('.ag-row').first().waitFor()
    check('attempts — Business Date is the attempted business day', (await cellText(0, 'businessDay')) === '2026-09-02', await cellText(0, 'businessDay'))
    check('attempts — Collection Date is the attempt time', (await cellText(0, 'attemptTime')) === '2026-09-05 10:15', await cellText(0, 'attemptTime'))

    // The wrapping <label>'s accessible name folds in the chosen option's text, so reach the
    // one <select> on the strip directly.
    const picker = page.locator('form select')
    check('attempts — the Served-by picker is on the toolbar', (await picker.count()) === 1)
    const groups = await picker.locator('optgroup').evaluateAll((els) => els.map((el) => el.label))
    check('attempts — …offering Accountants, on the assignment reading', groups.includes('Accountants'), groups.join(', '))
    check(
      'attempts — …with Unassigned, and landing on Everyone (no default scope)',
      (await picker.locator('option', { hasText: 'Unassigned' }).count()) === 1 && (await picker.inputValue()) === '',
    )
    check('attempts — no Served-by pair on the landing query', !q().has('ServedByKind') && !q().has('ServedById'), lastQuery.attempts)

    await picker.selectOption('ACCOUNTANT:4466')
    await page.getByPlaceholder('Staff id').fill('COLL-9')
    await field('Business date from').fill('2026-09-02')
    await field('Business date to').fill('2026-09-02')
    await field('Collection date from').fill('')
    await field('Collection date to').fill('')
    await search()
    check(
      'attempts — the contract’s example: the Served-by pair with a business day, the collector ANDed beside it',
      q().get('ServedByKind') === 'ACCOUNTANT' &&
        q().get('ServedById') === '4466' &&
        q().get('CollectorStaffId') === 'COLL-9' &&
        q().get('BusinessDateFrom') === '2026-09-02' &&
        q().get('BusinessDateTo') === '2026-09-02',
      lastQuery.attempts,
    )
    await shot('attempts-served-by')

    await picker.selectOption('UNASSIGNED:')
    await search()
    check('attempts — Unassigned sends the Kind alone', q().get('ServedByKind') === 'UNASSIGNED' && !q().has('ServedById'), lastQuery.attempts)

    await page.getByRole('button', { name: 'Reset' }).click()
    await page.waitForLoadState('networkidle')
    check('attempts — Reset clears the pick and the query drops the pair', (await picker.inputValue()) === '' && !q().has('ServedByKind'), lastQuery.attempts)
    await noRawKeys('attempts toolbar')
  }

  // ---- 4. the list's other states, on each screen ----
  const SERVER_FAULT = 'The OMS API encountered an unexpected error. Please try again.'
  const REJECTED = 'The request was rejected by the server.'
  for (const [key, screen] of Object.entries(SCREENS)) {
    const q = () => new URLSearchParams(lastQuery[key])

    let release
    hold = new Promise((r) => (release = r))
    scenario = {}
    await page.goto(BASE + screen.route)
    const loading = page.getByRole('status', { name: screen.loading })
    await loading.first().waitFor({ timeout: 5000 }).catch(() => {})
    check(`${key} — loading: the list says it is loading, no grid yet`, (await loading.count()) > 0 && (await page.locator('.ag-root').count()) === 0)
    release()
    hold = null
    await page.waitForLoadState('networkidle')
    await page.locator('.ag-row').first().waitFor()

    scenario = { list: 'empty' }
    await field('Business date from').fill('2026-09-10')
    await field('Business date to').fill('2026-09-01')
    await search()
    const emptyText = await mainText()
    check(
      `${key} — empty: a From later than its To is sent as typed, and the honest empty state answers`,
      q().get('BusinessDateFrom') === '2026-09-10' && emptyText.includes(screen.emptyTitle) && (await page.locator('.ag-root').count()) === 0,
      lastQuery[key],
    )
    check(`${key} — …whose hint names both date ranges`, emptyText.includes('Widen the business or collection dates'))
    await shot(`${key}-empty`)

    scenario = { list: 'error' }
    await load(screen.route)
    await page.getByText(SERVER_FAULT).first().waitFor({ timeout: 8000 }).catch(() => {})
    const errorText = await mainText()
    check(
      `${key} — error: a 500 reads as a server fault, no grid, never the empty state`,
      errorText.includes(SERVER_FAULT) && !errorText.includes(screen.emptyTitle) && (await page.locator('.ag-root').count()) === 0,
      errorText.replace(/\n/g, ' ').slice(-160),
    )

    scenario = { list: 'refusal' }
    await load(screen.route)
    await page.getByText(REJECTED).first().waitFor({ timeout: 8000 }).catch(() => {})
    const refusalText = await mainText()
    check(
      `${key} — refusal: the 400 binding failure reads as a rejection, not an empty day`,
      refusalText.includes(REJECTED) && !refusalText.includes(screen.emptyTitle) && (await page.locator('.ag-root').count()) === 0,
      refusalText.replace(/\n/g, ' ').slice(-160),
    )
    await noRawKeys(`${key} states`)
  }

  // Attempts only: the Served-by resolver's refusals are now reachable on this door.
  scenario = { list: 'servedByRefusal' }
  await load(SCREENS.attempts.route)
  await page.getByText('A Served-by id needs a Kind.').first().waitFor({ timeout: 8000 }).catch(() => {})
  const sbText = await mainText()
  check(
    'attempts — refusal: the Served-by resolver’s 400 envelope shows the server’s own message',
    sbText.includes('A Served-by id needs a Kind.') && !sbText.includes(SCREENS.attempts.emptyTitle),
    sbText.replace(/\n/g, ' ').slice(-160),
  )
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
