// Settlement account drive (spec 267, ticket 268) — drives the REAL app in Chromium
// against a MOCKED CollectionWeb/Access envelope. This is the wave's screens drive;
// 269–273 EXTEND this file rather than starting a second one.
//
// ⚠️ The envelope is stubbed for a reason that is not going away soon: the fifth
// grant `canOpenSettlement` does not exist on the live door (BackOffice spec 1173,
// joined by ticket 274), so a live probe answers FOUR booleans and this screen is
// shut for every real session today. Both of 268's Proof bullets are about which of
// two things a session sees, and only a stub can put a session on each side of that
// line. (Spec 267 §Testing Decisions: do not repoint a drive at live — its
// assertions are about behaviour on SPECIFIC responses.)
//
// Verifies ticket 268's Proof:
//   1. granted → the Settlement leaf appears as the FIFTH item of the existing
//      Collections group, and /collection/settlement renders the shell — header,
//      the inert scope control, the empty state;
//   2. ungranted → the leaf is ABSENT and a hand-typed /collection/settlement
//      renders the denied backstop rather than a broken screen — while the four
//      inquiry leaves the session DOES hold stay put (the ragged group);
//   3. the four-boolean answer the live door returns today behaves exactly as
//      ungranted — no leaf, route refused — with the other four untouched;
//   4. a 403 reads as a REFUSAL (see an administrator) and a 500 as UNREACHABLE
//      (try again); both deny, only the sentence differs;
//   5. the five leaves + the screen's own gate cost ONE CollectionWeb/Access call;
//   6. every t() call renders a real string — the `settlement` namespace is
//      registered, not merely created (a raw `settlement:menu.settlement` on screen
//      is the failure this catches).
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const ROUTE = '/collection/settlement'
const TITLE = 'Settlement account'
const LEAF = 'Settlement Account'
const DENIED = 'No access to this screen'
const UNREACHABLE = 'This screen is unavailable'

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
  canOpenSettlement: false,
}
const ALL = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenSettlement: true,
}
/** What `CollectionWeb/Access` actually answers today: four flags, no fifth. */
const FOUR_FLAGS = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
}

let scenario = { accessBody: ALL, access403: false, access500: false }
let accessCalls = 0

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // ⚠️ The browser logs a console error for every non-2xx response, and scenario 4
  // asks for a 403 and a 500 ON PURPOSE. Those two are the drive working, not the
  // app breaking — what this list is for is a React crash or an unhandled rejection,
  // so the expected transport noise is filtered out rather than the check weakened.
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/Failed to load resource/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'CollectionWeb/Access') {
      accessCalls++
      // The bare 403 the default-deny inversion (issue 802) hands a browser while a
      // route is unmarked — the realistic answer for a young door, not a hypothetical.
      if (scenario.access403)
        return route.fulfill(envelope(null, { status: 403, success: false, message: 'Forbidden' }))
      if (scenario.access500)
        return route.fulfill(
          envelope(null, { status: 500, success: false, message: 'Server error' }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    // The neighbours' doors, answered with an empty LIST rather than the empty
    // object below: scenario 3 reads the nav from `/collection/collections`, whose
    // grid iterates its rows, and a `{}` there would crash a screen this drive is
    // not about. Their contents are `tools/collection-drive.mjs`'s business.
    if (
      path === 'CollectionWeb/Collections' ||
      path === 'CollectionWeb/Acrs' ||
      path === 'CollectionWeb/Attempts'
    )
      return route.fulfill(envelope([]))
    if (path === 'CollectionWeb/Deposits') return route.fulfill(envelope({ rows: [], balances: [] }))
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    // ⚠️ 268 fetches NOTHING of its own, and that is a thing this drive asserts
    // rather than merely tolerates — see the Settlement/* counter below.
    return route.fulfill(envelope({}))
  })

  // A ledger call from a ticket that is supposed to fetch nothing would be silent
  // otherwise: the stub above answers everything with a benign success.
  let settlementCalls = 0
  page.on('request', (r) => {
    if (/\/api\/Settlement/i.test(r.url())) settlementCalls++
  })

  const leafCount = async () => page.getByRole('link', { name: LEAF, exact: true }).count()
  const inquiryLeaves = async () =>
    (
      await page
        .getByRole('link', { name: /Cash Collections|^ACRs$|^Deposits$|Collection Attempts/ })
        .all()
    ).length
  const groupCount = async () => page.getByRole('button', { name: /^Collections$/ }).count()
  const mainText = async () => page.locator('main').innerText()
  const open = async (body, flags = {}) => {
    scenario = { accessBody: body, access403: false, access500: false, ...flags }
    await page.goto(BASE + ROUTE)
    await page.waitForLoadState('networkidle')
    return mainText()
  }

  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')

  // ---- Scenario 1: granted ----
  let text = await open(ALL)
  check('granted → the screen renders its header', text.includes(TITLE) && !text.includes(DENIED), text.replace(/\n/g, ' ').slice(0, 90))
  check('granted → the inert scope control renders all three states', ['My branches', 'Unassigned', 'All branches'].every((s) => text.includes(s)))
  check('granted → the scope control is INERT (270 wires it)', (await page.locator(`[role="group"] button[aria-disabled="true"]`).count()) === 3)
  check('granted → the shell states there is nothing here yet', text.includes('Nothing to show yet'))
  check('granted → the Collections group renders', (await groupCount()) === 1)
  check('granted → the Settlement leaf is the FIFTH item', (await leafCount()) === 1 && (await inquiryLeaves()) === 4)
  check('🚩 the namespace is REGISTERED — no raw t() key on screen', !/settlement:|\bshell\.|\bscope\./.test(text + (await page.locator('nav').innerText())))

  // ONE probe for the whole area: five leaves + the screen's own gate share the key,
  // so react-query dedupes them into a single request per page life. The fifth grant
  // must not have cost a sixth round trip.
  accessCalls = 0
  await page.goto(BASE + ROUTE)
  await page.waitForLoadState('networkidle')
  check('the five leaves + the screen gate cost ONE CollectionWeb/Access call', accessCalls === 1, `${accessCalls} calls`)
  check('🚩 268 fetches NOTHING — no Settlement/* call at all', settlementCalls === 0, `${settlementCalls} calls`)

  // ---- Scenario 2: ungranted ----
  text = await open(NONE)
  check('ungranted → a hand-typed route renders the denied backstop', text.includes(DENIED) && !text.includes(TITLE))
  check('ungranted → the Settlement leaf is absent', (await leafCount()) === 0)

  // ---- Scenario 3: settlement refused, the four inquiries granted ----
  // The ragged group, and the case that matters most: this is the LIVE door today.
  text = await open(FOUR_FLAGS)
  check("🚩 today's four-boolean answer → the route refuses", text.includes(DENIED) && !text.includes(TITLE))
  check("🚩 today's four-boolean answer → no Settlement leaf…", (await leafCount()) === 0)
  // …read from a screen this session CAN open: the shell expands a group around the
  // leaf the current route belongs to, and on a refused settlement route there is no
  // such leaf, so the group is collapsed and its children are not in the DOM to count.
  await page.goto(BASE + '/collection/collections')
  await page.waitForLoadState('networkidle')
  check('🚩 …and the four inquiry leaves are untouched', (await inquiryLeaves()) === 4, `${await inquiryLeaves()} links`)
  check('🚩 …with no Settlement leaf beside them', (await leafCount()) === 0)

  // ---- Scenario 4: the probe itself fails ----
  text = await open(NONE, { access403: true })
  check('a 403 reads as a REFUSAL, not an outage', text.includes(DENIED) && !text.includes(UNREACHABLE))
  check('a 403 → the leaf is hidden too', (await leafCount()) === 0)
  text = await open(NONE, { access500: true })
  check('a 500 reads as UNREACHABLE — try again, not see an administrator', text.includes(UNREACHABLE) && !text.includes(DENIED))
  check('a 500 → the leaf is hidden too', (await leafCount()) === 0)

  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
