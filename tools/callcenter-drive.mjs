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
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`

// The contract's own fixture, verbatim — the same file `__fixtures__/payloads.ts`
// imports. A drive that hand-wrote this payload would be testing the drive.
const OPEN_FIXTURE = JSON.parse(
  readFileSync(new URL('../.issues/assets/136-cc-contract/01-open-empty.json', import.meta.url), 'utf8'),
)
const OPEN_RESULT = OPEN_FIXTURE.response.data
const STATE = OPEN_RESULT.state

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
 */
async function open(browser, { granted = true, probe = 'ok', door = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    calls.push(p)
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
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(door === 'notGranted' ? REFUSAL : envelope(OPEN_RESULT))
    // Every other screen's probe: allowed, so the rest of the shell is normal.
    if (/Access$/.test(p))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }),
      )
    return route.fulfill(envelope([]))
  })

  return { context, page, errors, calls }
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

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
