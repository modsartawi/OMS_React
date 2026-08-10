// Retail invoice drive (spec 261) — drives the REAL app in Chromium against
// STUBBED `RetailInvoice/*` envelopes.
//
// ⚠️ Stubbed by CHOICE, not because the server is missing: the rail is built and
// live (BackOffice map 984), but standing it up needs SIS.Api *and* a resident
// render host, which is ticket 266's two-process manual setup. Everything 263–265
// assert is assertable on stubs.
//
// 🚩 ONE drive file for the whole wave — 264 and 265 EXTEND this file rather than
// starting a second one (263's Proof says so). Add scenarios below; keep the
// route table in one place.
//
// Ticket 263 — the area, the nav group, the route and the gate:
//   1. screenAllowed:true  → the Reports group and its Invoices leaf are visible,
//      and the screen renders its title + landing state.
//   2. screenAllowed:false → NO Reports group at all in the menu.
//   3. a hand-typed /reports/invoice on a denied session → the no-access SENTENCE,
//      not an empty screen and not a generic "something went wrong".
//   4. the access probe is called ONCE per visit (nav leaf + screen gate share one
//      key, so a gated area costs one round trip).
//   5. every string on the screen came out of the `reports` namespace — no raw
//      `reports:` keys leaked to the page, which is what an unregistered namespace
//      would render.
//
// Ticket 264 — one field finds an invoice (scenarios 6–11 below):
//   6. the LANDING state is not an empty result — nothing fires on mount, and the
//      sentence is "nothing to show yet", not "no invoice carries that number".
//   7. the local required-field refusal — Search on a blank number issues NOTHING.
//   8. `rows: []` reads as a SUCCESSFUL answer: a different sentence from an error.
//   9. one match is still a one-row LIST, never an automatic anything — and the
//      list is unfiltered, so a CashClearance row is in it, with `trxType` and
//      `trxStatus` visible without any toggle.
//  10. a bare 403 (no envelope, no errorCode) on Search reads as a REFUSAL, not as
//      an empty grid and not as a generic failure.
//  11. a failed search is REPEATABLE — pressing Search again on the same number
//      re-asks the server rather than being answered from the react-query cache.
//  12. emptying the number and searching clears the stale rows, not just the field.
//  13. Reset returns the screen to the landing state.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs) —
// it is NOT a dependency of this repo.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/invoice-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const URL = BASE + '/reports/invoice'

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

// Scenario state, mutated between reloads. `accessBody` is the probe's 200 answer;
// `accessStatus` lets a scenario refuse the probe itself (an unmarked route, or a
// cookie branch that said no — issue 802), which is a different arm from a 200
// denial.
let scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
// How many times `RetailInvoice/Access` was asked, per visit.
let accessCalls = 0

// ---- 264: the Search stub ---------------------------------------------------
// `searchStatus` 200 answers `searchBody`; anything else is a failure. ⚠️ A 403
// on this rail is a BARE refusal — no envelope, no errorCode at all — so it is
// fulfilled with an empty body rather than through `envelope()`, which is the
// whole point of the arm.
let searchStatus = 200
let searchBody = { rows: [], capReached: false }
// Every `RetailInvoice/Search` query string seen, in order — so the drive can
// assert what was NOT sent (a blank number, an empty storeCode) as well as what was.
let searchQueries = []

/** One candidate row, contract §1's own body, overridable per scenario. */
const candidate = (over = {}) => ({
  storeCode: 'P001',
  storeName: 'صيدلية الدواء P001',
  machineCode: '01',
  trxNumber: '00114600051234',
  receiptNumber: 'R-8842',
  trxDate: '2026-08-04',
  trxTime: '14:22:13',
  trxType: 'Sales',
  trxTypeCode: 100,
  documentType: 'Cash',
  documentTypeCode: 0,
  trxStatus: 'Closed',
  trxStatusCode: 1,
  amount: 83.41,
  itemLinesCount: 3,
  customerId: 'C0042',
  customerName: 'Ahmed Ali',
  ...over,
})

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
    if (path === 'RetailInvoice/Access') {
      accessCalls++
      if (scenario.accessStatus !== 200)
        return route.fulfill(
          envelope(null, {
            status: scenario.accessStatus,
            success: false,
            message: 'Forbidden.',
            errors: [],
          }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    if (path === 'RetailInvoice/Search') {
      searchQueries.push(url.split('?')[1] || '')
      // 🚩 A bare 403: no envelope, no errorCode, no body at all. The screen has
      // only the status to branch on, which is what makes this arm worth driving.
      if (searchStatus === 403) return route.fulfill({ status: 403, body: '' })
      if (searchStatus !== 200)
        return route.fulfill(
          envelope(null, { status: searchStatus, success: false, message: 'Search failed.' }),
        )
      return route.fulfill(envelope(searchBody))
    }
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const visit = async (url) => {
    accessCalls = 0
    searchQueries = []
    await page.goto(url)
    await page.waitForLoadState('networkidle')
  }

  // Type a number into the toolbar and press Search, then let the query settle.
  const searchFor = async (trxNumber, storeCode = '') => {
    searchQueries = []
    const number = page.getByPlaceholder(/00114600051234/)
    await number.fill(trxNumber)
    const store = page.getByPlaceholder(/^Optional$/)
    await store.fill(storeCode)
    await page.getByRole('button', { name: /^Search$/ }).click()
    await page.waitForLoadState('networkidle')
  }

  // Wait for AG Grid to paint (its rows arrive a frame after the query settles).
  // Swallowed on timeout so a missing grid is a FAILING check with a message,
  // not a 30-second abort that takes the rest of the run with it — the shape
  // `bby-inquiry-drive.mjs` uses.
  const waitForRows = () => page.waitForSelector('.ag-row', { timeout: 10000 }).catch(() => {})

  // ---- Scenario 1: granted ------------------------------------------------
  scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
  await visit(URL)

  const groupBtn = page.getByRole('button', { name: /^Reports$/i })
  check('granted → the Reports group appears in the menu', (await groupBtn.count()) === 1)
  const leaf = page.getByRole('link', { name: /^Invoices$/i })
  check('granted → the Invoices leaf appears under it', (await leaf.count()) === 1)
  // Guarded on the count rather than awaiting the attribute blind: a missing leaf
  // is a FAILING check, not a 30-second timeout that aborts the run before the
  // later assertions (the raw-key one especially) get to say anything.
  const leafHref = (await leaf.count()) ? await leaf.first().getAttribute('href') : null
  check('granted → the leaf points at /reports/invoice', leafHref === '/reports/invoice', leafHref ?? 'no leaf')

  const main = await page.locator('main').innerText()
  check('granted → the screen renders its title', /Invoices/.test(main), main.split('\n')[0] || '')
  check(
    'granted → the screen renders its subtitle',
    /transaction number/i.test(main),
    main.slice(0, 120).replace(/\n/g, ' '),
  )
  check(
    '🚩 the screen LANDS EMPTY — the landing state, not a grid',
    /Nothing to show yet/i.test(main) && (await page.locator('.ag-row').count()) === 0,
    main.replace(/\n/g, ' ').slice(0, 140),
  )
  // ⚠️ 263 asserted here that there was NO search box and no grid — the boundary
  // that kept it from finishing the screen. **264 lands them**, so the assertion
  // inverts: the toolbar is present, and the grid still is not, because nothing
  // has been searched.
  check(
    '🚩 the toolbar is present and NO grid has been drawn (nothing searched yet)',
    (await page.getByPlaceholder(/00114600051234/).count()) === 1 &&
      (await page.locator('.ag-root').count()) === 0,
  )
  check(
    '🚩 focus lands on the transaction number field on mount',
    await page.getByPlaceholder(/00114600051234/).evaluate((el) => el === document.activeElement),
  )
  check(
    '🚩 nothing is searched on mount — the screen cannot guess a number',
    searchQueries.length === 0,
    searchQueries.join(' | '),
  )
  check(
    '🚩 the access probe is called ONCE per visit (nav leaf + gate share one key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // 🚩 The namespace registration is load-bearing and nothing else catches it: an
  // unregistered `reports` namespace renders the RAW KEY to the user.
  //
  // ⚠️ The tell is the KEY PATH, not the `reports:` prefix — i18next's missing-key
  // fallback drops the namespace and renders `invoice.title`, so a check that only
  // looked for `reports:` would pass on a screen showing raw keys. Measured, with
  // the registration removed: `main` read `invoice.title / invoice.subtitle /
  // invoice.landing.title / invoice.landing.hint` and the nav read `menu.invoices`.
  const shellText = await page.locator('body').innerText()
  const rawKey = shellText.match(/(?:^|\s)(?:reports:)?(?:invoice|menu|access)\.[a-zA-Z.]+/)
  check(
    '🚩 no raw i18n keys on the page — the `reports` namespace is registered',
    rawKey === null,
    (rawKey || [''])[0],
  )

  // ---- Scenario 2: denied, arriving from elsewhere ------------------------
  // The probe answers a denial with 200 — a boolean to read, never an error to
  // catch — so this is the ORDINARY refusal, not an outage.
  scenario = { accessBody: { screenAllowed: false }, accessStatus: 200 }
  await visit(BASE + '/')
  check(
    '🚩 denied → NO Reports group at all in the menu',
    (await page.getByRole('button', { name: /^Reports$/i }).count()) === 0,
  )
  check(
    'denied → no Invoices leaf either',
    (await page.getByRole('link', { name: /^Invoices$/i }).count()) === 0,
  )

  // ---- Scenario 3: denied, hand-typed URL ---------------------------------
  // 🚩 The probe only HIDES the menu. A user who pastes the URL reaches the screen
  // and must be told, in words, that they have no access.
  await visit(URL)
  const deniedText = await page.locator('main').innerText()
  check(
    '🚩 hand-typed URL on a denied session → the no-access SENTENCE',
    /No access to invoices/i.test(deniedText),
    deniedText.replace(/\n/g, ' ').slice(0, 120),
  )
  check(
    'denied screen names the remedy (ask an administrator), not a retry',
    /administrator/i.test(deniedText) && !/Try again/i.test(deniedText),
    deniedText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '🚩 denied → NOT an empty screen and NOT a generic error',
    !/Nothing to show yet/i.test(deniedText) && !/unexpected/i.test(deniedText),
    deniedText.replace(/\n/g, ' ').slice(0, 120),
  )
  check(
    'denied → the group stays hidden while standing on the screen',
    (await page.getByRole('button', { name: /^Reports$/i }).count()) === 0,
  )

  // ---- Scenario 4: the probe itself refuses (403) -------------------------
  // A different arm from a 200 denial: the route is unmarked, or the cookie branch
  // said no (issue 802). Still a REFUSAL rather than an outage, so it must not
  // invite a retry loop against a permanently shut door.
  scenario = { accessBody: null, accessStatus: 403 }
  await visit(URL)
  const refusedText = await page.locator('main').innerText()
  check(
    'a 403 on the probe reads as a refusal, not as "try again in a moment"',
    /No access to invoices/i.test(refusedText) && !/Try again/i.test(refusedText),
    refusedText.replace(/\n/g, ' ').slice(0, 120),
  )
  check(
    '🚩 a refused probe is not retried (retry:false travels with the key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // ---- Scenario 5: the probe is unreachable (500) -------------------------
  // The other sentence: an outage the user can retry, distinct from a refusal
  // they cannot.
  scenario = { accessBody: null, accessStatus: 500 }
  await visit(URL)
  const downText = await page.locator('main').innerText()
  check(
    'an unreachable probe reads as unavailable (a retry), not as a refusal',
    /unavailable/i.test(downText) && !/No access to invoices/i.test(downText),
    downText.replace(/\n/g, ' ').slice(0, 120),
  )

  // ==========================================================================
  // Ticket 264 — one field finds an invoice. Back to a granted session.
  // ==========================================================================
  scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }

  // ---- Scenario 6: the local required-field refusal ------------------------
  // 🚩 `400 TRX_NUMBER_REQUIRED` exists server-side as a defence, and reaching it
  // would be a client bug. So a blank Search must issue NOTHING.
  searchStatus = 200
  searchBody = { rows: [], capReached: false }
  await visit(URL)
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForLoadState('networkidle')
  const blankText = await page.locator('main').innerText()
  check(
    '🚩 Search on a blank number issues NO request',
    searchQueries.length === 0,
    searchQueries.join(' | '),
  )
  check(
    'the blank Search says what to type, locally',
    /Enter a transaction number to search/i.test(blankText),
    blankText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '🚩 the local refusal does NOT read as an empty result or a failure',
    !/No invoice carries that number/i.test(blankText) && !/could not be completed/i.test(blankText),
  )

  // ---- Scenario 7: a number that matches nothing ---------------------------
  // 200 with rows: [] — a SUCCESSFUL answer, never a 404 and never an error.
  await searchFor('00114600059999')
  const emptyText = await page.locator('main').innerText()
  check(
    '🚩 `rows: []` reads as "no invoice carries that number"',
    /No invoice carries that number/i.test(emptyText),
    emptyText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '🚩 …and NOT as the landing state — the two are different sentences',
    !/Nothing to show yet/i.test(emptyText),
  )
  check(
    'the empty answer is not dressed as an error',
    (await page.locator('[role="alert"]').count()) === 0,
  )
  check(
    'the search sent the trimmed number and NO empty storeCode',
    searchQueries.length === 1 &&
      searchQueries[0].includes('trxNumber=00114600059999') &&
      !searchQueries[0].includes('storeCode'),
    searchQueries.join(' | '),
  )

  // ---- Scenario 8: one match is still a one-row LIST -----------------------
  searchBody = { rows: [candidate()], capReached: false }
  await searchFor(' 00114600051234 ', ' P001 ')
  await waitForRows()
  check(
    '🚩 a single match renders as a one-row LIST, not an automatic anything',
    (await page.locator('.ag-row').count()) === 1,
  )
  const rowText = await page.locator('.ag-row').first().innerText()
  check(
    '🚩 trxType and trxStatus are visible on the row without any toggle',
    /Sales/.test(rowText) && /Closed/.test(rowText),
    rowText.replace(/\n/g, ' | '),
  )
  check(
    'the two raw date fields are JOINED for display',
    /2026-08-04 14:22:13/.test(rowText),
    rowText.replace(/\n/g, ' | '),
  )
  check(
    'the amount formats through @/core/money, the line count does not',
    /83\.41/.test(rowText) && !/3\.00/.test(rowText),
    rowText.replace(/\n/g, ' | '),
  )
  check(
    'a trimmed number and a trimmed store code went on the wire',
    searchQueries.length === 1 &&
      searchQueries[0].includes('trxNumber=00114600051234') &&
      searchQueries[0].includes('storeCode=P001'),
    searchQueries.join(' | '),
  )
  const headerText = await page.locator('.ag-header').innerText()
  check(
    '🚩 no floating filter row, no pager, no export button',
    (await page.locator('.ag-floating-filter').count()) === 0 &&
      // ⚠️ `:visible` — AG Grid always RENDERS the paging panel and hides it when
      // pagination is off, so a bare count would fail on a grid that has no pager.
      (await page.locator('.ag-paging-panel:visible').count()) === 0 &&
      (await page.getByRole('button', { name: /export/i }).count()) === 0,
    headerText.replace(/\n/g, ' | '),
  )

  // ---- Scenario 9: the list is UNFILTERED ---------------------------------
  // 🚩 Owner ruling (988): cash clearances, training and suspended sales come
  // back with everything else, unflagged. They are MEANT to be seen — the row's
  // type and status are the only thing telling an operator this is not a receipt.
  // ⚠️ An unknown documentType arriving as a NUMBER must render as that number.
  searchBody = {
    rows: [
      candidate(),
      candidate({
        trxNumber: '00114600051235',
        trxType: 'CashClearance',
        trxTypeCode: 700,
        trxStatus: 'Suspended',
        trxStatusCode: 3,
        documentType: '37',
        documentTypeCode: 37,
        amount: 0,
        itemLinesCount: 0,
      }),
    ],
    capReached: false,
  }
  await searchFor('00114600051234')
  await waitForRows()
  const gridText = await page.locator('.ag-root').innerText()
  check(
    '🚩 a CashClearance row is IN the list — the search filters nothing',
    /Cash clearance/i.test(gridText),
    gridText.replace(/\n/g, ' | ').slice(0, 200),
  )
  check(
    'its Suspended status is on the row too',
    /Suspended/.test(gridText),
    gridText.replace(/\n/g, ' | ').slice(0, 200),
  )
  check(
    '🔑 an unknown documentType arriving as a NUMBER renders as that number',
    /(^|\s|\|)37(\s|\||$)/.test(gridText.replace(/\n/g, ' | ')),
    gridText.replace(/\n/g, ' | ').slice(0, 240),
  )

  // ---- Scenario 10: capReached is a tripwire, not a pager ------------------
  // ⚠️ A distinct number per scenario, deliberately: the query key IS the params,
  // so re-running the same search would be answered from the react-query cache
  // and the drive would be asserting against the previous scenario's rows.
  searchBody = { rows: [candidate({ trxNumber: '00114600051236' })], capReached: true }
  await searchFor('00114600051236')
  await waitForRows()
  const cappedText = await page.locator('main').innerText()
  check(
    'capReached draws one plain warning line and still no pager',
    /More than 50 invoices matched/i.test(cappedText) &&
      (await page.locator('.ag-paging-panel:visible').count()) === 0,
    cappedText.replace(/\n/g, ' ').slice(0, 160),
  )

  // ---- Scenario 11: a BARE 403 on Search ----------------------------------
  // ⚠️ No envelope and no errorCode, so `apiErrorCode` is null and the screen has
  // only `statusCode === 403` to go on. An empty grid here would be a lie.
  searchStatus = 403
  await searchFor('00114600051237')
  // The banner paints a tick after the request settles, so wait for it rather
  // than reading `main` mid-shimmer — swallowed, so its absence is a FAILING
  // check below rather than an abort.
  await page.waitForSelector('[role="alert"]', { timeout: 10000 }).catch(() => {})
  const refusedSearch = await page.locator('main').innerText()
  check(
    '🚩 a bare 403 on Search reads as a REFUSAL',
    /No access to invoices/i.test(refusedSearch),
    refusedSearch.replace(/\n/g, ' ').slice(0, 200),
  )
  check(
    '🚩 …and NOT as an empty result, a landing state or a generic failure',
    !/No invoice carries that number/i.test(refusedSearch) &&
      !/Nothing to show yet/i.test(refusedSearch) &&
      !/unexpected/i.test(refusedSearch),
    refusedSearch.replace(/\n/g, ' ').slice(0, 200),
  )
  check(
    '🚩 a refused search is not retried',
    searchQueries.length === 1,
    `${searchQueries.length} call(s)`,
  )

  // ---- Scenario 12: a failed search is repeatable --------------------------
  // 🚩 The query key IS the params, so pressing Search again on the SAME number
  // must re-ask the server rather than be answered from the cache. With `retry`
  // off here and `refetchOnWindowFocus` off app-wide, the alternative is a dead
  // button under an error banner.
  searchStatus = 200
  searchBody = { rows: [candidate({ trxNumber: '00114600051237' })], capReached: false }
  searchQueries = []
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForLoadState('networkidle')
  await waitForRows()
  check(
    '🚩 pressing Search again on the SAME number re-asks the server',
    searchQueries.length === 1,
    `${searchQueries.length} call(s)`,
  )
  check(
    'and the retried search recovers — the refusal is gone and the row is there',
    (await page.locator('.ag-row').count()) === 1 &&
      !/No access to invoices/i.test(await page.locator('main').innerText()),
  )

  // ---- Scenario 13: emptying the number and searching ---------------------
  // ⚠️ The local refusal must clear the ISSUED query too. Drawing "enter a
  // transaction number" over the previous search's rows would be a grid of
  // results under a message saying there is nothing to search — and 265 is about
  // to hang a Download on those rows.
  searchQueries = []
  await page.getByPlaceholder(/00114600051234/).fill('')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForLoadState('networkidle')
  const emptiedText = await page.locator('main').innerText()
  check(
    '🚩 emptying the number and searching clears the STALE ROWS, not just the field',
    (await page.locator('.ag-row').count()) === 0 &&
      /Enter a transaction number to search/i.test(emptiedText),
    emptiedText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    'and still issues nothing',
    searchQueries.length === 0,
    searchQueries.join(' | '),
  )

  // ---- Scenario 14: Reset returns to the landing state ---------------------
  await page.getByRole('button', { name: /^Reset$/ }).click()
  await page.waitForLoadState('networkidle')
  const resetText = await page.locator('main').innerText()
  check(
    'Reset returns the LANDING state, not an empty result',
    /Nothing to show yet/i.test(resetText) && !/No invoice carries that number/i.test(resetText),
    resetText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    'Reset clears both fields and the refusal',
    (await page.getByPlaceholder(/00114600051234/).inputValue()) === '' &&
      !/No access to invoices/i.test(resetText),
  )
  searchStatus = 200

  // The denied/refused scenarios intentionally answer 403/500, which the browser
  // logs as a resource-load failure — expected, not an app fault.
  const realErrors = errors.filter((e) => !/status of (403|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
