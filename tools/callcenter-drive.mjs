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
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`

// The contract's own fixture, verbatim — the same file `__fixtures__/payloads.ts`
// imports. A drive that hand-wrote this payload would be testing the drive.
const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
    .response.data

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
  } = {},
) {
  let stateReads = 0
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  // Every POST with its body, in order — how "abandon BEFORE open" and "a new
  // requestId" are PROVEN rather than inferred from what ends up on screen.
  const wire = []
  let opens = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

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
      return route.fulfill(envelope(new URL(url).searchParams.get('transactionId') === PRIOR_ID ? PRIOR_STATE : STATE))
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
        return route.fulfill(envelope({ outcome: 'opened', state: openState, existing: null }))
      return route.fulfill(envelope(existing || openState ? freshOpenResult() : OPEN_RESULT))
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

    // The rail is drawn empty and INERT: attaching a caller is ticket 165's, and
    // US9's caret ships with the lookup that answers it rather than focusing a
    // field that would swallow what the agent types.
    check('the empty rail is drawn, not yet interactive', await page.locator('#cc-phone').isDisabled())

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

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
