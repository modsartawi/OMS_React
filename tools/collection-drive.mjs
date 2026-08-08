// Collections drive (ticket 253) — drives the REAL app in Chromium against a MOCKED
// CollectionWeb/Access envelope, because SIS.Api's CollectionWeb door doesn't exist yet
// (BackOffice 1090; ticket 259 is the wave-joining event). This is the wave's screens
// drive — later slices (254–258) EXTEND this file rather than starting a third.
//
// Verifies ticket 253's flow Proof bullet:
//   1. all four granted → the Collections group renders four items and all four routes
//      load their Pages;
//   2. one granted → a RAGGED group with exactly that item, and the ungranted routes
//      render the denied backstop rather than a broken screen;
//   3. none granted → NO group at all, and a hand-typed /collection/collections renders
//      the denied backstop;
//   4. the probe FAILING (a bare 403, which is exactly what the unbuilt door answers
//      today) → same as none-granted, hidden rather than crashing — and a 403 reads as
//      a REFUSAL (see an administrator), while a 500 reads as UNREACHABLE (try again).
//      Both deny; only the sentence differs.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/collection-drive.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const ROUTES = {
  collections: '/collection/collections',
  acrs: '/collection/acrs',
  deposits: '/collection/deposits',
  attempts: '/collection/attempts',
}
// The h1 each Page renders once its own guard admits the session.
const TITLES = {
  collections: 'Cash Collections',
  acrs: 'ACRs',
  deposits: 'Deposits',
  attempts: 'Collection Attempts',
}
const DENIED = 'No access to this screen'

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

const NONE = {
  canOpenCollections: false,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
}
const ALL = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
}

// ---- ticket 254: the Cash Collections rows ----
// A stubbed CollectionWeb/Collections envelope, for the same reason Access is
// stubbed: the door is BackOffice 1090's and ticket 259 is the wave-joining event.
const pad = (n) => String(n).padStart(2, '0')
const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** `count` rows, all SAR unless told otherwise.
 *
 *  Variance carries the three meanings the screen must tell apart, pinned to the
 *  first three rows because 254's assertions locate them by row index: row 0 NULL
 *  (the "blank, not 0.00" proof), row 1 negative, row 2 a real zero.
 *
 *  🚩 Every row FROM 3 ON carries a real signed figure, and that is load-bearing
 *  rather than decorative: the CSV export filters to store 1003 (`i % 7 === 2`,
 *  so rows 9, 16, 23 …), and while the whole tail was `0` every Variance cell in
 *  the exported file was blank or zero — which let 258's money sweep pass over a
 *  `Variance` mis-declared as `identity`, since the sweep skips empty cells and
 *  identity writes a bare 0 as blank. A signed column with substance is what
 *  gives that assertion teeth. */
function makeRows(count, { currency = 'SAR' } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    collectionReceiptId: `01J0COLLECT${String(i).padStart(16, '0')}`,
    collectionReceiptNo: 91000 + i,
    storeId: String(1001 + (i % 7)),
    storeName: `Al Dawaa Store ${1001 + (i % 7)}`,
    collectorOperatorId: String(4470 + (i % 3)),
    collectorName: `Collector ${4470 + (i % 3)}`,
    closerOperatorId: String(7780 + (i % 5)),
    closerName: `Pharmacist ${7780 + (i % 5)}`,
    openedAt: `${todayIso()}T07:00:00`,
    closedAt: `${todayIso()}T15:04:00`,
    collectedAt: `${todayIso()}T15:40:00`,
    salesDate: i === 2 ? '0001-01-01T00:00:00' : `${todayIso()}T00:00:00`,
    systemCash: 12480.5 + i,
    countedCash: 12475 + i,
    variance: i === 0 ? null : i === 1 ? -5.5 : i === 2 ? 0 : i % 2 === 0 ? 4.25 : -3.75,
    varianceReasonCode: i === 1 ? 'SHORT' : '',
    varianceReasonText: i === 1 ? 'Counted short at close' : '',
    openingFloat: 500,
    countedCashNet: 11975 + i,
    retainedFloat: 500,
    netCollected: 11975 + i,
    cardTotal: 8310.25 + i,
    cardTransactionCount: 96,
    zReportIds: `Z-${88121 + i}`,
    currencyKey: currency,
  }))
}

// ---- ticket 255: the ACR and Collection Attempt rows ----
// Stubbed for the same reason: CollectionWeb/Acrs and CollectionWeb/Attempts are
// BackOffice 1090's doors and ticket 259 is the wave-joining event.

/** `count` ACR rows. Row 0 is a still-OPEN ACR — `closedAt` at the .NET sentinel,
 *  `depositNumber` 0 — which is the "blank, not 0001-01-01 / not 0" proof. Row 1
 *  carries a NULL card total (blank, not 0.00) and row 2 a real zero. */
function makeAcrRows(count) {
  return Array.from({ length: count }, (_, i) => {
    const open = i === 0
    return {
      acrId: `01J0ACR${String(i).padStart(20, '0')}`,
      acrNumber: 40 + i,
      label: `Riyadh run ${40 + i}`,
      collectorOperatorId: String(4470 + (i % 3)),
      collectorName: `Collector ${4470 + (i % 3)}`,
      acrDate: `${todayIso()}T00:00:00`,
      status: open ? 'OPEN' : 'CLOSED',
      createdAt: `${todayIso()}T08:15:00`,
      closedAt: open ? '0001-01-01T00:00:00' : `${todayIso()}T19:32:00`,
      linkedCollectionCount: i === 2 ? 0 : 12,
      netCollectedTotal: 143910.75 + i,
      cardTotalSum: i === 1 ? null : i === 2 ? 0 : 99120.5 + i,
      cardTransactionCountSum: 812,
      depositId: open ? '' : `01J0DEPOSIT${String(i).padStart(15, '0')}`,
      depositNumber: open ? 0 : 5500 + i,
      depositStatus: open ? '' : 'POSTED',
    }
  })
}

/** `count` collection-attempt rows. Nothing here is money — an attempt collected
 *  nothing, which is what makes it an attempt. */
function makeAttemptRows(count) {
  return Array.from({ length: count }, (_, i) => ({
    attemptId: `01J0ATTEMPT${String(i).padStart(16, '0')}`,
    collectorStaffId: String(4470 + (i % 3)),
    collectorName: `Collector ${4470 + (i % 3)}`,
    storeCode: String(1001 + (i % 7)),
    storeName: `Al Dawaa Store ${1001 + (i % 7)}`,
    shiftId: `01J0SHIFT${String(i).padStart(18, '0')}`,
    businessDay: `${todayIso()}T00:00:00`,
    attemptTime: `${todayIso()}T09:12:00`,
    reasonCode: i % 2 ? 'STORE_CLOSED' : 'NO_CASH',
    reasonText: i % 2 ? 'Branch shut for maintenance' : '',
  }))
}

// ---- ticket 256: the Deposits payload ----
// ⚠️ Stubbed for the same reason, but this is the HARDEST door of the four:
// Deposit/Inquiry rides CollectorEndpointFilter, which demands an api-key PLUS a
// Mobile-channel Bearer session and has no cookie branch at all — so it needs a
// genuinely new door (BackOffice 1090), not an .AllowCookieSession() marker.
//
// 🚩 The one response that is NOT a bare list: `{ rows, balances }`, each row
// carrying its own `lines` and `attachments`. That shape is what makes the
// stacked detail region and the balances panel cost no fetch, and the drive
// asserts exactly that by counting requests across a selection change.

/** `count` deposit rows. Odd-indexed rows carry a DRIFTED claimed ACR — the
 *  screen's whole reason to exist — and every row carries two slips. Row 0 is
 *  deliberately CLEAN so that selecting row 1 is what makes a flag appear. */
function makeDepositRows(count) {
  return Array.from({ length: count }, (_, i) => {
    const drifted = i % 2 === 1
    const banked = 143910.75 + i
    return {
      depositId: `01J0DEPOSIT${String(i).padStart(15, '0')}`,
      depositNumber: 5500 + i,
      collectorOperatorId: String(4470 + (i % 3)),
      collectorName: `Collector ${4470 + (i % 3)}`,
      bankCode: i % 2 ? 'ANB' : 'RJHI',
      bankName: i % 2 ? 'Arab National Bank' : 'Al Rajhi Bank',
      status: i % 7 === 6 ? 'VOID' : 'POSTED',
      depositedAt: `${todayIso()}T11:20:00`,
      createdAt: `${todayIso()}T11:22:00`,
      calculatedAmount: banked,
      realAmount: banked,
      diffAmount: 0,
      reasonCode: '',
      noteText: '',
      voidedBy: i % 7 === 6 ? 'msartawi' : '',
      // The .NET sentinel on a deposit that was never voided — blank, not year 1.
      voidedAt: i % 7 === 6 ? `${todayIso()}T18:00:00` : '0001-01-01T00:00:00',
      voidReason: i % 7 === 6 ? 'Banked twice' : '',
      lines: [
        {
          acrId: `01J0ACR${String(i * 2).padStart(20, '0')}`,
          acrNumber: 40 + i * 2,
          netCollectedAtDeposit: banked,
          netCollectedNow: banked,
          // ⚠️ drift/hasDrift are get-only C# properties: they are ON THE WIRE,
          // computed in decimal. The client reads them and never subtracts.
          drift: 0,
          hasDrift: false,
        },
        {
          acrId: `01J0ACR${String(i * 2 + 1).padStart(20, '0')}`,
          acrNumber: 41 + i * 2,
          netCollectedAtDeposit: 1234.1,
          netCollectedNow: drifted ? 1634.1 : 1234.1,
          drift: drifted ? 400 : 0,
          hasDrift: drifted,
        },
      ],
      attachments: [
        {
          attachmentId: `01J0SLIP${String(i).padStart(18, '0')}`,
          url: `https://slips.example.test/deposit-${5500 + i}-a.jpg`,
          fileName: `slip-${5500 + i}-a.jpg`,
          createdAt: `${todayIso()}T11:23:00`,
        },
        {
          attachmentId: `01J0SLIPB${String(i).padStart(17, '0')}`,
          url: `https://slips.example.test/deposit-${5500 + i}-b.jpg`,
          fileName: `slip-${5500 + i}-b.jpg`,
          createdAt: `${todayIso()}T11:24:00`,
        },
      ],
    }
  })
}

/** The per-collector balance summary that rides in the SAME response. */
function makeBalances() {
  return [4470, 4471, 4472].map((id, i) => ({
    collectorOperatorId: String(id),
    collectorName: `Collector ${id}`,
    depositCount: 4 + i,
    totalCalculated: 143910.75 + i,
    totalReal: 143510.75 + i,
    // Positive: still owes the bank a trip. Row 2 is negative — last trip's
    // shortfall has since landed — and the sign stays the row's own.
    outstanding: i === 2 ? -412.5 : 400,
  }))
}

// scenario state, mutated between reloads
let scenario = { accessBody: ALL, access403: false }
let accessCalls = 0
let collectionsRows = makeRows(347)
let acrRows = makeAcrRows(213)
let attemptRows = makeAttemptRows(174)
let lastAcrsQuery = ''
let acrsCalls = 0
let lastAttemptsQuery = ''
let attemptsCalls = 0
let depositRows = makeDepositRows(163)
let depositBalances = makeBalances()
let lastDepositsQuery = ''
let depositsCalls = 0
/** The query string of the LAST CollectionWeb/Collections request — this is how
 *  the drive proves that Search/Reset promoted the draft, and that a keystroke
 *  did not. */
let lastCollectionsQuery = ''
let collectionsCalls = 0

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'CollectionWeb/Access') {
      accessCalls++
      // The bare 403 the default-deny inversion (issue 802) hands a browser while
      // the door is unmarked — the realistic pre-1090 answer, not a hypothetical.
      if (scenario.access403)
        return route.fulfill(
          envelope(null, { status: 403, success: false, message: 'Forbidden' }),
        )
      if (scenario.access500)
        return route.fulfill(
          envelope(null, { status: 500, success: false, message: 'Server error' }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    if (path === 'CollectionWeb/Collections') {
      collectionsCalls++
      lastCollectionsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope(collectionsRows))
    }
    if (path === 'CollectionWeb/Acrs') {
      acrsCalls++
      lastAcrsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope(acrRows))
    }
    if (path === 'CollectionWeb/Deposits') {
      depositsCalls++
      lastDepositsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope({ rows: depositRows, balances: depositBalances }))
    }
    if (path === 'CollectionWeb/Attempts') {
      attemptsCalls++
      lastAttemptsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope(attemptRows))
    }
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const sidebarLinks = async () =>
    (await page.getByRole('link', { name: /Cash Collections|^ACRs$|^Deposits$|Collection Attempts/ }).all())
      .length
  const groupCount = async () => page.getByRole('button', { name: /^Collections$/ }).count()
  const mainText = async () => page.locator('main').innerText()

  // ---- Scenario 1: all four granted ----
  scenario = { accessBody: ALL, access403: false }
  for (const [key, route] of Object.entries(ROUTES)) {
    await page.goto(BASE + route)
    await page.waitForLoadState('networkidle')
    const text = await mainText()
    check(
      `all granted → ${route} loads its Page (${TITLES[key]})`,
      text.includes(TITLES[key]) && !text.includes(DENIED),
      text.replace(/\n/g, ' ').slice(0, 80),
    )
  }
  check('all granted → the Collections group renders', (await groupCount()) === 1)
  check('all granted → four items under it', (await sidebarLinks()) === 4, `${await sidebarLinks()} links`)

  // ONE probe for the whole area: four leaves + the screen's own guard share the
  // key, so react-query dedupes them into a single request per page life.
  accessCalls = 0
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check(
    'the four leaves + the screen guard cost ONE CollectionWeb/Access call',
    accessCalls === 1,
    `${accessCalls} calls`,
  )

  // ---- Scenario 2: one granted → a ragged group ----
  scenario = { accessBody: { ...NONE, canOpenDeposits: true }, access403: false }
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  check('Deposits only → the group is still there', (await groupCount()) === 1)
  check('Deposits only → exactly ONE item under it (a ragged group)', (await sidebarLinks()) === 1)
  check(
    'Deposits only → and it is the Deposits one',
    (await page.getByRole('link', { name: /^Deposits$/ }).count()) === 1,
  )
  check('Deposits only → the Deposits Page opens', (await mainText()).includes(TITLES.deposits))

  // The ungranted sibling, hand-typed: the backstop, not a broken screen.
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  const raggedDenied = await mainText()
  check(
    'Deposits only → a hand-typed /collection/collections renders the denied backstop',
    raggedDenied.includes(DENIED) && !raggedDenied.includes(TITLES.collections),
    raggedDenied.replace(/\n/g, ' ').slice(0, 80),
  )

  // ---- Scenario 3: none granted ----
  scenario = { accessBody: NONE, access403: false }
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check('none granted → NO Collections group at all', (await groupCount()) === 0)
  check('none granted → no Collections leaves either', (await sidebarLinks()) === 0)
  const noneText = await mainText()
  check(
    'none granted → a hand-typed URL renders the denied backstop',
    noneText.includes(DENIED),
    noneText.replace(/\n/g, ' ').slice(0, 80),
  )
  check('none granted → and NOT a blank screen', noneText.trim().length > 0)

  // ---- Scenario 4: the probe FAILS (the bare 403 the unbuilt door answers today) ----
  scenario = { accessBody: null, access403: true }
  for (const route of [ROUTES.acrs, ROUTES.attempts]) {
    await page.goto(BASE + route)
    await page.waitForLoadState('networkidle')
    check(`probe 403 → ${route} hides the group (fails closed)`, (await groupCount()) === 0)
    const text = await mainText()
    check(
      `probe 403 → ${route} renders the denied backstop, not a crash`,
      text.includes(DENIED),
      text.replace(/\n/g, ' ').slice(0, 80),
    )
  }

  // ---- Scenario 5: the probe is UNREACHABLE (500) → deny, but the other sentence ----
  scenario = { accessBody: null, access403: false, access500: true }
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check('probe 500 → the group is hidden too (fails closed)', (await groupCount()) === 0)
  const unreachable = await mainText()
  check(
    'probe 500 → the UNREACHABLE sentence (a retry), not the administrator one',
    unreachable.includes('unavailable') && !unreachable.includes(DENIED),
    unreachable.replace(/\n/g, ' ').slice(0, 90),
  )

  // ================= ticket 254 — Cash Collections opens on today =================
  scenario = { accessBody: ALL, access403: false, access500: false }
  const TODAY = todayIso()

  // ---- it lands ALREADY POPULATED, with no click ----
  collectionsRows = makeRows(347)
  collectionsCalls = 0
  lastCollectionsQuery = ''
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const q = () => new URLSearchParams(lastCollectionsQuery)
  check('254 — the screen queries on MOUNT (no Load button to press)', collectionsCalls === 1, `${collectionsCalls} calls`)
  check(
    '254 — and it queries TODAY, as a pair',
    q().get('FromDate') === TODAY && q().get('ToDate') === TODAY,
    lastCollectionsQuery,
  )
  check('254 — the WPF Limit box is gone; 2,000 rides as a system cap', q().get('Limit') === '2000')
  check(
    '254 — an unset store/collector is DROPPED, not sent as an empty string',
    !lastCollectionsQuery.includes('StoreId') && !lastCollectionsQuery.includes('CollectorOperatorId'),
    lastCollectionsQuery,
  )
  check('254 — rows are on screen without a click', (await page.locator('.ag-row').count()) > 0)

  // ---- the floating per-column filter row is VISIBLE ON ARRIVAL ----
  check(
    '254 — the floating filter row is visible on arrival (inverting BBY’s default)',
    (await page.locator('.ag-floating-filter').count()) > 0,
    `${await page.locator('.ag-floating-filter').count()} floating filters`,
  )

  // ---- client paging at 50 over the WHOLE result ----
  const summary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('254 — the grid pages at 50 with the whole 347 present', /1 to 50 of 347/.test(summary), summary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const summary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('254 — Next walks the SAME fetched result, with no second request', /51 to 100 of 347/.test(summary2) && collectionsCalls === 1, `${summary2} · ${collectionsCalls} calls`)
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  // ---- the filter row narrows the WHOLE result, not the visible page ----
  const floatingFilter = (colId) =>
    page.locator(`.ag-header-row .ag-floating-filter[col-id="${colId}"] input`)
  // AG Grid debounces a floating filter's keystrokes (500ms) before applying it.
  const filterBy = async (colId, text) => {
    await floatingFilter(colId).fill(text)
    await page.waitForTimeout(900)
    const summary = await page.locator('.ag-paging-row-summary-panel').innerText()
    return { summary, total: Number(/of (\d+)/.exec(summary)?.[1] ?? -1) }
  }
  const byStore = await filterBy('storeId', '1003')
  check(
    '254 — a per-column filter narrows all 347, not the 50 on screen',
    byStore.total > 0 && byStore.total < 347,
    byStore.summary,
  )
  await filterBy('storeId', '')

  // …and a date column filters on what the CELL shows, not on the raw ISO value.
  const byShownDate = await filterBy('collectedAt', `${TODAY} 15:40`)
  check('254 — typing the date the CELL shows matches', byShownDate.total === 347, byShownDate.summary)
  const byRawIso = await filterBy('collectedAt', `${TODAY}T15:40`)
  check(
    '254 — …and the raw ISO value, which is NOT on screen, matches nothing',
    byRawIso.total === 0,
    byRawIso.summary,
  )
  await filterBy('collectedAt', '')

  // ---- money: currency in the HEADER, right-aligned, blank ≠ 0.00 ----
  const headerText = async () => (await page.locator('.ag-header-row').first().innerText()).replace(/\n/g, ' | ')
  const headers = await headerText()
  check('254 — the currency is stated ONCE, in the money header', headers.includes('Net Collected (SAR)'), headers.slice(0, 160))
  const netCell = page.locator('.ag-row[row-index="0"] [col-id="netCollected"]')
  check('254 — money is grouped to the currency’s decimals', (await netCell.innerText()).trim() === '11,975.00', await netCell.innerText())
  check('254 — and right-aligned', (await netCell.getAttribute('class')).includes('text-end'))
  const varianceCell = page.locator('.ag-row[row-index="0"] [col-id="variance"]')
  check('254 — a MISSING figure renders blank, not 0.00', (await varianceCell.innerText()).trim() === '', JSON.stringify(await varianceCell.innerText()))
  const zeroVariance = page.locator('.ag-row[row-index="2"] [col-id="variance"]')
  check('254 — …and a real zero still reads 0.00', (await zeroVariance.innerText()).trim() === '0.00', await zeroVariance.innerText())

  // ---- the More-columns toggle reveals the forensic tail ----
  check('254 — the forensic tail is folded away on arrival', !headers.includes('Z Reports'))
  await page.getByRole('button', { name: 'More columns' }).click()
  // ⚠️ AG Grid virtualizes headers horizontally, so "is it there" has to be asked
  // by scrolling: read the header cells at both ends and union them.
  const allHeaders = async () => {
    const seen = new Set()
    for (const left of [0, 4000]) {
      await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((el, x) => {
        el.scrollLeft = x
      }, left)
      await page.waitForTimeout(200)
      for (const text of await page.locator('.ag-header-row').first().locator('.ag-header-cell-text').allInnerTexts())
        seen.add(text.trim())
    }
    return [...seen]
  }
  const opened = (await allHeaders()).join(' | ')
  check('254 — More columns reveals the tail (Z Reports, Closer, Currency)', opened.includes('Z Reports') && opened.includes('Closer') && opened.includes('Currency'), opened.slice(0, 260))
  check('254 — and nothing was dropped to make room', opened.includes('Receipt No#') && opened.includes('Net Collected (SAR)'))
  await page.getByRole('button', { name: 'More columns' }).click()

  // ---- the filter-row toggle reclaims the height ----
  await page.getByRole('button', { name: 'Filter row' }).click()
  check('254 — the filter row toggles off to reclaim the height', (await page.locator('.ag-floating-filter').count()) === 0)
  await page.getByRole('button', { name: 'Filter row' }).click()

  // ---- the criteria DRAFT: typing does not query; Search does ----
  const callsBeforeTyping = collectionsCalls
  await page.getByPlaceholder('Store code').fill('1003')
  await page.waitForTimeout(300)
  check('254 — typing a store code fires NO query (a draft is not a search)', collectionsCalls === callsBeforeTyping, `${collectionsCalls} vs ${callsBeforeTyping}`)
  check('254 — …and NO chip either: the grid is still showing today', (await page.getByText('Filtered').count()) === 0)

  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('254 — Search promotes the draft', collectionsCalls === callsBeforeTyping + 1 && q().get('StoreId') === '1003', lastCollectionsQuery)
  check('254 — …and NOW the chip lights: the grid really is filtered', (await page.getByText('Filtered').count()) > 0)

  // ---- Reset returns the landing state ----
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '254 — Reset returns to today with everything else cleared',
    q().get('FromDate') === TODAY && q().get('ToDate') === TODAY && !lastCollectionsQuery.includes('StoreId'),
    lastCollectionsQuery,
  )
  check('254 — and the Filtered chip goes with it', (await page.getByText('Filtered').count()) === 0)

  // ---- the cap banner: reached, not merely large ----
  const CAP_TEXT = /reached the 2,000-row system cap/
  collectionsRows = makeRows(1999)
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check('254 — 1,999 rows is merely large: NO banner', !CAP_TEXT.test(await mainText()))

  collectionsRows = makeRows(2000)
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check('254 — 2,000 rows REACHED the cap: the amber banner fires', CAP_TEXT.test(await mainText()))

  // ---- an empty day says so, rather than looking broken ----
  collectionsRows = []
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  const emptyText = await mainText()
  check('254 — an empty period reads as empty, not as an error', emptyText.includes('No collections in this period') && !CAP_TEXT.test(emptyText))

  // ---- a mixed-currency result states the currency per row instead ----
  collectionsRows = [...makeRows(3), ...makeRows(2, { currency: 'BHD' })]
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  const mixedHeaders = await headerText()
  check(
    '254 — a mixed result drops the header code and promotes the Currency column',
    !mixedHeaders.includes('Net Collected (SAR)') && mixedHeaders.includes('Currency'),
    mixedHeaders.slice(0, 200),
  )
  const bhdCell = page.locator('.ag-row[row-index="4"] [col-id="netCollected"]')
  check('254 — and each figure keeps ITS row’s decimals (BHD draws three)', (await bhdCell.innerText()).trim() === '11,976.000', await bhdCell.innerText())

  collectionsRows = makeRows(347)

  // ============ ticket 255 — ACRs and Attempts on the same template ============
  // The same landing/paging/toggle/filter-row proof as 254, plus the two things
  // that are these screens' own: the segmented Status control, and the deliberate
  // ABSENCE of a row action on Collection Attempts.

  // ---- ACRs: it lands ALREADY POPULATED, with no click ----
  acrsCalls = 0
  lastAcrsQuery = ''
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const qa = () => new URLSearchParams(lastAcrsQuery)
  check('255 — ACRs queries on MOUNT (no Load button to press)', acrsCalls === 1, `${acrsCalls} calls`)
  check(
    '255 — …and it queries TODAY, as a pair, at the system cap',
    qa().get('FromDate') === TODAY && qa().get('ToDate') === TODAY && qa().get('Limit') === '2000',
    lastAcrsQuery,
  )
  check(
    '255 — an unset ACR No#/collector is DROPPED, not sent as an empty string',
    !lastAcrsQuery.includes('AcrNumber') && !lastAcrsQuery.includes('CollectorOperatorId'),
    lastAcrsQuery,
  )
  // The headline: All is the CLIENT's word for "no filter" and never travels.
  check(
    '255 — Status = All sends NOTHING: no Status param at all',
    !lastAcrsQuery.includes('Status'),
    lastAcrsQuery,
  )
  check('255 — ACR rows are on screen without a click', (await page.locator('.ag-row').count()) > 0)
  check(
    '255 — the floating filter row is visible on arrival (inverting BBY’s default)',
    (await page.locator('.ag-floating-filter').count()) > 0,
  )

  // ---- client paging at 50 over the WHOLE result ----
  const acrSummary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('255 — ACRs pages at 50 with the whole 213 present', /1 to 50 of 213/.test(acrSummary), acrSummary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const acrSummary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check(
    '255 — Next walks the SAME fetched result, with no second request',
    /51 to 100 of 213/.test(acrSummary2) && acrsCalls === 1,
    `${acrSummary2} · ${acrsCalls} calls`,
  )
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  // ---- the per-column filter row narrows the WHOLE result ----
  const byCollector = await filterBy('collectorName', 'Collector 4471')
  check(
    '255 — a per-column filter narrows all 213, not the 50 on screen',
    byCollector.total > 0 && byCollector.total < 213,
    byCollector.summary,
  )
  await filterBy('collectorName', '')

  // ---- the sentinels: a still-OPEN ACR shows blanks, not 0001-01-01 and not 0 ----
  const acrHeaders = await headerText()
  check(
    '255 — money states NO currency in the header (the ACR row carries none)',
    acrHeaders.includes('Net Collected') && !acrHeaders.includes('Net Collected ('),
    acrHeaders.slice(0, 200),
  )
  const acrCash = page.locator('.ag-row[row-index="0"] [col-id="netCollectedTotal"]')
  check(
    '255 — …and still groups to two decimals',
    (await acrCash.innerText()).trim() === '143,910.75',
    await acrCash.innerText(),
  )
  const acrNullCard = page.locator('.ag-row[row-index="1"] [col-id="cardTotalSum"]')
  check(
    '255 — a MISSING figure renders blank, not 0.00',
    (await acrNullCard.innerText()).trim() === '',
    JSON.stringify(await acrNullCard.innerText()),
  )
  const acrZeroCard = page.locator('.ag-row[row-index="2"] [col-id="cardTotalSum"]')
  check(
    '255 — …and a real zero still reads 0.00',
    (await acrZeroCard.innerText()).trim() === '0.00',
    await acrZeroCard.innerText(),
  )

  // ---- the More-columns toggle reveals the forensic tail ----
  check('255 — the ACR forensic tail is folded away on arrival', !acrHeaders.includes('Deposit No#'))
  await page.getByRole('button', { name: 'More columns' }).click()
  const acrOpened = (await allHeaders()).join(' | ')
  check(
    '255 — More columns reveals the ACR tail (Created, Deposit No#, Deposit Id)',
    acrOpened.includes('Created') && acrOpened.includes('Deposit No#') && acrOpened.includes('Deposit Id'),
    acrOpened.slice(0, 260),
  )
  check('255 — and nothing was dropped to make room', acrOpened.includes('ACR No#') && acrOpened.includes('Net Collected'))

  // Row 0 is the still-OPEN ACR: Closed and Deposit No# are BLANK, not sentinels.
  const openClosed = page.locator('.ag-row[row-index="0"] [col-id="closedAt"]')
  check(
    '255 — a still-OPEN ACR shows a blank Closed, not 0001-01-01',
    (await openClosed.innerText()).trim() === '',
    JSON.stringify(await openClosed.innerText()),
  )
  const openDeposit = page.locator('.ag-row[row-index="0"] [col-id="depositNumber"]')
  check(
    '255 — an unbanked ACR shows a blank Deposit No#, not 0',
    (await openDeposit.innerText()).trim() === '',
    JSON.stringify(await openDeposit.innerText()),
  )
  await page.getByRole('button', { name: 'More columns' }).click()

  // ---- the segmented Status control drives a REAL re-query ----
  const statusButton = (name) => page.getByRole('radio', { name, exact: true })
  check('255 — the Status control offers exactly three states', (await page.getByRole('radio').count()) === 3)
  check('255 — and it lands on All', (await statusButton('All').getAttribute('aria-checked')) === 'true')

  const callsBeforeStatus = acrsCalls
  await statusButton('Open').click()
  await page.waitForTimeout(300)
  check(
    '255 — choosing a status is a DRAFT edit: it fires no query on its own',
    acrsCalls === callsBeforeStatus,
    `${acrsCalls} vs ${callsBeforeStatus}`,
  )
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Search promotes it, and OPEN travels as the server’s own string',
    acrsCalls === callsBeforeStatus + 1 && qa().get('Status') === 'OPEN',
    lastAcrsQuery,
  )
  check('255 — …and the Filtered chip lights', (await page.getByText('Filtered').count()) > 0)

  await statusButton('Closed').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('255 — CLOSED re-queries too', qa().get('Status') === 'CLOSED', lastAcrsQuery)

  await statusButton('All').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — going back to All REMOVES the param rather than sending "All"',
    !lastAcrsQuery.includes('Status'),
    lastAcrsQuery,
  )

  // ---- the ACR No# box, and Reset ----
  await page.getByPlaceholder('Number').fill('41')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — the ACR No# travels as AcrNumber, never as AcrId (which is the ULID)',
    qa().get('AcrNumber') === '41' && !lastAcrsQuery.includes('AcrId'),
    lastAcrsQuery,
  )
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Reset returns to today with the status and the number cleared',
    qa().get('FromDate') === TODAY && !lastAcrsQuery.includes('AcrNumber') && !lastAcrsQuery.includes('Status'),
    lastAcrsQuery,
  )
  check('255 — and the Filtered chip goes with it', (await page.getByText('Filtered').count()) === 0)

  // ---- the ACR cap banner: reached, not merely large ----
  acrRows = makeAcrRows(1999)
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  check('255 — 1,999 ACRs is merely large: NO banner', !/reached the 2,000-row system cap/.test(await mainText()))
  acrRows = makeAcrRows(2000)
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  check('255 — 2,000 ACRs REACHED the cap: the amber banner fires', /reached the 2,000-row system cap/.test(await mainText()))

  acrRows = []
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  check('255 — an empty period reads as empty, not as an error', (await mainText()).includes('No ACRs in this period'))
  acrRows = makeAcrRows(213)

  // ---- Collection Attempts: the same template, minus the row action ----
  attemptsCalls = 0
  lastAttemptsQuery = ''
  await page.goto(BASE + ROUTES.attempts)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const qt = () => new URLSearchParams(lastAttemptsQuery)
  check('255 — Attempts queries on MOUNT', attemptsCalls === 1, `${attemptsCalls} calls`)
  check(
    '255 — …and it queries TODAY, as a pair, at the system cap',
    qt().get('FromDate') === TODAY && qt().get('ToDate') === TODAY && qt().get('Limit') === '2000',
    lastAttemptsQuery,
  )
  check(
    '255 — an unset store/collector/reason is DROPPED, not sent empty',
    !lastAttemptsQuery.includes('StoreCode') &&
      !lastAttemptsQuery.includes('CollectorStaffId') &&
      !lastAttemptsQuery.includes('ReasonCode'),
    lastAttemptsQuery,
  )
  check(
    '255 — the floating filter row is visible on arrival',
    (await page.locator('.ag-floating-filter').count()) > 0,
  )

  const attemptSummary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('255 — Attempts pages at 50 with the whole 174 present', /1 to 50 of 174/.test(attemptSummary), attemptSummary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const attemptSummary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check(
    '255 — Next walks the SAME fetched result, with no second request',
    /51 to 100 of 174/.test(attemptSummary2) && attemptsCalls === 1,
    `${attemptSummary2} · ${attemptsCalls} calls`,
  )
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  const byStoreCode = await filterBy('storeCode', '1003')
  check(
    '255 — a per-column filter narrows all 174, not the 50 on screen',
    byStoreCode.total > 0 && byStoreCode.total < 174,
    byStoreCode.summary,
  )
  await filterBy('storeCode', '')

  const attemptHeaders = await headerText()
  check('255 — the Attempts forensic tail is folded away on arrival', !attemptHeaders.includes('Shift Id'))
  await page.getByRole('button', { name: 'More columns' }).click()
  const attemptOpened = (await allHeaders()).join(' | ')
  check(
    '255 — More columns reveals the tail (Reason Detail, Business Date, Shift Id, Collector Id)',
    ['Reason Detail', 'Business Date', 'Shift Id', 'Collector Id'].every((h) => attemptOpened.includes(h)),
    attemptOpened.slice(0, 260),
  )
  check('255 — and nothing was dropped to make room', attemptOpened.includes('Attempt Time') && attemptOpened.includes('Store Code'))
  await page.getByRole('button', { name: 'More columns' }).click()

  // ⚠️ THE DELIBERATE ABSENCE. An attempt is immutable evidence, not a voucher —
  // the WPF withholds a row action on purpose and so does this screen. Asserted
  // rather than assumed, because "we forgot" and "we decided not to" look
  // identical in a screenshot.
  check(
    '255 — Collection Attempts exposes NO row action: no button inside any row',
    (await page.locator('.ag-center-cols-container .ag-row button').count()) === 0,
  )
  check(
    '255 — …and no action column either',
    (await page.locator('[col-id="actions"]').count()) === 0,
  )
  const urlBeforeRowClick = page.url()
  await page.locator('.ag-row[row-index="0"] [col-id="storeCode"]').click()
  await page.waitForTimeout(400)
  check(
    '255 — …and clicking a row goes nowhere, opens nothing',
    page.url() === urlBeforeRowClick && (await page.locator('[role="dialog"]').count()) === 0,
    page.url(),
  )

  // ---- the reason filter, Search/Reset, and the cap ----
  const callsBeforeReason = attemptsCalls
  await page.getByPlaceholder('Reason code').fill('OTHER')
  await page.waitForTimeout(300)
  check(
    '255 — typing a reason code fires NO query (a draft is not a search)',
    attemptsCalls === callsBeforeReason,
    `${attemptsCalls} vs ${callsBeforeReason}`,
  )
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Search promotes it under the endpoint’s own ReasonCode name',
    qt().get('ReasonCode') === 'OTHER',
    lastAttemptsQuery,
  )
  check('255 — …and the Filtered chip lights', (await page.getByText('Filtered').count()) > 0)
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Reset returns to today with the reason cleared',
    qt().get('FromDate') === TODAY && !lastAttemptsQuery.includes('ReasonCode'),
    lastAttemptsQuery,
  )

  attemptRows = makeAttemptRows(2000)
  await page.goto(BASE + ROUTES.attempts)
  await page.waitForLoadState('networkidle')
  check('255 — 2,000 attempts REACHED the cap: the amber banner fires', /reached the 2,000-row system cap/.test(await mainText()))
  attemptRows = []
  await page.goto(BASE + ROUTES.attempts)
  await page.waitForLoadState('networkidle')
  check('255 — an empty period reads as empty, not as an error', (await mainText()).includes('No attempts in this period'))
  attemptRows = makeAttemptRows(174)

  // ============ ticket 256 — Deposits shows its lines and balances in place ============
  // The same landing/paging/toggle/filter-row proof as 254, plus the three things
  // that are this screen's own: a detail region that FOLLOWS THE SELECTED ROW out
  // of the response already in the browser, the drift flag on a claimed ACR that
  // moved after banking, and the collapsible POSTED-only balances panel.

  depositRows = makeDepositRows(163)
  depositBalances = makeBalances()
  depositsCalls = 0
  lastDepositsQuery = ''
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const qd = () => new URLSearchParams(lastDepositsQuery)
  check('256 — Deposits queries on MOUNT (no Load button to press)', depositsCalls === 1, `${depositsCalls} calls`)
  check(
    '256 — …and it queries TODAY, as a pair, at the system cap',
    qd().get('FromDate') === TODAY && qd().get('ToDate') === TODAY && qd().get('Limit') === '2000',
    lastDepositsQuery,
  )
  check(
    '256 — an unset number/collector/bank is DROPPED, not sent as an empty string',
    !lastDepositsQuery.includes('DepositNumber') &&
      !lastDepositsQuery.includes('CollectorOperatorId') &&
      !lastDepositsQuery.includes('BankCode'),
    lastDepositsQuery,
  )
  check(
    '256 — Status = All sends NOTHING: no Status param at all',
    !lastDepositsQuery.includes('Status'),
    lastDepositsQuery,
  )
  check(
    '256 — the floating filter row is visible on arrival (inverting BBY’s default)',
    (await page.locator('.ag-floating-filter').count()) > 0,
  )

  const depositSummary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('256 — Deposits pages at 50 with the whole 163 present', /1 to 50 of 163/.test(depositSummary), depositSummary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const depositSummary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check(
    '256 — Next walks the SAME fetched result, with no second request',
    /51 to 100 of 163/.test(depositSummary2) && depositsCalls === 1,
    `${depositSummary2} · ${depositsCalls} calls`,
  )
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  // ---- the two stacked regions are BOTH on screen, out of the ONE response ----
  const detail = page.locator('[data-region="deposit-detail"]')
  check('256 — the detail region is STACKED IN PLACE, not behind a modal', (await detail.count()) > 0)
  check('256 — …and no dialog was opened to show it', (await page.locator('[role="dialog"]').count()) === 0)
  check(
    '256 — the balances panel is on screen too, still on ONE request',
    (await page.getByRole('button', { name: /Collector balances/ }).count()) === 1 && depositsCalls === 1,
    `${depositsCalls} calls`,
  )

  // ---- the region FOLLOWS the selected row, and selection costs NO fetch ----
  const detailText = async () => detail.innerText()
  check(
    '256 — it opens on the first deposit rather than on an empty panel',
    (await detailText()).includes('Deposit 5500'),
    (await detailText()).replace(/\n/g, ' ').slice(0, 90),
  )
  // 🚩 …and that row is REALLY selected, not merely described. A region that
  // defaulted to rows[0] without selecting it would show the grid highlighting
  // nothing while the panel named a deposit — two surfaces disagreeing.
  check(
    '256 — …and the grid really has that row SELECTED, so the two agree',
    (await page.locator('.ag-row-selected').count()) > 0 &&
      (await page.locator('.ag-row[row-index="0"]').first().getAttribute('class')).includes(
        'ag-row-selected',
      ),
  )
  // Row 0's claimed ACRs both still match what was banked — no flag.
  check(
    '256 — a deposit whose claimed ACRs still match renders NO drift flag',
    (await page.locator('[data-drift="true"]').count()) === 0,
  )

  const callsBeforeSelect = depositsCalls
  await page.locator('.ag-row[row-index="1"] [col-id="collectorName"]').click()
  await page.waitForTimeout(400)
  check(
    '256 — selecting a row MOVES the detail region to it',
    (await detailText()).includes('Deposit 5501'),
    (await detailText()).replace(/\n/g, ' ').slice(0, 90),
  )
  // 🚩 THE ASSERTION THE WHOLE `{ rows, balances }` SHAPE EXISTS FOR. `lines` and
  // `attachments` ride on the row, so following the selection is a re-render.
  check(
    '256 — …with NO second network call: the lines were already in the browser',
    depositsCalls === callsBeforeSelect,
    `${depositsCalls} vs ${callsBeforeSelect}`,
  )
  check(
    '256 — a claimed ACR that moved after banking renders its DRIFT FLAG',
    (await page.locator('[data-drift="true"]').count()) === 1,
    `${await page.locator('[data-drift="true"]').count()} flagged lines`,
  )
  check(
    '256 — …and the flag carries the SERVER’s own drift figure, not a subtraction',
    (await page.locator('[data-drift="true"]').innerText()).includes('400.00'),
    (await page.locator('[data-drift="true"]').innerText()).replace(/\n/g, ' '),
  )
  check(
    '256 — the line that still matches is NOT flagged alongside it',
    (await page.locator('[data-drift="false"]').count()) === 1,
  )

  // ---- deselecting is HONOURED, not swallowed ----
  // CTRL-click deselects in AG Grid. Pinning the region to the last selection
  // would leave it describing a row the grid shows as unselected; it says
  // "select a deposit" instead, which is true.
  await page
    .locator('.ag-row[row-index="1"] [col-id="collectorName"]')
    .click({ modifiers: ['Control'] })
  await page.waitForTimeout(300)
  check(
    '256 — CTRL-clicking the selected row deselects it, and the region says so',
    (await page.locator('.ag-row-selected').count()) === 0 &&
      (await detailText()).includes('Select a deposit'),
    (await detailText()).replace(/\n/g, ' ').slice(0, 90),
  )
  await page.locator('.ag-row[row-index="1"] [col-id="collectorName"]').click()
  await page.waitForTimeout(300)
  check(
    '256 — …and picking it again brings the region back, still with no request',
    (await detailText()).includes('Deposit 5501') && depositsCalls === callsBeforeSelect,
    `${depositsCalls} calls`,
  )

  // ---- the slips are ordinary links opening in a new tab ----
  const slip = page.getByRole('link', { name: 'slip-5501-a.jpg' })
  check('256 — each slip is an ordinary link', (await slip.count()) === 1)
  check('256 — …opening in a NEW TAB', (await slip.getAttribute('target')) === '_blank')
  check(
    '256 — …and it cannot reach back through window.opener',
    (await slip.getAttribute('rel')).includes('noopener'),
    await slip.getAttribute('rel'),
  )

  // ---- the balances panel: labelled POSTED only, collapses and reopens ----
  const balancesToggle = page.getByRole('button', { name: /Collector balances/ })
  check(
    '256 — the balances panel says POSTED only on its face',
    (await balancesToggle.innerText()).includes('POSTED only'),
    (await balancesToggle.innerText()).replace(/\n/g, ' '),
  )
  check('256 — it is open on arrival', (await balancesToggle.getAttribute('aria-expanded')) === 'true')
  check(
    '256 — …showing a row per collector, out of the SAME response',
    (await mainText()).includes('Collector 4471') && depositsCalls === callsBeforeSelect,
  )
  const outstandingText = await mainText()
  check(
    '256 — a negative outstanding keeps its own sign (last trip’s shortfall has landed)',
    outstandingText.includes('-412.50'),
  )
  await balancesToggle.click()
  await page.waitForTimeout(200)
  check(
    '256 — it COLLAPSES to reclaim the height',
    (await balancesToggle.getAttribute('aria-expanded')) === 'false' &&
      !(await mainText()).includes('Outstanding'),
  )
  await balancesToggle.click()
  await page.waitForTimeout(200)
  check(
    '256 — …and REOPENS, still without a request',
    (await balancesToggle.getAttribute('aria-expanded')) === 'true' &&
      (await mainText()).includes('Outstanding') &&
      depositsCalls === callsBeforeSelect,
    `${depositsCalls} calls`,
  )

  // ---- money, the sentinels, and the forensic tail ----
  const depositHeaders = await headerText()
  check(
    '256 — money states NO currency in the header (the deposit row carries none)',
    depositHeaders.includes('Calculated') && !depositHeaders.includes('Calculated ('),
    depositHeaders.slice(0, 200),
  )
  const bankedCell = page.locator('.ag-row[row-index="0"] [col-id="realAmount"]')
  check(
    '256 — …and still groups to two decimals, right-aligned',
    (await bankedCell.innerText()).trim() === '143,910.75' &&
      (await bankedCell.getAttribute('class')).includes('text-end'),
    await bankedCell.innerText(),
  )
  check('256 — the Deposits forensic tail is folded away on arrival', !depositHeaders.includes('Void Reason'))
  await page.getByRole('button', { name: 'More columns' }).click()
  const depositOpened = (await allHeaders()).join(' | ')
  check(
    '256 — More columns reveals the tail (Created, Bank Code, Note, the void trail)',
    ['Created', 'Bank Code', 'Note', 'Voided By', 'Voided', 'Void Reason'].every((h) =>
      depositOpened.includes(h),
    ),
    depositOpened.slice(0, 300),
  )
  check(
    '256 — and nothing was dropped to make room',
    depositOpened.includes('Deposit No#') && depositOpened.includes('Banked'),
  )
  // Row 0 was never voided: Voided is BLANK, not the .NET year-1 sentinel.
  const voidedCell = page.locator('.ag-row[row-index="0"] [col-id="voidedAt"]')
  check(
    '256 — a deposit that was never voided shows a blank Voided, not 0001-01-01',
    (await voidedCell.innerText()).trim() === '',
    JSON.stringify(await voidedCell.innerText()),
  )
  await page.getByRole('button', { name: 'More columns' }).click()

  // ⚠️ THE DELIBERATE ABSENCE, a second time and for a different reason than
  // Attempts': Deposit Inquiry has no printable document at all, so there is no
  // row action for 257 to add later.
  check(
    '256 — Deposits exposes NO row action: no button inside any grid row',
    (await page.locator('.ag-center-cols-container .ag-row button').count()) === 0,
  )

  // ---- the criteria DRAFT: typing does not query; Search does ----
  const callsBeforeBank = depositsCalls
  await page.getByPlaceholder('Bank code').fill('ANB')
  await page.waitForTimeout(300)
  check(
    '256 — typing a bank code fires NO query (a draft is not a search)',
    depositsCalls === callsBeforeBank,
    `${depositsCalls} vs ${callsBeforeBank}`,
  )
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('256 — Search promotes it under BankCode', qd().get('BankCode') === 'ANB', lastDepositsQuery)
  check('256 — …and the Filtered chip lights', (await page.getByText('Filtered').count()) > 0)

  // ---- the segmented Status control drives a REAL re-query ----
  const depositStatus = (name) => page.getByRole('radio', { name, exact: true })
  check('256 — the Status control offers exactly three states', (await page.getByRole('radio').count()) === 3)
  await depositStatus('Posted').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — POSTED travels as the server’s own string',
    qd().get('Status') === 'POSTED',
    lastDepositsQuery,
  )
  await depositStatus('Void').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('256 — VOID re-queries too', qd().get('Status') === 'VOID', lastDepositsQuery)
  await depositStatus('All').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — going back to All REMOVES the param rather than sending "All"',
    !lastDepositsQuery.includes('Status'),
    lastDepositsQuery,
  )

  // ---- the Deposit No# box, and Reset ----
  await page.getByPlaceholder('Number').fill('5501')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — the Deposit No# travels as DepositNumber, never as DepositId (the ULID)',
    qd().get('DepositNumber') === '5501' && !lastDepositsQuery.includes('DepositId'),
    lastDepositsQuery,
  )
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — Reset returns to today with the number, bank and status cleared',
    qd().get('FromDate') === TODAY &&
      !lastDepositsQuery.includes('DepositNumber') &&
      !lastDepositsQuery.includes('BankCode') &&
      !lastDepositsQuery.includes('Status'),
    lastDepositsQuery,
  )
  check('256 — and the Filtered chip goes with it', (await page.getByText('Filtered').count()) === 0)

  // ---- the cap banner: reached, not merely large ----
  depositRows = makeDepositRows(1999)
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  check('256 — 1,999 deposits is merely large: NO banner', !CAP_TEXT.test(await mainText()))
  depositRows = makeDepositRows(2000)
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  check('256 — 2,000 deposits REACHED the cap: the amber banner fires', CAP_TEXT.test(await mainText()))

  // ---- an empty day says so, and takes both regions with it ----
  depositRows = []
  depositBalances = []
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  const emptyDeposits = await mainText()
  check(
    '256 — an empty period reads as empty, not as an error',
    emptyDeposits.includes('No deposits in this period') && !CAP_TEXT.test(emptyDeposits),
  )
  depositRows = makeDepositRows(163)
  depositBalances = makeBalances()

  // ============ ticket 257 — a row opens its document, and an ACR its collections ============
  // The seam where the four screens meet the two documents. Three claims:
  //   1. Receipt ▸ and Form ▸ are ADDRESSES in a NEW TAB — the grid keeps its
  //      search, scroll and selection, and a document can be pasted into a ticket;
  //   2. Collections ▸ walks to Cash Collections scoped to that ACR in the SAME
  //      tab, and the scoped query carries AcrId and OMITS store/collector/period;
  //   3. the chip overrides and DISABLES the four inputs, survives a reload, and
  //      clears back to the ordinary today screen.

  // 🚩 Row 0 of each grid is given a FIXTURE KEY as its id, so that following the
  // link actually renders a document rather than the (correct, but uninteresting)
  // "this document no longer exists" backstop. Row 1's receipt id is blanked on
  // purpose: `CollectionReceiptId` is a server change still in flight (BackOffice
  // 1089), so an empty one is a real arrival and must draw NO link at all.
  collectionsRows = makeRows(347)
  collectionsRows[0].collectionReceiptId = 'posted'
  collectionsRows[1].collectionReceiptId = ''
  acrRows = makeAcrRows(213)
  acrRows[0].acrId = 'three-pages'

  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const receiptLink = page.locator('.ag-row[row-index="0"] [col-id="actions"] a')
  check('257 — Cash Collections draws a row action', (await receiptLink.count()) === 1)
  check(
    '257 — Receipt ▸ addresses the document by its ULID',
    (await receiptLink.getAttribute('href')) === '/collection/receipt/posted',
    await receiptLink.getAttribute('href'),
  )
  check(
    '257 — …in a NEW TAB, so the grid keeps its search, scroll and selection',
    (await receiptLink.getAttribute('target')) === '_blank',
    await receiptLink.getAttribute('target'),
  )
  check(
    '257 — …and it cannot reach back through window.opener',
    (await receiptLink.getAttribute('rel')).includes('noopener'),
    await receiptLink.getAttribute('rel'),
  )
  check(
    '257 — a row with NO receipt id draws no link at all (1089 is still in flight)',
    (await page.locator('.ag-row[row-index="1"] [col-id="actions"] a').count()) === 0,
  )

  // The address really resolves — a link that 404s is a broken action, not a link.
  await page.goto(BASE + '/collection/receipt/posted')
  await page.waitForLoadState('networkidle')
  check(
    '257 — Receipt ▸ resolves to a RENDERING document, not to the miss backstop',
    (await page.locator('.print-sheet').count()) === 1,
    `${await page.locator('.print-sheet').count()} sheets`,
  )

  // ---- the ACRs grid's two actions ----
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const acrActions = page.locator('.ag-row[row-index="0"] [col-id="actions"] a')
  check('257 — an ACR row offers exactly TWO ways out', (await acrActions.count()) === 2)
  const formLink = acrActions.first()
  const collectionsLink = acrActions.nth(1)
  check(
    '257 — Form ▸ addresses the ACR document, in a NEW TAB',
    (await formLink.getAttribute('href')) === '/collection/acr/three-pages' &&
      (await formLink.getAttribute('target')) === '_blank',
    `${await formLink.getAttribute('href')} · ${await formLink.getAttribute('target')}`,
  )
  check(
    '257 — Collections ▸ carries the ACR as a query param — one SHAREABLE URL',
    (await collectionsLink.getAttribute('href')) === '/collection/collections?acr=three-pages',
    await collectionsLink.getAttribute('href'),
  )
  check(
    '257 — …and it stays in the SAME tab (a drill-down is not a document)',
    (await collectionsLink.getAttribute('target')) === null,
    await collectionsLink.getAttribute('target'),
  )

  // ⚠️ A RAGGED SESSION is an ordinary one: the four grants are independent, so an
  // account that can read ACRs and not Cash Collections exists. It keeps Form ▸
  // and is not offered a drill-down that would walk it into a denial screen.
  scenario = { accessBody: { ...NONE, canOpenAcrs: true }, access403: false, access500: false }
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  const raggedActions = page.locator('.ag-row[row-index="0"] [col-id="actions"] a')
  check(
    '257 — an ACR-only session keeps Form ▸ but is NOT offered Collections ▸',
    (await raggedActions.count()) === 1 &&
      (await raggedActions.first().getAttribute('href')) === '/collection/acr/three-pages',
    `${await raggedActions.count()} actions`,
  )
  scenario = { accessBody: ALL, access403: false, access500: false }

  await page.goto(BASE + '/collection/acr/three-pages')
  await page.waitForLoadState('networkidle')
  check(
    '257 — Form ▸ resolves to a RENDERING document across its pages',
    (await page.locator('.print-sheet').count()) === 3,
    `${await page.locator('.print-sheet').count()} sheets`,
  )

  // ---- Collections ▸ : the drill-down, clicked for real ----
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  collectionsCalls = 0
  lastCollectionsQuery = ''
  await page.locator('.ag-row[row-index="0"] [col-id="actions"] a').nth(1).click()
  // ⚠️ It is a ROUTER navigation, not a document load: there is no load event to
  // wait on, and the ACRs grid's own rows are still on screen while it happens.
  // Waiting on the URL is what makes this assertion about the drill-down rather
  // than about a race.
  await page.waitForURL('**/collection/collections?acr=three-pages', { timeout: 5000 })
  // …and then on a control only THIS screen has: the ACRs grid's rows are still
  // mounted while the lazy route loads, so `.ag-row` would resolve against the
  // screen we are leaving.
  await page.getByPlaceholder('Store code').waitFor({ timeout: 5000 })
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  check(
    '257 — Collections ▸ lands on Cash Collections, scoped, in the same tab',
    page.url().endsWith('/collection/collections?acr=three-pages'),
    page.url(),
  )
  // ⚠️ THE ASSERTION THE WHOLE CHIP EXISTS FOR. `AcrId` is an EXCLUSIVE filter:
  // the door ignores store, collector and period entirely when one is set, so
  // sending them would leave a query string that reads as a period filter.
  check(
    '257 — the scoped query carries AcrId and the cap…',
    q().get('AcrId') === 'three-pages' && q().get('Limit') === '2000',
    lastCollectionsQuery,
  )
  check(
    '257 — …and OMITS store, collector and the period entirely',
    !lastCollectionsQuery.includes('StoreId') &&
      !lastCollectionsQuery.includes('CollectorOperatorId') &&
      !lastCollectionsQuery.includes('FromDate') &&
      !lastCollectionsQuery.includes('ToDate'),
    lastCollectionsQuery,
  )

  const chip = page.getByText('three-pages')
  check('257 — a chip NAMES the ACR the view is scoped to', (await chip.count()) === 1)
  check(
    '257 — …and it REPLACES the Filtered chip rather than sitting beside it',
    (await page.getByText('Filtered').count()) === 0,
  )

  // The disabling is HONESTY, not decoration: a live date input over a scoped
  // result would let a supervisor set a range that silently does nothing.
  const dateInputs = page.locator('form input[type="date"]')
  check(
    '257 — the chip DISABLES From and To',
    (await dateInputs.nth(0).isDisabled()) && (await dateInputs.nth(1).isDisabled()),
  )
  check(
    '257 — …and Store and Collector',
    (await page.getByPlaceholder('Store code').isDisabled()) &&
      (await page.getByPlaceholder('Operator id').isDisabled()),
  )
  check(
    '257 — …and Search, since there is nothing left to promote',
    await page.getByRole('button', { name: 'Search' }).isDisabled(),
  )
  // ⚠️ OVERRIDDEN, not merely locked. A greyed box still reading today's date over
  // a grid scoped to an ACR that spans weeks would say "this period was applied and
  // then frozen" — the exact misreading the disabling exists to prevent.
  check(
    '257 — …and every overridden input shows NOTHING, not a frozen value',
    (await dateInputs.nth(0).inputValue()) === '' &&
      (await dateInputs.nth(1).inputValue()) === '' &&
      (await page.getByPlaceholder('Store code').inputValue()) === '',
    `${await dateInputs.nth(0).inputValue()} · ${await dateInputs.nth(1).inputValue()}`,
  )

  // ---- the URL really is the scope: a reload reproduces the view ----
  collectionsCalls = 0
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  check(
    '257 — a RELOAD reproduces the scoped view (the URL is the only state there is)',
    q().get('AcrId') === 'three-pages' && (await page.getByText('three-pages').count()) === 1,
    `${lastCollectionsQuery} · ${page.url()}`,
  )

  // ---- clearing the chip: the param goes, and today comes back ----
  await page.getByRole('button', { name: 'Clear the ACR and go back to today' }).click()
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  // The re-query rides a re-render rather than a page load, so wait on the REQUEST
  // rather than on the URL — otherwise this asserts against the scoped query that
  // has not been replaced yet.
  for (let i = 0; i < 30 && lastCollectionsQuery.includes('AcrId'); i++)
    await page.waitForTimeout(100)
  check(
    '257 — clearing the chip DROPS the param from the URL',
    !page.url().includes('acr='),
    page.url(),
  )
  check(
    '257 — …and restores the ordinary today-filtered query',
    q().get('FromDate') === TODAY && q().get('ToDate') === TODAY && !lastCollectionsQuery.includes('AcrId'),
    lastCollectionsQuery,
  )
  check('257 — …with the chip gone', (await page.getByText('three-pages').count()) === 0)
  check(
    '257 — …and the four inputs live again',
    !(await dateInputs.nth(0).isDisabled()) &&
      !(await page.getByPlaceholder('Store code').isDisabled()) &&
      !(await page.getByRole('button', { name: 'Search' }).isDisabled()),
  )

  // ---- a hand-typed scope with no collections behind it reads as such ----
  collectionsRows = []
  await page.goto(BASE + ROUTES.collections + '?acr=three-pages')
  await page.waitForLoadState('networkidle')
  const scopedEmpty = await mainText()
  check(
    '257 — an ACR with nothing under it says SO, not "no collections in this period"',
    scopedEmpty.includes('No collections under this ACR'),
    scopedEmpty.replace(/\n/g, ' ').slice(0, 120),
  )
  collectionsRows = makeRows(347)

  // ============================================================================
  // ticket 258 — the export writes a file the accountant can SUMS
  // ============================================================================
  // ⚠️ The two escaping rules are split BY COLUMN, and getting it wrong looks
  // completely right: a money column wrapped in `="…"` is TEXT, and `SUM` over it
  // silently reads zero. So this section reads the downloaded bytes back and
  // asserts the classes separately.
  //
  // The other half of the ticket is that the file is the view the accountant
  // BUILT — filtered, sorted, and carrying the folded columns even with the
  // More-columns toggle OFF. That is why the grid is filtered and sorted first.

  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  check('258 — an Export button sits beside the two toggles', (await page.getByRole('button', { name: 'Export' }).count()) === 1)

  // ---- filter to one store, then sort by the money column, descending ----
  // Store `1003` is every 7th mock row → 50 of the 347.
  const exportFiltered = await filterBy('storeId', '1003')
  check('258 — the grid is narrowed to one store before exporting', exportFiltered.total === 50, exportFiltered.summary)
  // The label, not the cell: `.ag-header-cell[col-id=…]` also matches the floating
  // filter row's cell, and only the header row sorts.
  const netHeader = page.locator('.ag-header-cell[col-id="netCollected"] .ag-header-cell-label')
  await netHeader.click()
  await page.waitForTimeout(200)
  await netHeader.click() // second click = descending
  await page.waitForTimeout(400)

  const [csvDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'Export' }).click(),
  ])

  const exportName = csvDownload.suggestedFilename()
  check(
    '258 — the file is named for the SCREEN and the day, with no time in it',
    exportName === `collection-collections-${TODAY}.csv`,
    exportName,
  )

  const csv = readFileSync(await csvDownload.path(), 'utf8')
  // The BOM is what makes the Arabic names render on an Excel double-click; the
  // `sep=,` line is because Excel's double-click path uses the OS list separator
  // — `;` in an Arabic locale — rather than the comma.
  check('258 — it opens in columns in any locale (BOM + sep=)', csv.startsWith('﻿sep=,'), JSON.stringify(csv.slice(0, 12)))

  /** Split one CSV line into cells, respecting the RFC-4180 quoting. */
  const splitRow = (line) => {
    const cells = []
    let current = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && quoted && line[i + 1] === '"') { current += '""'; i++ }
      else if (ch === '"') { quoted = !quoted; current += ch }
      else if (ch === ',' && !quoted) { cells.push(current); current = '' }
      else current += ch
    }
    cells.push(current)
    return cells
  }
  const csvLines = csv.replace(/^﻿/, '').split('\r\n').filter((l) => l !== '')
  const csvHeader = splitRow(csvLines[1])
  const csvBody = csvLines.slice(2).map(splitRow)
  const col = (name) => csvHeader.indexOf(name)
  /** One cell as EXCEL reads it — the transport quoting undone. */
  const at = (row, name) => {
    const raw = row[col(name)] ?? ''
    return raw.startsWith('"') && raw.endsWith('"') && raw.length > 1
      ? raw.slice(1, -1).replace(/""/g, '"')
      : raw
  }

  // ---- every column ships, toggle or no toggle ----
  // 🚩 The More-columns toggle is OFF right now — the forensic tail is not even in
  // the grid. The file is the ROW unpacked, not the grid screenshotted.
  check(
    '258 — the folded columns are in the file with the toggle OFF',
    col('Retained Float') >= 0 && col('Currency') >= 0 && col('Z Reports') >= 0 && col('Sales Date') >= 0,
    csvHeader.join('|').slice(0, 200),
  )
  check(
    '258 — …and the default columns are all there too (24 in all)',
    csvHeader.length === 24 && col('Receipt No#') >= 0 && col('Net Collected') >= 0,
    `${csvHeader.length} headers`,
  )
  // ⚠️ The screen's money header is `Net Collected (SAR)`; the file's is bare and
  // Currency rides as its own column. A header whose shape changed with the result
  // would make two exports of the same column disagree.
  check('258 — the money header is BARE, and Currency is its own column', col('Net Collected (SAR)') === -1 && at(csvBody[0], 'Currency') === 'SAR')

  // ---- only the filtered rows, in the sorted order ----
  check('258 — the file holds ONLY the filtered rows (50 of 347), not the page and not the lot', csvBody.length === 50, `${csvBody.length} rows`)
  check(
    '258 — …all of them the store that was filtered to',
    csvBody.every((r) => at(r, 'Store') === '="1003"'),
    at(csvBody[0], 'Store'),
  )
  const netValues = csvBody.map((r) => Number(at(r, 'Net Collected')))
  check(
    '258 — …in the DESCENDING order the header click put them in',
    netValues.every((v, i) => i === 0 || netValues[i - 1] >= v),
    `${netValues[0]} … ${netValues[netValues.length - 1]}`,
  )

  // ---- the money rule: bare, and therefore summable ----
  // ⚠️ THE assertion the whole ticket exists for.
  //
  // 🚩 DERIVED BY SUBTRACTION, not hand-listed. `csv.test.ts` gets its list from
  // `columns.filter(c => c.kind === 'money')`; the drive cannot import the TS module, so it
  // takes the file's own header row and removes the columns that are declared NOT money.
  // The point is the direction of the default: a column added to the screen tomorrow lands
  // in this sweep and must prove itself bare, rather than being silently skipped. The
  // hand-typed list this replaces had exactly that failure — it omitted `Variance`, the one
  // signed column on the screen and the one an accountant reconciles a shortfall on, so a
  // `Variance` mis-declared as `identity` would have passed the drive.
  const NON_MONEY = new Set([
    'Receipt No#', 'Store', 'Store Name', 'Collector', 'Collected', 'Reason',
    'Opened', 'Closed', 'Card Slips', 'Reason Detail', 'Collector Id', 'Z Reports',
    'Closer Id', 'Closer', 'Sales Date', 'Currency',
  ])
  const moneyCols = csvHeader.filter((h) => !NON_MONEY.has(h))
  check(
    '258 — the money sweep covers every money column, Variance included (derived, not hand-listed)',
    moneyCols.length === 8 && moneyCols.includes('Variance'),
    `${moneyCols.length}: ${moneyCols.join(', ')}`,
  )
  const badMoney = []
  for (const row of csvBody)
    for (const name of moneyCols) {
      const cell = at(row, name)
      if (cell !== '' && !/^-?\d+(\.\d+)?$/.test(cell)) badMoney.push(`${name}=${cell}`)
    }
  check(
    '258 — every money cell is a BARE number: no separator, no symbol, no ="…" wrapper',
    badMoney.length === 0,
    badMoney.slice(0, 3).join(' | '),
  )
  check(
    '258 — …and a real amount really is in there (not a column of blanks)',
    Number(at(csvBody[0], 'Net Collected')) > 0,
    at(csvBody[0], 'Net Collected'),
  )
  // 🚩 The sweep above SKIPS empty cells, so a money column that is blank all the way
  // down proves nothing — which is exactly how `Variance` slipped through. Assert the
  // signed column has substance, and that its minus survives as a bare `-` rather than
  // as a wrapper or a parenthesis.
  const variances = csvBody.map((r) => at(r, 'Variance')).filter((v) => v !== '')
  check(
    '258 — Variance is a column with substance, negatives included, not blanks',
    variances.length === csvBody.length &&
      variances.some((v) => Number(v) < 0) &&
      variances.every((v) => /^-?\d+(\.\d+)?$/.test(v)),
    `${variances.length}/${csvBody.length} filled · e.g. ${variances.slice(0, 3).join(', ')}`,
  )

  // ---- the identity rule: wrapped, and therefore unmangled ----
  check(
    '258 — the receipt number keeps the ="…" wrapper the workbook keys on',
    /^="\d+"$/.test(at(csvBody[0], 'Receipt No#')),
    at(csvBody[0], 'Receipt No#'),
  )
  check(
    '258 — …and so does the collector id',
    /^="\d+"$/.test(at(csvBody[0], 'Collector Id')),
    at(csvBody[0], 'Collector Id'),
  )

  // ---- dates are ISO text, and the .NET sentinel is blank ----
  check(
    '258 — a datetime column is raw ISO text, seconds and all',
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(at(csvBody[0], 'Collected')),
    at(csvBody[0], 'Collected'),
  )
  check(
    '258 — a day-only column is yyyy-MM-dd',
    /^\d{4}-\d{2}-\d{2}$/.test(at(csvBody[0], 'Sales Date')),
    at(csvBody[0], 'Sales Date'),
  )

  // ---- a view filtered down to NOTHING offers no file ----
  // ⚠️ The button tracks what the FILE would hold, not what the query returned:
  // the export writes the rows after the filter, so a grid narrowed to nothing
  // must not hand back a headers-only CSV under the day's name.
  const emptyFilter = await filterBy('storeId', 'no-such-store')
  check('258 — a filter that matches nothing empties the grid', emptyFilter.total === 0, emptyFilter.summary)
  check(
    '258 — …and the Export button goes DISABLED rather than writing a headers-only file',
    await page.getByRole('button', { name: 'Export' }).isDisabled(),
  )
  await filterBy('storeId', '')
  check(
    '258 — …and comes back live when the filter does',
    await page.getByRole('button', { name: 'Export' }).isEnabled(),
  )

  // ---- Arabic survives the round trip ----
  // 🚩 Copied from `voucher-fixture.ts`, never retyped: a retyped Arabic string
  // looks right and is silently wrong, and no gate in this repo catches it.
  const ARABIC_NAME = 'عبدالله بن ناصر القحطاني'
  collectionsRows = makeRows(20).map((r) => ({ ...r, collectorName: ARABIC_NAME }))
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  const [arabicDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'Export' }).click(),
  ])
  const arabicCsv = readFileSync(await arabicDownload.path(), 'utf8')
  check('258 — an Arabic collector name round-trips intact', arabicCsv.includes(ARABIC_NAME))
  collectionsRows = makeRows(347)

  // ---- the other three screens export too, on the same two rules ----
  // ⚠️ **One writer, four screens** — so what each of these proves is that the
  // screen passed its OWN column definitions: the header count, the money columns
  // left bare and the identity columns wrapped are per-screen facts, and the two
  // that carry no money at all (Attempts) or no currency (ACRs, Deposits) are the
  // cases a writer designed against Cash Collections alone would get wrong.
  const OTHERS = [
    {
      key: 'acrs',
      route: ROUTES.acrs,
      headers: 15,
      // The folded tail, present with the More-columns toggle OFF.
      folded: ['Created', 'Deposit No#', 'Deposit Id'],
      money: ['Net Collected', 'Card Total'],
      identity: 'ACR No#',
    },
    {
      key: 'deposits',
      route: ROUTES.deposits,
      headers: 16,
      folded: ['Created', 'Bank Code', 'Voided By', 'Void Reason'],
      money: ['Calculated', 'Banked', 'Difference'],
      identity: 'Deposit No#',
    },
    {
      key: 'attempts',
      route: ROUTES.attempts,
      headers: 9,
      folded: ['Reason Detail', 'Business Date', 'Shift Id', 'Collector Id'],
      // 🚩 None. An attempt collected nothing — that is what makes it an attempt.
      money: [],
      identity: 'Store Code',
    },
  ]
  for (const screen of OTHERS) {
    await page.goto(BASE + screen.route)
    await page.waitForLoadState('networkidle')
    await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: 'Export' }).click(),
    ])
    check(`258 — ${screen.key} exports its own file`, d.suggestedFilename() === `collection-${screen.key}-${TODAY}.csv`, d.suggestedFilename())

    const raw = readFileSync(await d.path(), 'utf8')
    check(`258 — ${screen.key}: BOM + sep line`, raw.startsWith('﻿sep=,\r\n'))
    const rawLines = raw.replace(/^﻿/, '').split('\r\n').filter((l) => l !== '')
    const head = splitRow(rawLines[1])
    const body = rawLines.slice(2).map(splitRow)
    const cellIn = (row, name) => {
      const cellRaw = row[head.indexOf(name)] ?? ''
      return cellRaw.startsWith('"') && cellRaw.endsWith('"') && cellRaw.length > 1
        ? cellRaw.slice(1, -1).replace(/""/g, '"')
        : cellRaw
    }
    check(
      `258 — ${screen.key}: every column ships with the toggle OFF (${screen.headers})`,
      head.length === screen.headers && screen.folded.every((h) => head.includes(h)),
      head.join('|').slice(0, 200),
    )
    check(`258 — ${screen.key}: the file holds rows, not just a header`, body.length > 0, `${body.length} rows`)
    const offenders = []
    for (const row of body)
      for (const name of screen.money) {
        const value = cellIn(row, name)
        if (value !== '' && !/^-?\d+(\.\d+)?$/.test(value)) offenders.push(`${name}=${value}`)
      }
    check(
      `258 — ${screen.key}: every money cell is BARE and summable (${screen.money.length} columns)`,
      offenders.length === 0,
      offenders.slice(0, 3).join(' | '),
    )
    check(
      `258 — ${screen.key}: ${screen.identity} keeps the ="…" wrapper`,
      /^="[^"]+"$/.test(cellIn(body[0], screen.identity)),
      cellIn(body[0], screen.identity),
    )
  }

  // Scenarios 4 and 5 intentionally 403/500 CollectionWeb/Access, which the browser logs
  // as a resource-load failure — expected, not an app fault. Filter them out.
  const realErrors = errors.filter((e) => !/status of (403|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
