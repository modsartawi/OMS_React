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

// scenario state, mutated between reloads
let scenario = { accessBody: ALL, access403: false }
let accessCalls = 0

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
