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

/** `count` rows, all SAR unless told otherwise. Row 0 carries a NULL variance —
 *  the "blank, not 0.00" proof — and row 1 a negative one. */
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
    variance: i === 0 ? null : i === 1 ? -5.5 : 0,
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

// scenario state, mutated between reloads
let scenario = { accessBody: ALL, access403: false }
let accessCalls = 0
let collectionsRows = makeRows(347)
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
