// The call-center console's tracer bullet (ticket 162) — drives the REAL app in Chromium.
//
//   1. run the app:  npx vite --port 5210
//   2. node tools/callcenter-drive.mjs
//
// Nothing about the app is stubbed except the wire. `CallCenterWeb/Access` and
// `CallCenterWeb/Open` DO NOT EXIST server-side yet (BackOffice 800 carries the grant,
// 801 the route table), so this run answers them from the contract's own committed
// fixture — `.issues/assets/136-cc-contract/01-open-empty.json` — rather than from a
// hand-rolled mock. That is the point: the client is driven against the frozen shape.
// Every `/api/**` request is RECORDED, which is how "exactly one Open" and "a refused
// console opens no order" are PROVEN rather than asserted.
//
// Asserts ticket 162's Proof:
//   theConsoleOpensAndRendersTheReturnedState
//     1. a granted agent lands on /callcenter, exactly ONE Open call is made, and the
//        shell renders the returned header, the empty basket and the engine's totals;
//     2. no app nav chrome is around it — no sidebar, no shell top bar;
//     3. the receipt's payable is the fixture's `totals.payable`, and *Place order* is
//        disabled with `submitBlockers` named under it (nothing client-computed);
//     4. the nav leaf appears for a granted agent, on ONE shared Access call.
//   aRefusedConsoleIsNotADeadEnd
//     5. canOpenConsole:false → the denial, with BOTH ways home, and NO Open call;
//     6. an ERRORED probe → the "check unavailable" copy (not "ask for a grant"),
//        both ways home, and still no Open call;
//     7. a probe that throws CONSOLE_NOT_GRANTED → the DENIAL copy, not "server
//        problem, try again shortly" — the machine code, not `isError`, decides;
//     8. the door refusing Open with CONSOLE_NOT_GRANTED (the probe is show/hide
//        hygiene, never the enforcement) → the denial, with no dead "try again";
//     9. the leaf is absent from the nav in both refused cases.
//
// Asserts ticket 163's Proof:
//   anExistingOrderIsOfferedNotInherited
//    10. Open answering `refusedExisting` draws the previous caller's name, line count,
//        opened-at and store — and NO basket is rendered until the agent chooses;
//        nothing about that order is even fetched.
//   resumeAndStartFreshBothLandOnAnOrder
//    11. *Resume* reads THAT order's state (one State call, on that id) and renders it;
//    12. *Abandon and start fresh* cannot fire without the confirmation, and once
//        confirmed sends Abandon BEFORE Open, on a NEW requestId, landing on an empty
//        order that is not the one abandoned;
//    13. abandoning from inside a live order is the same act — same confirmation,
//        naming what is thrown away — and lands the agent on a fresh order, never on
//        nothing.
//
// Asserts ticket 164's Proof:
//   aBusyCollisionKeepsTheScreenUsable
//    14. a stub answering SESSION_BUSY (fixture 08's own refusal) three times then
//        succeeding shows the STRIP — in the flow, inside the console, never a
//        blocking spinner — the basket and its controls stay usable throughout, and
//        the strip clears itself when the collision does;
//    15. the exhausted case: the schedule runs out and the agent is offered a manual
//        retry, which lands them back on their order;
//    16. a stale tab is REFUSED, not misrouted — SESSION_CLOSED returns it to the
//        start, naming the reason, with the dead basket gone from the screen and a
//        new order one click away;
//    17. a major contractVersion mismatch stops the console dead (no basket, no
//        totals, no dead "try again"), while minor drift is a non-event.
//
// Asserts ticket 165's Proof:
//   attachingACallerOpensTheAddressBook
//    18. the caret is IN the phone field the moment the console opens — nothing is
//        clicked first; before a caller there is no address control to reach at all;
//    19. looking a caller up names them, attaching sends the found loyalty id on one
//        requestId, and the rail fills with a compact card of AT MOST six fields in a
//        fixed order — with the empty address slot and its *Pick an address* appearing
//        only once `capabilities.canOpenAddressBook` says the door will answer;
//    20. a number nobody holds says so and offers no signup surface (159 is undrawn);
//    21. removing the caller clears the address and LEAVES THE STORE CHIP STANDING —
//        a re-attach must never silently re-price the basket.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`

// The contract's own fixture, verbatim — the same file `__fixtures__/payloads.ts`
// imports. A drive that hand-wrote this payload would be testing the drive.
const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
const fixture = (name) => raw(name).response.data

// A REFUSAL out of a fixture that holds several (08 carries four scenarios), as a
// Playwright fulfilment. Hand-writing a 409 body here would be testing the drive;
// the codes, the messages and the `data` payloads are the contract's own.
const refusal = (name, key) => {
  const response = raw(name)[key].response
  return { status: response.statusCode, contentType: 'application/json', body: JSON.stringify(response) }
}

// §6.1's routine collision and §6.2's stale tab, verbatim from fixture 08.
const BUSY = refusal('08-session-busy', 'busy')
const CLOSED = refusal('08-session-busy', 'staleTab')
const CLOSED_MESSAGE = raw('08-session-busy').staleTab.response.message

const OPEN_RESULT = fixture('01-open-empty')
const STATE = OPEN_RESULT.state

// The order the agent already has open, and what reading it back answers.
// `02-two-lines-priced` is the resume target on purpose: an order with LINES in
// it is the one whose inheritance would do harm, and two lines on screen after
// *Resume* is what "back where it was" looks like.
const PRIOR_STATE = fixture('02-two-lines-priced')
const PRIOR_ID = PRIOR_STATE.transactionId

// §8.1's shape, hand-built: there is no committed fixture for a refusal (136
// froze nine payloads and this is not one of them), so the drive spells the four
// fields the contract lists — and only those.
const EXISTING = {
  transactionId: PRIOR_ID,
  customerName: PRIOR_STATE.header.customer.name,
  lineCount: PRIOR_STATE.lines.length,
  openedAt: PRIOR_STATE.header.openedAt,
  plant: PRIOR_STATE.header.plant,
}

// The fixtures share one transactionId, so a fresh open is given a distinct one:
// the shape is the fixture's, and only the identity is varied — which is the one
// thing "the new order is not the one you abandoned" has to be able to see.
const FRESH_ID = '01JD0000000000000000000000'
const freshOpenResult = () => ({
  outcome: 'opened',
  state: { ...STATE, transactionId: FRESH_ID },
  existing: null,
})

// ---- ticket 165: the caller, and the two verbs that bind and unbind them ----
//
// The loyalty lookup is NOT part of the session contract — it precedes attach and
// has no committed fixture (BackOffice 801 delegates it verbatim to
// `LoyEndpoints.GetLoyMemberByMobile`). So the drive spells `LoyMemberModel`'s own
// field names, and only the ones the rail reads.
const MEMBER = {
  loyId: PRIOR_STATE.header.customer.customerId,
  mobile: '0551234567',
  fullName: 'Nouf Al-Qahtani',
  tier: 'Gold',
  pointsBalance: 1240,
  email: 'caller@example.com',
}

// The caller as the ORDER holds them once attached — `SessionCustomer`, not the
// loyalty record. Deliberately spelled with a name of its own: the rail must read
// the projection rather than the member it searched with, and a check that cannot
// tell the two apart proves nothing.
const ATTACHED_CUSTOMER = {
  customerId: MEMBER.loyId,
  name: 'Nouf A. Al-Qahtani',
  mobile: MEMBER.mobile,
  loyaltyAttached: true,
}

// What `removeCustomer` answers (§6.3): the customer and the address are gone,
// **the derived plant is retained**, and the address book has closed again.
// Every one of those is the SERVER's doing — the console is only being watched
// to see that it re-renders them rather than inventing them. Derived from the
// state the stub last served, so removal answers about the order actually on
// screen rather than about a fixture.
const removedFrom = (state) => ({
  ...state,
  version: state.version + 1,
  header: { ...state.header, customer: null, address: null },
  capabilities: { ...state.capabilities, canOpenAddressBook: false },
})

// §7 — CONSOLE_NOT_GRANTED is a 403 CARRYING the envelope, so `core/api.ts` maps
// it to kind:'business' and `apiErrorCode()` can read it. A refusal, not a fault.
const REFUSAL = {
  status: 403,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 403,
    success: false,
    message: 'The call-center console is not granted to this account.',
    errors: [{ errorCode: 'CONSOLE_NOT_GRANTED', internalErrorCode: '', errorMessage: '' }],
    data: null,
  }),
}

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

/**
 * A fresh context per scenario — each answers the probe differently, and react-query
 * caches per page anyway.
 *
 * @param opts.granted `canOpenConsole` the probe answers
 * @param opts.probe   'ok' | 'unreachable' | 'notGranted' — how Access answers:
 *                     a 500 with no code, or a 403 carrying CONSOLE_NOT_GRANTED
 * @param opts.door    'ok' | 'notGranted' — whether Open itself refuses
 * @param opts.existing  when set, the FIRST Open answers `refusedExisting` with it
 *                       (163's whole subject); every later Open opens normally
 * @param opts.openState the state a successful Open returns — the empty fixture by
 *                       default, `02-two-lines-priced` for the live-order abandon
 * @param opts.stateFailures how many `State` reads fail before one succeeds — the
 *                       failed-resume case, and whether *Resume* retries itself
 * @param opts.stateBusy how many `State` reads answer SESSION_BUSY before one
 *                       lands (164): 3 rides the schedule out, 6 exhausts it
 * @param opts.stateClosed  every `State` read answers SESSION_CLOSED — the stale tab
 * @param opts.contractVersion  overrides the version every returned state declares
 * @param opts.memberFound  whether the loyalty lookup finds anyone (165) — `false`
 *                       is the number nobody holds, answered `null` on the success
 *                       envelope rather than as a refusal
 */
async function open(
  browser,
  {
    granted = true,
    probe = 'ok',
    door = 'ok',
    existing = null,
    openState = null,
    stateFailures = 0,
    stateBusy = 0,
    stateClosed = false,
    contractVersion = null,
    memberFound = true,
  } = {},
) {
  let stateReads = 0
  // The state this stub last served, so the two customer verbs (165) answer
  // about the order on screen rather than about a fixture.
  let served = openState ?? STATE
  // Law 10 — every response carries one, so the override is applied wherever a
  // state leaves this stub rather than at one call site. `'none'` strips the
  // field entirely: a server that has not shipped it yet is a real state, and
  // it is the one this check must NOT stop on.
  const speak = (state) => {
    if (!contractVersion) return state
    if (contractVersion === 'none') {
      const { contractVersion: _absent, ...rest } = state
      return rest
    }
    return { ...state, contractVersion }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  // Every POST with its body, in order — how "abandon BEFORE open" and "a new
  // requestId" are PROVEN rather than inferred from what ends up on screen.
  const wire = []
  let opens = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  // Chromium logs EVERY non-2xx as a console error, whether or not the app
  // handled it — and 164's whole subject is refusals the app handles on purpose
  // (SESSION_BUSY, SESSION_CLOSED). That line is the browser's network log, not
  // the app's; a real fault still arrives as `pageerror` or as an app-authored
  // console error, both of which are still collected.
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    calls.push(p)
    if (route.request().method() === 'POST') {
      let body = null
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
      wire.push({ path: p, body })
    }
    if (p === 'CallCenterWeb/State') {
      stateReads += 1
      if (stateReads <= stateFailures)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'state read failed' }))
      if (stateReads <= stateFailures + stateBusy) return route.fulfill(BUSY)
      if (stateClosed) return route.fulfill(CLOSED)
      return route.fulfill(
        envelope(speak(new URL(url).searchParams.get('transactionId') === PRIOR_ID ? PRIOR_STATE : STATE)),
      )
    }
    // ---- 165 ----
    if (p.startsWith('CallCenterWeb/MemberByMobile/'))
      // `null` is how the service answers a number nobody holds — an ordinary
      // outcome carried on the SUCCESS envelope, not a refusal.
      return route.fulfill(envelope(memberFound ? MEMBER : null))
    if (p === 'CallCenterWeb/AttachCustomer') {
      // The order the agent is on, with the caller bound and the book opened —
      // whichever order that is. `openState` seeds a session that already has
      // one, so attaching must answer about THAT state, not about the empty one.
      served = {
        ...served,
        version: served.version + 1,
        header: { ...served.header, customer: ATTACHED_CUSTOMER },
        capabilities: { ...served.capabilities, canOpenAddressBook: true },
      }
      return route.fulfill(envelope(speak(served)))
    }
    if (p === 'CallCenterWeb/RemoveCustomer') {
      served = removedFrom(served)
      return route.fulfill(envelope(speak(served)))
    }
    if (p === 'CallCenterWeb/Abandon')
      return route.fulfill(envelope({ outcome: 'abandoned', transactionId: route.request().postDataJSON().transactionId }))
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') {
      if (probe === 'unreachable')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'boom' }))
      if (probe === 'notGranted') return route.fulfill(REFUSAL)
      return route.fulfill(envelope({ canOpenConsole: granted }))
    }
    if (p === 'CallCenterWeb/Open') {
      opens += 1
      if (door === 'notGranted') return route.fulfill(REFUSAL)
      // One active order per agent (law 9): the agent HAS one, so the first open
      // is refused with its identity. Once it is abandoned, the next one lands.
      if (existing && opens === 1)
        return route.fulfill(envelope({ outcome: 'refusedExisting', state: null, existing }))
      // `openState` seeds the FIRST order only. Whatever follows an abandon is a
      // genuinely fresh, empty one — anything else would let box 13 pass while
      // the console quietly re-rendered the basket it had just voided.
      if (openState && opens === 1)
        return route.fulfill(envelope({ outcome: 'opened', state: speak(openState), existing: null }))
      const result = existing || openState ? freshOpenResult() : OPEN_RESULT
      return route.fulfill(envelope({ ...result, state: speak(result.state) }))
    }
    // Every other screen's probe: allowed, so the rest of the shell is normal.
    if (/Access$/.test(p))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }),
      )
    return route.fulfill(envelope([]))
  })

  return { context, page, errors, calls, wire }
}

const count = (calls, re) => calls.filter((c) => re.test(c)).length
const text = async (page, selector) => (await page.locator(selector).first().innerText()).trim()

async function run() {
  const browser = await chromium.launch()

  // ---- 1–3. the granted agent: one Open, the returned state on screen, no chrome ----
  {
    const { context, page, errors, calls } = await open(browser, { granted: true })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check('opens exactly one order', count(calls, /^CallCenterWeb\/Open$/) === 1, `${count(calls, /^CallCenterWeb\/Open$/)} Open call(s)`)
    check(
      'one Access call, shared by the guard (no second probe)',
      count(calls, /^CallCenterWeb\/Access$/) === 1,
      `${count(calls, /^CallCenterWeb\/Access$/)} Access call(s)`,
    )
    check(
      'does not fetch state it was just handed',
      count(calls, /^CallCenterWeb\/State$/) === 0,
      'getState is for refresh/recovery only (law 2)',
    )

    // The header, from the server's own projection.
    check('renders the returned document type', (await text(page, '[data-cc-doctype]')) === STATE.header.documentType, STATE.header.documentType)
    check('renders the returned operator', (await text(page, '[data-cc-operator]')) === STATE.header.operatorId)
    const storeChip = await text(page, '[data-cc-chip="store"]')
    check(
      'the store chip carries the plant the engine bound at open',
      storeChip.includes(STATE.header.plant) && storeChip.includes(STATE.header.plantName),
      storeChip.replace(/\s+/g, ' '),
    )
    check(
      'the store chip is settled, the unset ones are not',
      (await page.locator('[data-cc-chip="store"]').getAttribute('data-cc-chip-state')) === 'settled' &&
        (await page.locator('[data-cc-chip="slot"]').getAttribute('data-cc-chip-state')) !== 'settled',
    )

    // The empty basket and the engine's zero totals.
    check('renders the empty basket', await page.locator('[data-cc-basket-empty]').isVisible())
    const payable = await text(page, '[data-cc-payable]')
    check(
      'the receipt shows the ENGINE total, not a client sum',
      payable.startsWith(STATE.totals.payable.toFixed(2)),
      payable.replace(/\s+/g, ' '),
    )

    // Submit: disabled by `capabilities`, reason named from `submitBlockers`.
    check('Place order is disabled', await page.locator('[data-cc-submit]').isDisabled())
    const blockers = await text(page, '[data-cc-blockers]')
    check(
      'the reason submit is blocked is named',
      STATE.capabilities.submitBlockers.length > 0 && blockers.length > 0,
      blockers.replace(/\s+/g, ' '),
    )

    // Chrome-less: no app nav around it (map 126 note 13).
    check('no app nav chrome', (await page.locator('nav').count()) === 0)
    check('the console fills the viewport', (await page.locator('[data-cc-console]').boundingBox()).height >= 880)

    // 165 — the rail is live from the first frame, and the caret is already in it.
    check('the empty rail is drawn and live', await page.locator('#cc-phone').isEnabled())

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 4. the nav leaf, for a granted agent, off the same probe ----
  {
    const { context, page, calls } = await open(browser, { granted: true })
    await page.goto(`${BASE}/`)
    await page.locator('nav').first().waitFor({ timeout: 10_000 })
    const labels = await page
      .locator('nav')
      .first()
      .locator('button, a')
      .evaluateAll((els) => els.map((e) => e.innerText.trim()))
    check('the granted agent sees the Call center leaf', labels.some((l) => /call center/i.test(l)), labels.join(' | '))
    check('the leaf costs one Access call', count(calls, /^CallCenterWeb\/Access$/) === 1)
    check('the nav opens no order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    await context.close()
  }

  // ---- 5. refused: the denial, both ways home, and NO order opened ----
  {
    const { context, page, errors, calls } = await open(browser, { granted: false })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })

    check('a refused agent gets the denial', (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'denied')
    check('a refused console opens NO order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    check('the console itself never renders', (await page.locator('[data-cc-console]').count()) === 0)
    // 🚩 The whole point of this box: a chrome-less refusal has no nav to leave by.
    check('the denial offers Back to the portal', await page.locator('[data-cc-home]').isVisible())
    check('the denial offers Sign out', await page.locator('[data-cc-signout]').isVisible())
    check('no nav to leave by — which is why the two above matter', (await page.locator('nav').count()) === 0)

    // And the way home actually goes home.
    await page.locator('[data-cc-home]').click()
    await page.waitForURL(`${BASE}/`, { timeout: 10_000 })
    check('Back to the portal lands on the portal', page.url().replace(/\/$/, '') === BASE)

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 6. the probe itself errors: unavailable copy, still no order ----
  {
    const { context, page, calls } = await open(browser, { probe: 'unreachable' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })

    check(
      'an errored probe says the CHECK failed, not "ask for a grant"',
      (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'unavailable',
    )
    check('an errored probe opens NO order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    check('an errored probe still carries both ways home', (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()))
    await context.close()
  }

  // ---- 7. the probe REFUSES with a code: the denial, not the server-fault copy ----
  {
    const { context, page, calls } = await open(browser, { probe: 'notGranted' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })
    check(
      'CONSOLE_NOT_GRANTED reads as a refusal, not "try again shortly"',
      (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'denied',
    )
    check('a coded refusal opens NO order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    await context.close()
  }

  // ---- 8. the DOOR refuses Open, though the probe admitted ----
  {
    const { context, page } = await open(browser, { granted: true, door: 'notGranted' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })
    check(
      'a door refusal draws the denial, not "the order could not be opened"',
      (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'denied',
    )
    check(
      'and offers no dead "try again" — only the ways home',
      (await page.locator('[data-cc-notice] button, [data-cc-notice] a').count()) === 2,
    )
    await context.close()
  }

  // ---- 9. the leaf is hidden in both refused cases ----
  for (const scenario of [{ granted: false }, { probe: 'unreachable' }]) {
    const { context, page } = await open(browser, scenario)
    await page.goto(`${BASE}/`)
    await page.locator('nav').first().waitFor({ timeout: 10_000 })
    const labels = await page
      .locator('nav')
      .first()
      .locator('button, a')
      .evaluateAll((els) => els.map((e) => e.innerText.trim()))
    check(
      `the leaf is hidden (${scenario.probe === 'unreachable' ? 'probe errored' : 'not granted'})`,
      !labels.some((l) => /call center/i.test(l)),
      labels.join(' | '),
    )
    await context.close()
  }

  // ================= ticket 163 — an order is already open =================

  // ---- 10. the choice is drawn, and NOTHING of the old order is inherited ----
  {
    const { context, page, errors, calls } = await open(browser, { existing: EXISTING })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice="existing"]').waitFor({ timeout: 10_000 })

    check(
      'the previous caller is named in the heading',
      (await text(page, '[data-cc-existing-title]')).includes(EXISTING.customerName),
      await text(page, '[data-cc-existing-title]'),
    )
    check('the line count is shown', (await text(page, '[data-cc-existing="lines"]')) === String(EXISTING.lineCount))
    check('when it was opened is shown', (await text(page, '[data-cc-existing="opened"]')).length > 0, await text(page, '[data-cc-existing="opened"]'))
    check('the fulfilment store is shown', (await text(page, '[data-cc-existing="store"]')) === EXISTING.plant)

    // 🚩 The heart of it: the previous caller's basket is not on screen at all.
    check('no console is rendered behind the choice', (await page.locator('[data-cc-console]').count()) === 0)
    check('no basket is rendered', (await page.locator('[data-cc-basket]').count()) === 0)
    check(
      'nothing about that order is even fetched until the agent chooses',
      count(calls, /^CallCenterWeb\/State$/) === 0,
    )
    check('it is not treated as an error — Open was a SUCCESS', count(calls, /^CallCenterWeb\/Open$/) === 1)

    check('both choices are offered', (await page.locator('[data-cc-resume]').isVisible()) && (await page.locator('[data-cc-start-fresh]').isVisible()))
    check('and no confirmation is up yet', (await page.locator('[data-cc-abandon-dialog]').count()) === 0)
    // 🚩 A chrome-less screen has no nav to leave by (134 §8) — the choice is a
    // non-console state like any other and owes the agent both exits.
    check(
      'the choice still carries both ways home',
      (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 11. Resume — reads THAT order and lands on it ----
  {
    const { context, page, errors, calls } = await open(browser, { existing: EXISTING })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-resume]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-resume]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check('Resume reads the existing order back', count(calls, /^CallCenterWeb\/State$/) === 1)
    check('Resume opens NO second order', count(calls, /^CallCenterWeb\/Open$/) === 1)
    check('Resume abandons nothing', count(calls, /^CallCenterWeb\/Abandon$/) === 0)
    check(
      'the console is back where it was — the lines are there',
      (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length,
      `${await page.locator('[data-cc-line]').count()} line(s)`,
    )
    check(
      'and it is THAT order, by identity',
      (await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')) === PRIOR_ID,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 11b. a resume that FAILS still leaves the agent a way to an order ----
  {
    const { context, page, calls } = await open(browser, { existing: EXISTING, stateFailures: 1 })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-resume]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-resume]').click()
    await page.locator('[data-cc-resume-error]').waitFor({ timeout: 10_000 })

    // 🚩 The failure must not swallow the choice: *abandon and start fresh* is
    // the action that would still get this agent an order.
    check('a failed resume says so on the choice screen', await page.locator('[data-cc-notice="existing"]').isVisible())
    check('and leaves Abandon and start fresh reachable', await page.locator('[data-cc-start-fresh]').isEnabled())
    check('and still carries both ways home', (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()))
    check('a failed resume opened no second order', count(calls, /^CallCenterWeb\/Open$/) === 1)

    // Resume is a retry of itself — `getState` is a pure read, so it costs nothing.
    await page.locator('[data-cc-resume]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('Resume retries itself and lands on the order', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)
    check('and it took two reads, not two opens', count(calls, /^CallCenterWeb\/State$/) === 2 && count(calls, /^CallCenterWeb\/Open$/) === 1)
    await context.close()
  }

  // ---- 12. Abandon and start fresh — confirmed, ordered, and on a NEW id ----
  {
    const { context, page, errors, calls, wire } = await open(browser, { existing: EXISTING })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-start-fresh]').waitFor({ timeout: 10_000 })

    // 🚩 Not reachable by accident: the click OPENS a confirmation, it does not void.
    await page.locator('[data-cc-start-fresh]').click()
    await page.locator('[data-cc-abandon-dialog]').waitFor({ timeout: 5_000 })
    check('the first click only asks', count(calls, /^CallCenterWeb\/Abandon$/) === 0)
    check(
      'and the confirmation names what is thrown away',
      (await text(page, '[data-cc-abandon-cost]')).includes(String(EXISTING.lineCount)),
      await text(page, '[data-cc-abandon-cost]'),
    )
    await page.locator('[data-cc-abandon-cancel]').click()
    // The dialog is gone before we count — otherwise a cancel that DID fire an
    // abandon would simply not have reached the interceptor yet, and the check
    // would pass for the wrong reason. The total count after the real abandon
    // below is the second, independent guard on the same property.
    await page.locator('[data-cc-abandon-dialog]').waitFor({ state: 'detached', timeout: 5_000 })
    check('backing out voids nothing', count(calls, /^CallCenterWeb\/Abandon$/) === 0)
    check('and leaves the choice standing', await page.locator('[data-cc-notice="existing"]').isVisible())

    await page.locator('[data-cc-start-fresh]').click()
    await page.locator('[data-cc-abandon-confirm]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const verbs = wire.filter((w) => /^CallCenterWeb\/(Open|Abandon)$/.test(w.path)).map((w) => w.path)
    check('abandon runs BEFORE the new open', verbs.join(' → ') === 'CallCenterWeb/Open → CallCenterWeb/Abandon → CallCenterWeb/Open', verbs.join(' → '))
    check(
      'it abandons the order the agent was told about',
      wire.find((w) => w.path === 'CallCenterWeb/Abandon')?.body?.transactionId === PRIOR_ID,
    )
    const openIds = wire.filter((w) => w.path === 'CallCenterWeb/Open').map((w) => w.body?.requestId)
    check(
      'the second open is a genuinely NEW action, not a replay of the refused one',
      openIds.length === 2 && openIds[0] && openIds[1] && openIds[0] !== openIds[1],
      openIds.join(' | '),
    )
    check('the abandon carries its own requestId', wire.find((w) => w.path === 'CallCenterWeb/Abandon')?.body?.requestId && !openIds.includes(wire.find((w) => w.path === 'CallCenterWeb/Abandon').body.requestId))
    check('the new order is empty', await page.locator('[data-cc-basket-empty]').isVisible())
    // By IDENTITY, not by emptiness — any other empty order would satisfy a
    // line count of zero, and "you are on a different order" is the claim.
    const landedOn = await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')
    check('and it is not the one that was abandoned', landedOn === FRESH_ID && landedOn !== PRIOR_ID, landedOn)
    check('the cancelled confirmation never voided anything either', count(calls, /^CallCenterWeb\/Abandon$/) === 1)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 13. abandoning from INSIDE a live order — the same act, same landing ----
  {
    const { context, page, errors, wire } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('a live order offers Abandon', await page.locator('[data-cc-abandon]').isVisible())

    await page.locator('[data-cc-abandon]').click()
    await page.locator('[data-cc-abandon-dialog]').waitFor({ timeout: 5_000 })
    check(
      'the same confirmation, naming this order’s caller and cost',
      (await text(page, '[data-cc-abandon-dialog]')).includes(PRIOR_STATE.header.customer.name) &&
        (await text(page, '[data-cc-abandon-cost]')).includes(String(PRIOR_STATE.lines.length)),
      (await text(page, '[data-cc-abandon-dialog]')).replace(/\s+/g, ' '),
    )

    await page.locator('[data-cc-abandon-confirm]').click()
    // 🚩 Never left with nothing: abandon returns no state, so an order follows it.
    await page.waitForFunction(
      () => document.querySelectorAll('[data-cc-line]').length === 0 && !!document.querySelector('[data-cc-console]'),
      undefined,
      { timeout: 10_000 },
    )
    const verbs = wire.filter((w) => /^CallCenterWeb\/(Open|Abandon)$/.test(w.path)).map((w) => w.path)
    check('abandon then open, and the agent lands on an order', verbs.join(' → ') === 'CallCenterWeb/Open → CallCenterWeb/Abandon → CallCenterWeb/Open', verbs.join(' → '))
    check('the console is still there, holding a fresh order', await page.locator('[data-cc-console]').isVisible())
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ============ ticket 164 — collisions, stale tabs, and the contract ============

  // ---- 14. a busy collision is ridden out, and never blocks the screen ----
  {
    const { context, page, errors, calls } = await open(browser, { openState: PRIOR_STATE, stateBusy: 3 })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    // `getState` is §6.1's universal recovery action, and this is the agent's
    // hand on it — the one verb slice 0 has that can meet the claim.
    await page.locator('[data-cc-refresh]').click()
    await page.locator('[data-cc-busy="retrying"]').waitFor({ timeout: 10_000 })

    check('a collision shows the retrying strip', await page.locator('[data-cc-busy="retrying"]').isVisible())
    check(
      'it says it is retrying AND that nothing is lost',
      (await text(page, '[data-cc-busy="retrying"]')).length > 20,
      (await text(page, '[data-cc-busy="retrying"]')).replace(/\s+/g, ' '),
    )
    // 🚩 The heart of it: routine, so the screen is never taken away.
    check('the console is still on screen', await page.locator('[data-cc-console]').isVisible())
    check('the basket is still on screen', await page.locator('[data-cc-basket]').isVisible())
    check(
      'the lines are still there — nothing was blanked while waiting',
      (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length,
    )
    check('no blocking full-screen spinner', (await page.locator('[data-cc-status]').count()) === 0)
    check('no modal over the order', (await page.locator('[data-cc-abandon-dialog]').count()) === 0)
    check('the strip is IN the flow, inside the console', (await page.locator('[data-cc-console] [data-cc-busy]').count()) === 1)
    check('and the order stays usable — its controls are live', await page.locator('[data-cc-abandon]').isEnabled())
    check('it does not offer a retry while it is retrying itself', (await page.locator('[data-cc-busy-retry]').count()) === 0)

    // It clears itself: a collision that resolves leaves no trace to dismiss.
    await page.locator('[data-cc-busy]').waitFor({ state: 'detached', timeout: 15_000 })
    check('the strip clears itself when the collision does', (await page.locator('[data-cc-busy]').count()) === 0)
    check(
      'the retries were the CLIENT’s, on one agent action',
      count(calls, /^CallCenterWeb\/State$/) === 4,
      `${count(calls, /^CallCenterWeb\/State$/)} State call(s)`,
    )
    check('and it opened no second order to recover', count(calls, /^CallCenterWeb\/Open$/) === 1)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 15. the schedule runs out — and the agent still has an action ----
  {
    // Six busy answers = every attempt of the first run; the manual retry then
    // lands on the seventh. The schedule is 0·400·800·1600·3200 ms, so this box
    // spends ~6 s in the strip on purpose — that IS the ceiling being bounded.
    const { context, page, errors } = await open(browser, { openState: PRIOR_STATE, stateBusy: 6 })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-refresh]').click()

    await page.locator('[data-cc-busy="exhausted"]').waitFor({ timeout: 20_000 })
    check('the exhausted schedule says so', await page.locator('[data-cc-busy="exhausted"]').isVisible())
    // 🚩 Never left without an action (US61).
    check('and offers a manual retry', await page.locator('[data-cc-busy-retry]').isVisible())
    check('the order is still there behind it', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)
    check('the sweep stops — nothing implies it is still trying', (await page.locator('[data-cc-busy-hairline]').count()) === 0)

    await page.locator('[data-cc-busy-retry]').click()
    await page.locator('[data-cc-busy]').waitFor({ state: 'detached', timeout: 15_000 })
    check('the manual retry lands them back on their order', await page.locator('[data-cc-console]').isVisible())
    check('and it is the same order, not a new one', (await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')) === PRIOR_STATE.transactionId)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 16. the stale tab: refused, returned to the start, never misrouted ----
  {
    const { context, page, errors, calls } = await open(browser, { openState: PRIOR_STATE, stateClosed: true })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-refresh]').click()
    await page.locator('[data-cc-notice="sessionClosed"]').waitFor({ timeout: 10_000 })

    // 🚩 The dead basket is GONE. A tab still showing an order that no longer
    // exists is where the stale-tab harm starts (§6.2).
    check('the dead order stops being rendered', (await page.locator('[data-cc-console]').count()) === 0)
    check('no lines survive it', (await page.locator('[data-cc-line]').count()) === 0)
    check(
      'the reason is named in the agent’s words',
      /abandoned/i.test(await text(page, '[data-cc-notice="sessionClosed"]')),
      (await text(page, '[data-cc-notice="sessionClosed"]')).replace(/\s+/g, ' '),
    )
    check(
      'and the server’s own sentence is passed through',
      (await text(page, '[data-cc-notice="sessionClosed"]')).includes(CLOSED_MESSAGE),
    )
    check('it is not retried into the ground', count(calls, /^CallCenterWeb\/State$/) === 1)
    check('a chrome-less dead end still carries both ways home', (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()))

    // Return to the start: a genuinely new open action, which either opens or
    // lands on 163's choice naming the agent's real current order.
    await page.locator('[data-cc-retry]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('starting again opens a new order', count(calls, /^CallCenterWeb\/Open$/) === 2)
    check(
      'and it is not the dead one',
      (await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')) === FRESH_ID,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 17. the contract version: a major stops it, a minor is a non-event ----
  {
    const { context, page, errors } = await open(browser, { contractVersion: '2.0' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice="contractVersion"]').waitFor({ timeout: 10_000 })

    check('a major mismatch stops the console', (await page.locator('[data-cc-console]').count()) === 0)
    check('no money is rendered at all', (await page.locator('[data-cc-payable]').count()) === 0)
    check(
      'it names both versions, so someone can act on it',
      /2\.0/.test(await text(page, '[data-cc-notice="contractVersion"]')),
      (await text(page, '[data-cc-notice="contractVersion"]')).replace(/\s+/g, ' '),
    )
    // Retrying cannot change which client is installed.
    check('and offers no dead "try again" — only the ways home', (await page.locator('[data-cc-notice] button, [data-cc-notice] a').count()) === 2)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }
  {
    // §9 — additive changes bump the minor and ship server-first. A console that
    // stopped on one would make every additive server change a client release.
    const { context, page } = await open(browser, { contractVersion: '1.7' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('minor drift is ignored by rule', await page.locator('[data-cc-basket]').isVisible())
    await context.close()
  }
  {
    // 🚩 And a server that sends no version at all still gets a console. Law 10
    // says it should send one, but silence is not evidence of a MAJOR change —
    // stopping here would brick the console against the very server this slice
    // is waiting on (BackOffice 804 is unbuilt).
    const { context, page } = await open(browser, { contractVersion: 'none' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('a missing version degrades rather than refusing', await page.locator('[data-cc-basket]').isVisible())
    await context.close()
  }

  // ============ ticket 165 — the caller, the rail, and the address book ============

  // ---- 18/19. the caret, the lookup, the six-field card, the opened book ----
  {
    const { context, page, errors, calls, wire } = await open(browser, {})
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    // 🚩 US9 / CC2 finding 1: the first keystroke of the call is the one the
    // screen expects. Nothing has been clicked at this point.
    check(
      'the caret is in the phone field the moment the console opens',
      await page.evaluate(() => document.activeElement?.id === 'cc-phone'),
      await page.evaluate(() => document.activeElement?.tagName + '#' + document.activeElement?.id),
    )

    // 🚩 Customer-first as intent, not enforcement: with no caller there is no
    // control to poke — the console states the next step instead.
    check(
      'no caller ⇒ the address block offers nothing to reach',
      (await page.locator('[data-cc-pick-address]').count()) === 0 &&
        (await page.locator('[data-cc-address="noCaller"]').isVisible()),
    )
    check(
      'and it says what the next step is',
      (await text(page, '[data-cc-address="noCaller"]')).length > 10,
      (await text(page, '[data-cc-address="noCaller"]')).replace(/\s+/g, ' '),
    )

    // Typing straight in, without clicking: the caret is already there.
    await page.keyboard.type(MEMBER.mobile)
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-lookup-found]').waitFor({ timeout: 10_000 })
    check(
      'the lookup names who was found BEFORE anything is bound to the order',
      (await text(page, '[data-cc-lookup-found]')).includes(MEMBER.fullName),
      (await text(page, '[data-cc-lookup-found]')).replace(/\s+/g, ' '),
    )
    check('finding is not attaching', count(calls, /^CallCenterWeb\/AttachCustomer$/) === 0)
    check('the caller is still not on the order', (await page.locator('[data-cc-caller]').count()) === 0)
    check(
      'and the address book is still shut',
      (await page.locator('[data-cc-pick-address]').count()) === 0,
    )

    await page.locator('[data-cc-attach]').click()
    await page.locator('[data-cc-caller]').waitFor({ timeout: 10_000 })

    const attach = wire.find((w) => w.path === 'CallCenterWeb/AttachCustomer')
    check('attach sends the loyalty id the lookup returned', attach?.body?.customerId === MEMBER.loyId, String(attach?.body?.customerId))
    check('on this order, with its own requestId', attach?.body?.transactionId === STATE.transactionId && !!attach?.body?.requestId)
    check(
      'and it is one action, one id — not the open’s',
      attach?.body?.requestId !== wire.find((w) => w.path === 'CallCenterWeb/Open')?.body?.requestId,
    )

    // 135's compact-layout discipline: the seventh field is what turns a rail
    // into a form. The cap is asserted, not assumed.
    const fields = await page.locator('[data-cc-rail-field]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-cc-rail-field')),
    )
    check('the rail card is capped at six fields', fields.length <= 6, `${fields.length}: ${fields.join(', ')}`)
    check(
      'in a fixed order, identity first',
      fields.join(',') === 'name,mobile,member,tier,points,email',
      fields.join(','),
    )
    check(
      'the identity shown is the ORDER’s, not the lookup’s',
      (await text(page, '[data-cc-rail-field="name"]')).includes(ATTACHED_CUSTOMER.name) &&
        ATTACHED_CUSTOMER.name !== MEMBER.fullName,
      await text(page, '[data-cc-rail-field="name"]'),
    )
    check('the rail is still pinned at the start edge', await page.locator('[data-cc-rail]').isVisible())

    // 🚩 The heart of it: the control appears because `capabilities` opened it.
    check('attaching opens the address book', await page.locator('[data-cc-pick-address]').isVisible())
    check(
      'as an empty dashed slot, with its own action',
      (await page.locator('[data-cc-address="pick"]').isVisible()) &&
        (await page.locator('[data-cc-address="noCaller"]').count()) === 0,
    )

    // 🚩 And the next call starts clean. A found card left standing would offer
    // *Attach this caller* for the caller just removed, over a box still holding
    // their number — and US9's caret would land in the previous call.
    await page.locator('[data-cc-remove-caller]').click()
    await page.locator('#cc-phone').waitFor({ timeout: 10_000 })
    check('removing the caller empties the search', (await page.locator('#cc-phone').inputValue()) === '')
    check('the removed caller is not left there to re-attach', (await page.locator('[data-cc-attach]').count()) === 0)
    check('nor their found card', (await page.locator('[data-cc-lookup-found]').count()) === 0)

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 19b. the capability decides, not "a caller is attached" ----
  {
    // A caller IS attached and the door still says no (§6.3 — v1.1's PickInStore
    // reports through the same capability). A console that re-derived the rule
    // would offer a control the door refuses.
    const attachedShut = {
      ...PRIOR_STATE,
      header: { ...PRIOR_STATE.header, address: null },
      capabilities: { ...PRIOR_STATE.capabilities, canOpenAddressBook: false },
    }
    const { context, page } = await open(browser, { openState: attachedShut })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('a caller alone does not open the book', (await page.locator('[data-cc-pick-address]').count()) === 0)
    check(
      'and the closed state is not a disabled control to poke',
      (await page.locator('[data-cc-address="unavailable"]').isVisible()) &&
        (await page.locator('[data-cc-address="unavailable"] button').count()) === 0,
    )
    await context.close()
  }

  // ---- 20. a number nobody holds ----
  {
    const { context, page, errors, calls } = await open(browser, { memberFound: false })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.keyboard.type('0500000000')
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-lookup-miss]').waitFor({ timeout: 10_000 })

    check('a miss says so', (await text(page, '[data-cc-lookup-miss]')).length > 10, (await text(page, '[data-cc-lookup-miss]')).replace(/\s+/g, ' '))
    check('a miss is not an error', (await page.locator('[data-cc-lookup-error]').count()) === 0)
    // ⚠ Loyalty signup is 159's undrawn surface — this slice must not invent one.
    check('and offers nothing to attach', (await page.locator('[data-cc-attach]').count()) === 0)
    check('nothing was bound to the order', count(calls, /^CallCenterWeb\/AttachCustomer$/) === 0)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 21. removing the caller: the address goes, the store stays ----
  {
    // Off an order that has BOTH — a caller, their address, and a plant derived
    // from it. That is the only shape in which "the store stays" can be seen.
    const { context, page, errors, wire } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-caller]').waitFor({ timeout: 10_000 })
    check('the address is on the order to begin with', await page.locator('[data-cc-address="set"]').isVisible())
    const storeBefore = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')

    await page.locator('[data-cc-remove-caller]').click()
    await page.locator('[data-cc-caller]').waitFor({ state: 'detached', timeout: 10_000 })

    check('the caller is gone from the rail', (await page.locator('[data-cc-caller]').count()) === 0)
    check('the address goes with them', (await page.locator('[data-cc-address="set"]').count()) === 0)
    check('and the book is shut again', (await page.locator('[data-cc-pick-address]').count()) === 0)

    // 🚩 The property the whole slice turns on: a re-attach must not silently
    // re-price the basket, so the derived store is still standing.
    const storeAfter = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')
    check('the derived store chip is still standing', storeAfter === storeBefore && storeAfter.includes(PRIOR_STATE.header.plant), storeAfter)
    check(
      'and still reads as derived, not chosen',
      (await text(page, '[data-cc-chip="store"]')).length > 0 &&
        (await page.locator('[data-cc-chip="store"]').getAttribute('data-cc-chip-state')) === 'settled',
    )
    check('the basket is untouched', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)

    const remove = wire.find((w) => w.path === 'CallCenterWeb/RemoveCustomer')
    check('remove carries the order and its own requestId', remove?.body?.transactionId === PRIOR_STATE.transactionId && !!remove?.body?.requestId)
    // The caret returns to where the next call starts.
    check('the phone field is back', await page.locator('#cc-phone').isVisible())
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
