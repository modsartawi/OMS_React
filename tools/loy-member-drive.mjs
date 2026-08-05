// Loy member lookup drive (ticket 233, spec 231) — drives the REAL app in
// Chromium against MOCKED `LoyWeb/*` envelopes.
//
// ⚠ The `LoyWeb` door does not exist: it is a BackOffice dependency on a parallel
// track (spec 231 "Boundaries: the BackOffice door"), and spec 231's standing
// verification rule — inherited from decision 228 — says no ticket in this wave
// may be called done on the strength of a live call. So the network is stubbed at
// Playwright against the shapes in 223's field inventory, which makes the stub a
// contract assertion rather than a convenience. 🚩 NOTHING here is driven against
// a live SIS.Api.
//
// It verifies ticket 233's flow Proof bullet:
//   1. `/loy/members` is one field and nothing else — no bar, no member;
//   2. a blank submit is silent — no call, no message;
//   3. a mobile resolves in ONE call, navigates to `/loy/members/:loyId`, and
//      collapses the field into a bar carrying THE SEARCHED KEY;
//   4. a Loy ID resolves in TWO — the LOY-00100 cascade, invisible to the agent;
//   5. Change reopens the field pre-filled; New lookup returns to the empty field;
//   6. a double miss is a neutral sentence naming what was typed, with the box
//      left exactly as typed and the URL unchanged;
//   7. 🚩 a bare 403 says THAT and never "no member matches", and never cascades;
//   8. a cold load of `/loy/members/:loyId` shows the bar with the LoyId.
//
// And ticket 234's (scenarios 10–12 below):
//  10. granted — the Loyalty group appears in the nav and its item routes to the
//      screen, on ONE shared probe call;
//  11. 🚩 denied — the group is absent AND a typed deep link to `/loy/members`
//      lands on the denied backstop, not on the lookup field;
//  12. 🚩 a probe that THROWS behaves exactly like a denial (fail-closed), and
//      the member read never fires on the way to the backstop.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/loy-member-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

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

// A member not found is a **400 business outcome** carrying LOY-00100 — not a
// 404, not a null `data` (223 §0). This is the only refusal that cascades.
const notFound = (message) =>
  envelope(null, {
    status: 400,
    success: false,
    message,
    errors: [{ errorCode: 'LOY-00100', errorMessage: message, internalErrorCode: '' }],
  })

// `LoyMemberModel` as the `LoyWeb` projection hands it over — every field from
// 223 §1 that the screen reads, plus 230's `memberType` amendment. The engine
// machinery (`profile`, `accrualFactor`, `redemptionFactor`, `exchangeRate`,
// `pointsExpireSoonDays`, `profileUpdated`) is deliberately absent: it is drawn
// nowhere, so a stub that supplied it would be testing a screen nobody built.
const MEMBER = {
  loyId: '100001293',
  mobileCountry: 'SA',
  mobile: '966555000111',
  fullName: 'Nouf Al-Harbi',
  birthDate: '1990-11-08T00:00:00',
  gender: 'F',
  email: 'nouf.h@example.com',
  nationality: 'SA',
  nationalId: '1098443217',
  insuranceCompany: null,
  cityCode: 'RUH',
  preferredLanguage: 'AR',
  joinDate: '2021-03-14T00:00:00',
  lastUpdate: '2026-07-31T09:12:00',
  tier: 'G',
  tierPointsBalance: 8940,
  pendingPoints: 320,
  pointsBalance: 12480,
  pointsBalanceAmount: 561,
  pointsBalanceAmountCurrency: 'SAR',
  pointsExpireSoon: 1200,
  memberType: 'M',
  blockedReason: null,
}

// The stubbed loyalty base: one member, reachable by mobile 966555000111 and by
// LoyId 100001293. Everything else misses.
const MOBILE_KEY = '966555000111'
const LOYID_KEY = '100001293'

// Scenario state, mutated between steps, and the call log the "one call" /
// "two calls" assertions read.
//
// `access` is ticket 234's axis: `granted` | `denied` | `throws`. The last one is
// the case the whole ticket exists for — a probe that errors must be
// indistinguishable from a refusal, never "probably fine".
let scenario = { doorShut: false, access: 'granted' }
// The member reads only. The probe is logged apart so the "one call" / "two
// calls" cascade assertions keep meaning what they said before the gate existed.
let calls = []
let accessCalls = 0

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    // A stubbed 400/403 is the SUBJECT of half this drive; Chromium logs every
    // non-2xx response as a console error, so those are filtered out and only a
    // real script failure counts.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )

    // The area's ONE probe (234). Not grant-gated server-side — it must be able
    // to answer a session that holds nothing — so a denial is a 200 saying no,
    // while `throws` is the transport falling over on the way.
    if (path === 'LoyWeb/Access') {
      accessCalls += 1
      if (scenario.access === 'throws') return route.fulfill({ status: 500, body: 'boom' })
      // 🚩 A BARE 403 — no envelope, no code: what a portal call to a route
      // missing `.AllowCookieSession()`, or refused by the grant filter, comes
      // back as (224). A refusal, not an outage.
      if (scenario.access === 'refused') return route.fulfill({ status: 403, body: 'Forbidden' })
      return route.fulfill(envelope({ canOpenLoyMember: scenario.access === 'granted' }))
    }

    if (path.startsWith('LoyWeb/MemberByMobile/')) {
      const key = decodeURIComponent(path.split('LoyWeb/MemberByMobile/')[1] || '')
      calls.push(`byMobile:${key}`)
      // 🚩 An ungranted portal call gets a BARE 403 — no envelope, no code (224).
      // This is the case the whole cascade rule exists for.
      if (scenario.doorShut) return route.fulfill({ status: 403, body: 'Forbidden' })
      if (key === MOBILE_KEY) return route.fulfill(envelope(MEMBER))
      return route.fulfill(notFound(`Customer with ${key} doesn't exists`))
    }
    if (path.startsWith('LoyWeb/Member/')) {
      const key = decodeURIComponent(path.split('LoyWeb/Member/')[1] || '')
      calls.push(`byLoyId:${key}`)
      if (scenario.doorShut) return route.fulfill({ status: 403, body: 'Forbidden' })
      if (key === LOYID_KEY) return route.fulfill(envelope(MEMBER))
      return route.fulfill(notFound(`Customer ${key} doesn't exists`))
    }

    // Any other probe → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const field = page.getByLabel('Look up a loyalty member', { exact: true })
  const lookUp = page.getByRole('button', { name: /^Look up$/ })

  // ---- Scenario 1: the field is the page ---------------------------------
  await page.goto(BASE + '/loy/members')
  await lookUp.waitFor({ timeout: 15000 })
  check('the empty state is one field, opening blank', (await field.inputValue()) === '')
  check(
    'no identity bar and no member before a lookup',
    (await page.getByText('Searched', { exact: true }).count()) === 0 &&
      (await page.getByText('Nouf Al-Harbi').count()) === 0,
  )
  check(
    'the hint says what the field TAKES',
    /either one resolves the member/.test(await page.textContent('body')),
  )
  check(
    '🚩 the copy never publishes the internal ordering (story 3)',
    !/mobile first/i.test(await page.textContent('body')),
  )
  check(
    'nothing to cancel on the empty state — that IS the state',
    (await page.getByRole('button', { name: /^Cancel$/ }).count()) === 0,
  )

  // ---- Scenario 2: a blank submit is silent ------------------------------
  calls = []
  await lookUp.click()
  await page.waitForTimeout(300)
  check('a blank submit makes NO call', calls.length === 0, calls.join(', '))
  check(
    'a blank submit says nothing at all',
    !/No member matches/.test(await page.textContent('body')) &&
      (await page.getByRole('alert').count()) === 0,
  )

  // ---- Scenario 3: a mobile resolves in ONE call -------------------------
  calls = []
  await field.fill('+966 55 500 0111')
  await lookUp.click()
  await page.waitForURL(/\/loy\/members\/100001293$/, { timeout: 10000 })
  check(
    '🚩 a mobile hit takes ONE call, on the compacted key',
    calls.length === 1 && calls[0] === 'byMobile:966555000111',
    calls.join(', '),
  )
  check('a resolved member lives at /loy/members/:loyId', /100001293$/.test(page.url()), page.url())

  await page.getByText('Nouf Al-Harbi').waitFor({ timeout: 10000 })
  const body = await page.textContent('body')
  check('the bar carries the searched key AS TYPED', /Searched/.test(body) && /\+966 55 500 0111/.test(body))
  check('the member owns the screen: the name is the header', /Nouf Al-Harbi/.test(body))
  check(
    'the identity line reads Loy ID · Mobile · Joined · Updated',
    /100001293/.test(body) &&
      /966555000111/.test(body) &&
      /14 Mar 2021/.test(body) &&
      /31 Jul 2026/.test(body),
  )
  check(
    'the seeded cache means no loading flash — the resolve never re-reads BY MOBILE',
    !calls.slice(1).some((c) => c.startsWith('byMobile:')),
    calls.join(', '),
  )
  check('the name appears exactly once (the bar carries the key, not the member)',
    (body.match(/Nouf Al-Harbi/g) || []).length === 1)

  // ---- Scenario 4: Change reopens the field pre-filled -------------------
  await page.getByRole('button', { name: /^Change$/ }).click()
  await field.waitFor({ timeout: 5000 })
  check('Change reopens the field PRE-FILLED with what was typed',
    (await field.inputValue()) === '+966 55 500 0111')
  check('the member stays on screen while the field is open',
    /Nouf Al-Harbi/.test(await page.textContent('body')))

  // Change is reversible — Cancel puts the bar back, unchanged.
  await page.getByRole('button', { name: /^Cancel$/ }).click()
  await page.getByRole('button', { name: /^Change$/ }).waitFor({ timeout: 5000 })
  check('Cancel returns to the bar with the searched key intact',
    /Searched/.test(await page.textContent('body')))
  await page.getByRole('button', { name: /^Change$/ }).click()
  await field.waitFor({ timeout: 5000 })

  // ---- Scenario 5: a Loy ID cascades, invisibly --------------------------
  calls = []
  await field.fill('100001293')
  await lookUp.click()
  await page.waitForTimeout(600)
  check(
    '🚩 a Loy ID misses the mobile and resolves on the retry — TWO calls',
    calls.join(', ') === 'byMobile:100001293, byLoyId:100001293',
    calls.join(', '),
  )
  check('the cascade is invisible: the member simply resolves',
    /Nouf Al-Harbi/.test(await page.textContent('body')))
  check('the bar now carries the Loy ID that was typed',
    /Searched/.test(await page.textContent('body')))

  // ---- Scenario 6: New lookup returns to the empty field -----------------
  await page.getByRole('button', { name: /^New lookup$/ }).click()
  await page.waitForURL(/\/loy\/members$/, { timeout: 5000 })
  check('New lookup returns to the empty field', (await field.inputValue()) === '')
  check('and the member is gone with it',
    !/Nouf Al-Harbi/.test(await page.textContent('body')))

  // ---- Scenario 7: a double miss is a neutral sentence -------------------
  calls = []
  await field.fill('0555000999')
  await lookUp.click()
  await page.waitForTimeout(600)
  const missBody = await page.textContent('body')
  check(
    'a double miss is TWO calls and then a client sentence',
    calls.join(', ') === 'byMobile:0555000999, byLoyId:0555000999',
    calls.join(', '),
  )
  check('the sentence names what was searched', /No member matches 0555000999/.test(missBody))
  check(
    '🚩 no toast and no error banner — a not-found is a fact, not a failure',
    (await page.getByRole('alert').count()) === 0,
  )
  check('🚩 the box is never rewritten', (await field.inputValue()) === '0555000999')
  check('a miss does not navigate', /\/loy\/members$/.test(page.url()), page.url())

  // ---- Scenario 8: 🚩 a shut door says THAT ------------------------------
  scenario.doorShut = true
  calls = []
  await field.fill('0555000111')
  await lookUp.click()
  await page.waitForTimeout(600)
  const shutBody = await page.textContent('body')
  check(
    '🚩 a bare 403 does NOT cascade — one call, not two',
    calls.join(', ') === 'byMobile:0555000111',
    calls.join(', '),
  )
  check('🚩 a shut door NEVER reads as "no member matches"',
    !/No member matches 0555000111/.test(shutBody))
  check('the refusal shows itself as an error', (await page.getByRole('alert').count()) >= 1)
  check('the refusal names the status it got', /403/.test(shutBody), shutBody.slice(0, 200))
  scenario.doorShut = false

  // ---- Scenario 9: a cold load of the member URL ------------------------
  calls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('Nouf Al-Harbi').waitFor({ timeout: 10000 })
  const coldBody = await page.textContent('body')
  check(
    '🚩 a cold load re-reads BY KEY and does not replay the cascade',
    calls.join(', ') === 'byLoyId:100001293',
    calls.join(', '),
  )
  check('the bar falls back to the LoyId with no navigation state',
    /Searched/.test(coldBody) && /100001293/.test(coldBody))

  // ---- Scenario 10: granted — the nav offers the screen (234) -------------
  // Every OTHER leaf's probe answers `{}` from the catch-all above, so a
  // fail-closed shell leaves exactly one group standing: this one.
  // Counted from this load onwards: every earlier `goto` legitimately re-probed,
  // and what is being asserted is one call per PAGE LIFE shared by two consumers.
  accessCalls = 0
  await page.goto(BASE + '/')
  // Scoped to the sidebar: the home page lists the same destinations as cards, and
  // what this ticket gates is the NAV.
  const sidebar = page.locator('#layout-sidebar')
  const loyaltyGroup = sidebar.getByRole('button', { name: /^Loyalty$/ })
  await loyaltyGroup.waitFor({ timeout: 15000 })
  check('granted: the Loyalty group appears in the nav', (await loyaltyGroup.count()) === 1)
  await loyaltyGroup.click()
  const memberLeaf = sidebar.getByRole('link', { name: /Member lookup/ })
  await memberLeaf.waitFor({ timeout: 5000 })
  await memberLeaf.click()
  await page.waitForURL(/\/loy\/members$/, { timeout: 10000 })
  await lookUp.waitFor({ timeout: 10000 })
  check('the item routes to the lookup screen', /\/loy\/members$/.test(page.url()), page.url())
  check(
    'the nav and the screen share ONE probe call, not one each',
    accessCalls === 1,
    `accessCalls=${accessCalls}`,
  )

  // ---- Scenario 11: 🚩 denied — hidden AND backstopped --------------------
  scenario.access = 'denied'
  calls = []
  await page.goto(BASE + '/loy/members')
  await page.getByRole('alert').first().waitFor({ timeout: 15000 })
  const deniedBody = await page.textContent('body')
  check(
    '🚩 denied: a typed deep link lands on the DENIED BACKSTOP, not the field',
    /No access to Loyalty/.test(deniedBody) &&
      (await page.getByLabel('Look up a loyalty member', { exact: true }).count()) === 0,
  )
  check('the backstop names the grant, not a failure', /administrator/.test(deniedBody))
  check(
    '🚩 denied: the Loyalty group is absent from the nav',
    (await sidebar.getByRole('button', { name: /^Loyalty$/ }).count()) === 0,
  )
  check(
    '🚩 an ungranted deep link never fires the member read',
    calls.length === 0,
    calls.join(', '),
  )

  // ---- Scenario 12: 🚩 a probe that THROWS is a denial --------------------
  scenario.access = 'throws'
  calls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByRole('alert').first().waitFor({ timeout: 15000 })
  const thrownBody = await page.textContent('body')
  check(
    '🚩 a thrown probe FAILS CLOSED — the screen is denied, not opened',
    (await page.getByLabel('Look up a loyalty member', { exact: true }).count()) === 0 &&
      !/Nouf Al-Harbi/.test(thrownBody),
  )
  check(
    'and says the access could not be checked rather than claiming a refusal',
    /unavailable|could not be checked|500/.test(thrownBody),
  )
  check(
    '🚩 the Loyalty group is absent for a thrown probe too',
    (await sidebar.getByRole('button', { name: /^Loyalty$/ }).count()) === 0,
  )
  check(
    '🚩 a thrown probe never fires the member read either',
    calls.length === 0,
    calls.join(', '),
  )
  // ---- Scenario 13: 🚩 a bare 403 reads as a REFUSAL, not an outage --------
  scenario.access = 'refused'
  calls = []
  await page.goto(BASE + '/loy/members')
  await page.getByRole('alert').first().waitFor({ timeout: 15000 })
  const refusedBody = await page.textContent('body')
  check(
    '🚩 a bare 403 denies with the ADMINISTRATOR sentence, not "try again in a moment"',
    /No access to Loyalty/.test(refusedBody) && !/Try again in a moment/.test(refusedBody),
  )
  check(
    'a 403 hides the group and never fires the member read either',
    (await sidebar.getByRole('button', { name: /^Loyalty$/ }).count()) === 0 && calls.length === 0,
    calls.join(', '),
  )
  scenario.access = 'granted'

  check('no page errors anywhere in the drive', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
