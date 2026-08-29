// IDoc Inspector drive (spec 1386) — drives the REAL app in Chromium against
// STUBBED `IDocInspector/*` envelopes.
//
// ⚠️ Stubbed because the door is NOT BUILT: BackOffice 1387 (the grant seed, the
// screen gate, the grant filter and `Access`) is open. Everything ticket 296
// asserts is a client decision and is assertable on stubs; what a stub cannot
// prove is that the server answers this shape, and 1387's own tests are where
// that lives.
//
// 🚩 ONE drive file for the whole wave — 297–300 EXTEND this file rather than
// starting a second one (the shape `invoice-drive.mjs` set for spec 261).
//
// Ticket 296 — the access spine:
//   1. screenAllowed:true  → the Reports group carries an IDoc inspector leaf,
//      and the screen renders its title, its lookup bar and its landing state.
//   2. screenAllowed:false → NO IDoc inspector leaf, while the Invoices leaf
//      beside it is UNAFFECTED — two screens, two grants, one nav group.
//   3. a hand-typed /reports/idoc-inspector on a denied session → the inspector's
//      OWN no-access sentence, not an error, not a retry, and not the invoices
//      screen's wording.
//   4. the access probe is called ONCE per visit (nav leaf + screen gate share
//      one key) and a refused probe is NOT retried.
//   5. an unreachable probe (500) reads as unavailable — the other sentence.
//   6. the local required-field refusal: Look up with a blank half issues nothing
//      and says which half is missing.
//   7. no raw i18n keys anywhere — the `reports` namespace carries the screen.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs) —
// it is NOT a dependency of this repo.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/idoc-inspector-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const URL = BASE + '/reports/idoc-inspector'

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

// Scenario state, mutated between reloads. `accessBody` is the probe's 200
// answer; `accessStatus` lets a scenario refuse the probe itself (an unmarked
// route, or a cookie branch that said no — issue 802), which is a DIFFERENT arm
// from a 200 denial and must read differently.
let scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
// The invoices grant, answered independently: the point of scenario 2 is that
// the two leaves in one nav group move apart.
let invoiceAllowed = true
let accessCalls = 0
// Every `IDocInspector/Transaction` query string seen — 296 asserts this stays
// EMPTY (the slice issues no lookup at all), and 297 will assert what is in it.
let transactionQueries = []

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
    if (path === 'IDocInspector/Access') {
      accessCalls++
      if (scenario.accessStatus !== 200)
        return route.fulfill(
          envelope(null, { status: scenario.accessStatus, success: false, message: 'Forbidden.' }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    if (path === 'IDocInspector/Transaction') {
      transactionQueries.push(url.split('?')[1] || '')
      return route.fulfill(envelope({ verdict: 'NoSuchTransaction', documents: [] }))
    }
    if (path === 'RetailInvoice/Access')
      return route.fulfill(envelope({ screenAllowed: invoiceAllowed }))
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const visit = async (url) => {
    accessCalls = 0
    transactionQueries = []
    await page.goto(url)
    await page.waitForLoadState('networkidle')
  }

  const storeField = () => page.getByPlaceholder(/S042/)
  const trxField = () => page.getByPlaceholder(/00114600051234/)
  const lookUp = async () => {
    await page.getByRole('button', { name: /^Look up$/ }).click()
    await page.waitForLoadState('networkidle')
  }

  // ---- Scenario 1: granted ------------------------------------------------
  scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
  invoiceAllowed = true
  await visit(URL)

  check(
    'granted → the Reports group appears in the menu',
    (await page.getByRole('button', { name: /^Reports$/i }).count()) === 1,
  )
  const leaf = page.getByRole('link', { name: /^IDoc inspector$/i })
  check('granted → the IDoc inspector leaf appears under it', (await leaf.count()) === 1)
  const leafHref = (await leaf.count()) ? await leaf.first().getAttribute('href') : null
  check(
    'granted → the leaf points at /reports/idoc-inspector',
    leafHref === '/reports/idoc-inspector',
    leafHref ?? 'no leaf',
  )

  const main = await page.locator('main').innerText()
  check('granted → the screen renders its title', /IDoc inspector/i.test(main), main.split('\n')[0] || '')
  check(
    'granted → the screen renders its subtitle',
    /SAP rail generated/i.test(main),
    main.slice(0, 140).split('\n').join(' '),
  )
  check(
    '🚩 the screen LANDS EMPTY — the landing state, which is NOT a verdict',
    /Nothing to show yet/i.test(main),
    main.split('\n').join(' ').slice(0, 160),
  )
  check(
    'the lookup bar carries BOTH halves of the key',
    (await storeField().count()) === 1 && (await trxField().count()) === 1,
  )
  check(
    '🚩 focus lands on the store field on mount',
    await storeField().evaluate((el) => el === document.activeElement),
  )
  check(
    '🚩 nothing is looked up on mount — the screen cannot guess a transaction',
    transactionQueries.length === 0,
    transactionQueries.join(' | '),
  )
  check(
    '🚩 the access probe is called ONCE per visit (nav leaf + gate share one key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // 🚩 The namespace is load-bearing and nothing else catches it: unregistered
  // keys render RAW to the user, and i18next's fallback drops the `reports:`
  // prefix — so the tell is the KEY PATH, not the prefix.
  const shellText = await page.locator('body').innerText()
  const rawKey = shellText.match(/(?:^|\s)(?:reports:)?(?:idocInspector|invoice|menu|access)\.[a-zA-Z.]+/)
  check(
    '🚩 no raw i18n keys on the page — the `reports` namespace carries the screen',
    rawKey === null,
    (rawKey || [''])[0],
  )

  // ---- Scenario 6 (here, while granted): the local required-field refusal ---
  // 🚩 A blank store or transaction number is the server's 400 branch. Reaching
  // it would be a client bug, so Look up on an incomplete key issues NOTHING.
  await lookUp()
  let text = await page.locator('main').innerText()
  check(
    '🚩 Look up on an empty form issues NO request',
    transactionQueries.length === 0,
    transactionQueries.join(' | '),
  )
  // ⚠️ Read off the refusal ELEMENT and not the page text: the landing hint says
  // "Enter a store and a transaction number to see the documents…", so a text
  // match for the refusal's own opening words passes with no refusal rendered.
  const refusal = () => page.locator('#idoc-lookup-error')
  check(
    'the empty Look up names BOTH missing halves, locally',
    (await refusal().count()) === 1 &&
      /Enter a store and a transaction number to look one up/i.test(await refusal().innerText()),
    (await refusal().count()) ? await refusal().innerText() : 'no refusal rendered',
  )
  await storeField().fill('S042')
  await lookUp()
  text = await page.locator('main').innerText()
  check(
    '🚩 a store alone still issues nothing, and names the MISSING half only',
    transactionQueries.length === 0 &&
      (await refusal().count()) === 1 &&
      /^Enter a transaction number to look up/i.test(await refusal().innerText()),
    (await refusal().count()) ? await refusal().innerText() : 'no refusal rendered',
  )
  await storeField().fill('')
  await trxField().fill('00114600051234')
  await lookUp()
  text = await page.locator('main').innerText()
  check(
    '🔑 a transaction number alone is refused too — the store is half the key here',
    transactionQueries.length === 0 &&
      (await refusal().count()) === 1 &&
      /^Enter a store —/i.test(await refusal().innerText()),
    (await refusal().count()) ? await refusal().innerText() : 'no refusal rendered',
  )
  await page.getByRole('button', { name: /^Reset$/ }).click()
  text = await page.locator('main').innerText()
  check(
    'Reset returns the screen to the landing state, refusal cleared',
    /Nothing to show yet/i.test(text) &&
      (await refusal().count()) === 0 &&
      (await storeField().inputValue()) === '' &&
      (await trxField().inputValue()) === '',
  )

  // ---- Scenario 2: denied, arriving from elsewhere ------------------------
  // The probe answers a denial with 200 — a boolean to read, never an error to
  // catch — so this is the ORDINARY refusal, not an outage.
  scenario = { accessBody: { screenAllowed: false }, accessStatus: 200 }
  await visit(BASE + '/')
  check(
    '🚩 denied → no IDoc inspector leaf in the menu',
    (await page.getByRole('link', { name: /^IDoc inspector$/i }).count()) === 0,
  )
  check(
    '🔑 …while the Invoices leaf beside it is UNAFFECTED — two grants, one group',
    (await page.getByRole('link', { name: /^Invoices$/i }).count()) === 1,
  )

  // ---- Scenario 3: denied, hand-typed URL ---------------------------------
  // 🚩 The probe only HIDES the menu. A user who pastes the URL reaches the
  // screen and must be told, in words, that they have no access.
  await visit(URL)
  const deniedText = await page.locator('main').innerText()
  check(
    '🚩 hand-typed URL on a denied session → the no-access SENTENCE',
    /No access to the IDoc inspector/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    '🔑 …in the INSPECTOR\'s words, not the invoices screen\'s',
    !/access to invoices/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    '🔑 a denial names the remedy (an administrator) and never a retry',
    /administrator/i.test(deniedText) && !/Try again/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 200),
  )
  check(
    '🚩 denied → NOT an empty screen and NOT a generic error',
    !/Nothing to show yet/i.test(deniedText) && !/unexpected/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    'denied → the lookup bar is not rendered at all',
    (await storeField().count()) === 0 && (await trxField().count()) === 0,
  )
  check(
    '🚩 a 200 denial is asked ONCE and never re-asked',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // ---- Scenario 4: the probe itself refuses (403) -------------------------
  // A different arm from a 200 denial: the route is unmarked, or the cookie
  // branch said no (issue 802). Still a REFUSAL rather than an outage, so it
  // must not invite a retry loop against a permanently shut door.
  scenario = { accessBody: null, accessStatus: 403 }
  await visit(URL)
  const refusedText = await page.locator('main').innerText()
  check(
    'a 403 on the probe reads as a refusal, not as "try again in a moment"',
    /No access to the IDoc inspector/i.test(refusedText) && !/Try again/i.test(refusedText),
    refusedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    '🚩 a refused probe is not retried (retry:false travels with the key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // ---- Scenario 5: the probe is unreachable (500) -------------------------
  // The other sentence: an outage the user can retry, distinct from a refusal
  // they cannot. ⚠️ The door is unbuilt today, so this is the arm a real session
  // would hit right now — and it must NOT read as "you lack the grant".
  scenario = { accessBody: null, accessStatus: 500 }
  await visit(URL)
  const downText = await page.locator('main').innerText()
  check(
    'an unreachable probe reads as unavailable (a retry), not as a refusal',
    /unavailable/i.test(downText) && !/No access to the IDoc inspector/i.test(downText),
    downText.split('\n').join(' ').slice(0, 160),
  )
  check(
    'an unreachable probe hides the leaf too — fail-closed, not fail-open',
    (await page.getByRole('link', { name: /^IDoc inspector$/i }).count()) === 0,
  )

  // The denied/refused scenarios answer non-2xx on purpose, which the browser
  // logs as a resource-load failure — expected, not an app fault.
  const realErrors = errors.filter((e) => !/status of (403|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
