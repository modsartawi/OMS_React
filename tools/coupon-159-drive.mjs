// PROTOTYPE DRIVE — throwaway, wayfinder ticket 159.
//
//   1. npx vite --port 5199
//   2. node tools/coupon-159-drive.mjs
//
// Drives the REAL `ConsoleShell` through the two surfaces 135 and 138 never
// drew — the redeemed coupon and the loyalty signup — at 1440×900 (135's design
// width), writing a PNG per state into .issues/assets/159-coupon-signup/.
//
// ⚠ EVERY STATE HERE IS A STUB and the drive says so in its own output. Unlike
// 176, which stood on a real capture of the flip, contract v1.10 exists on no
// server: `header.coupons`, `canApplyCoupon`, `canRemoveCoupon` and
// `removeCoupon` are what this ticket PROPOSES. 177's rule is that a
// hand-authored fixture is a hypothesis about shape and about population, and
// BackOffice `CcContractFixtureTests` is what will settle both.
//
// What it asserts is everything a screenshot cannot:
//
//   1. the coupon chip is LAST in the row and carries no attention mark — the
//      only chip an order need never fill
//   2. the chip carries the CODE and never a figure formatted as money (135's
//      register rule, 138's restatement of it)
//   3. an applied coupon is NAMED — the state that did not exist before v1.10,
//      where the totals moved and nothing said why
//   4. a shut apply-gate is not a shut chip: the list survives, the entry box
//      goes, and the reason is stated rather than left as a dead control (153)
//   5. removing is offered only where the server says so — never derived from
//      the array being non-empty
//   6. 🚩 a refused REMOVAL says NOTHING CHANGED, because the reverse runs
//      before the void (issue 211's ordering) — the opposite of what a failed
//      remove usually means
//   7. the signup hangs off the not-found lookup, is INLINE (no modal over the
//      console during a spoken wait), and carries the number already typed
//   8. the signup ends at a member the agent still has to attach (165's two
//      steps, which a freshly enrolled caller does not skip)
//   8b. 🚩 ticket 190 — 7 and 8 are now asserted against the WIRED console
//      (`/callcenter`, only the wire stubbed) rather than the prototype, which
//      is what lets them assert the two rules that exist only ON THE WIRE: the
//      body carries NO `branchId`, and the mobile goes out AS TYPED while the
//      dialling-code line the agent read back stays a display preview
//   9. no state throws, and the centre column never scrolls sideways
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199/prototype/callcenter-coupon'
const OUT = '.issues/assets/159-coupon-signup'
const STATES = ['none', 'applied', 'twoCoupons', 'shutNoStore', 'shutHolding', 'couponGated', 'signupMiss']

mkdirSync(OUT, { recursive: true })

// The session half of the wired-console section below is the contract's OWN
// committed fixture — the loyalty half beside it is this drive's stub.
const fixture = (name) =>
  JSON.parse(
    readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'),
  ).response.body.data

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

let pass = 0
let fail = 0
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`)))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
// The capture the base state comes from carries a real near-miss, so the
// guidance strip calls `ResolvePrereq` and the dev proxy answers 5xx with no
// SIS.Api beside it. The ONE failure allowed through, named rather than
// silenced — any other resource error still fails the drive.
const PROXY_DEAD = /status of 5\d\d/
page.on('console', (m) => m.type() === 'error' && !PROXY_DEAD.test(m.text()) && errors.push(m.text()))

const shot = async (name) => {
  await page.addStyleTag({ content: '.fixed{display:none !important}' })
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const load = async (state) => {
  await page.goto(`${BASE}?state=${state}`)
  await page.waitForSelector('[data-cc-chips]')
}

/* ------------------------------------------------ the chip, per state ------ */

for (const st of STATES) {
  console.log(`\n${st}  ⚠ stub`)
  await load(st)

  const m = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('[data-cc-chip]')].map((c) => c.dataset.ccChip)
    const coupon = document.querySelector('[data-cc-chip="coupon"]')
    const main = document.querySelector('main')
    return {
      chips,
      couponText: coupon?.innerText ?? null,
      couponAttention: coupon ? /attention/.test(coupon.className) : null,
      couponIsButton: coupon?.tagName === 'BUTTON',
      overflowX: main.scrollWidth > main.clientWidth + 1,
      receipt: document.querySelector('[data-cc-receipt]')?.innerText ?? '',
    }
  })

  // 1. Last in the row. Everything to its left is a fact the order holds or must
  //    hold; a coupon is one the caller may simply not have.
  ok(m.chips[m.chips.length - 1] === 'coupon', 'the coupon chip is LAST in the row')

  // 2. 🚩 The register rule. The chip row has never carried money and this is
  //    not the chip to start with — the amount draws inside the modal.
  ok(!/SAR/.test(m.couponText ?? ''), 'the chip carries no currency word')
  ok(!/\d+\.\d\d/.test(m.couponText ?? ''), 'the chip carries no figure formatted as money')

  // 3. No coupon can ever mark the chip for attention: it carries no
  //    `submitBlocker`, so an empty coupon is a resting state, never an
  //    outstanding field.
  ok(m.couponAttention === false, 'the coupon chip is never attention-marked')

  // 4. 🚩 A shut apply-gate is NOT a shut chip. The modal is where the reason
  //    lives, and an order can hold a coupon on a call where a new one may not
  //    be applied.
  ok(m.couponIsButton, 'the coupon chip is a control in every state, including a shut gate')

  // 5. The coupon never grew a receipt row — the owner ruled chip over receipt,
  //    and the receipt goes on reporting the engine's totals unchanged.
  ok(!/Coupon/i.test(m.receipt), 'the receipt has no coupon row of its own')

  ok(!m.overflowX, 'the centre never scrolls sideways')

  await shot(st)
}

/* --------------------------------------- what the chip says it holds ------- */

console.log('\napplied — the state that did not exist before v1.10')
await load('applied')
{
  const chip = await page.locator('[data-cc-chip="coupon"]').innerText()
  // 3. THE finding. `applyCoupon` shipped in v1.0 and the projection's only
  //    coupon-aware line is the one that HIDES the voucher — so until now the
  //    totals moved and nothing named the coupon.
  ok(/SAVE20/.test(chip), 'the applied coupon is NAMED on the chip')

  await page.click('[data-cc-chip="coupon"]')
  await page.waitForSelector('[data-cc-coupon-picker]')
  const modal = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('[data-cc-coupon-row]')].map((r) => r.dataset.ccCouponRow),
    text: document.querySelector('[data-cc-coupon-picker]').innerText,
    hasInput: !!document.querySelector('[data-cc-coupon-input'.concat(']')),
    hasReadBack: !!document.querySelector('[data-cc-coupon-readback]'),
    removes: document.querySelectorAll('[data-cc-coupon-remove]').length,
  }))
  ok(modal.rows.includes('SAVE20'), 'the modal lists the coupon the order holds')
  ok(/SAR/.test(modal.text), 'the amount IS drawn here — the one place a coupon’s money appears')
  ok(modal.hasInput, 'the entry box is open')
  // 🚩 The read-back is not decoration: the redeem burns the code before the
  // engine sees it, so the moment before the press is the cheap one.
  ok(modal.hasReadBack, 'the entry states that applying redeems the code straight away')
  ok(modal.removes === 1, 'the coupon the order holds offers a removal')
  await shot('applied-modal')
}

/* ---------------------------------------------- the two refusals ----------- */

console.log('\napply refused — a business outcome the agent says out loud')
{
  await page.fill('[data-cc-coupon-input]', 'EXPIRED')
  await page.click('[data-cc-coupon-apply]')
  await page.waitForSelector('[data-cc-coupon-apply-error]')
  const text = await page.locator('[data-cc-coupon-apply-error]').innerText()
  ok(!/COUPON_/.test(text), 'the refusal is a sentence, never a machine code')
  ok(
    (await page.locator('[data-cc-coupon-row]').count()) === 1,
    'a refused apply left the order exactly as it was',
  )
  await shot('apply-refused')
}

console.log('\nremove refused — 🚩 NOTHING CHANGED, which is the opposite of the usual')
await load('twoCoupons')
{
  await page.click('[data-cc-chip="coupon"]')
  await page.waitForSelector('[data-cc-coupon-picker]')
  // FREEDEL is the mock's un-reversible code. The reverse runs BEFORE the void
  // (issue 211), so its refusal leaves the coupon on the order and spent.
  await page.click('[data-cc-coupon-remove="FREEDEL"]')
  await page.waitForSelector('[data-cc-coupon-remove-error]')
  const text = await page.locator('[data-cc-coupon-remove-error]').innerText()
  ok(/nothing has changed/i.test(text), 'the refusal says nothing changed')
  ok(/still/i.test(text), 'and that the coupon is still on the order')
  ok(
    (await page.locator('[data-cc-coupon-row]').count()) === 2,
    'both coupons are still listed — the void never ran',
  )
  await shot('remove-refused')

  // The one that does reverse.
  await page.click('[data-cc-coupon-remove="SAVE20"]')
  await page.waitForFunction(
    () => document.querySelectorAll('[data-cc-coupon-row]').length === 1,
  )
  ok(true, 'a removal that the coupon service allowed takes the coupon off')
}

/* ------------------------------------------------- the shut gate ----------- */

console.log('\nshutNoStore — 🚩 the redemption is stamped with the order’s plant, permanently')
await load('shutNoStore')
{
  await page.click('[data-cc-chip="coupon"]')
  await page.waitForSelector('[data-cc-coupon-picker]')
  const m = await page.evaluate(() => ({
    hasInput: !!document.querySelector('[data-cc-coupon-input]'),
    shut: document.querySelector('[data-cc-coupon-shut]')?.dataset.ccCouponShut ?? null,
    text: document.querySelector('[data-cc-coupon-shut]')?.innerText ?? '',
  }))
  // 153's rule with its one exception honoured: no dead control, but never an
  // empty answer either.
  ok(!m.hasInput, 'the entry box is ABSENT, not disabled')
  ok(m.shut === 'STORE_NOT_CHOSEN', 'the SERVER’S own reason code drives the wording')
  ok(/store/i.test(m.text), 'and the reason is a sentence the agent can repeat to a caller')
  await shot('shut-no-store')
}

console.log('\nshutHolding — a shut gate still shows what the order holds')
await load('shutHolding')
{
  await page.click('[data-cc-chip="coupon"]')
  await page.waitForSelector('[data-cc-coupon-picker]')
  const m = await page.evaluate(() => ({
    rows: document.querySelectorAll('[data-cc-coupon-row]').length,
    hasInput: !!document.querySelector('[data-cc-coupon-input]'),
    removes: document.querySelectorAll('[data-cc-coupon-remove]').length,
  }))
  ok(m.rows === 1, 'the coupon the order holds is still listed')
  ok(!m.hasInput, 'and the way in is gone')
  // 5. Removability is the SERVER'S answer, not `coupons.length > 0`.
  ok(m.removes === 0, 'no removal offered — the server did not say it could be')
  await shot('shut-holding')
}

/* ------------------------- the offer no basket change can reach ----------- */

console.log('\ncouponGated — 🚩 what capture 02 was already offering as *add 1 more*')
await load('couponGated')
{
  const m = await page.evaluate(() => ({
    needsCoupon: [...document.querySelectorAll('[data-cc-needs-coupon-item]')].length,
    text: document.querySelector('[data-cc-guidance-needs-coupon]')?.innerText ?? '',
    // 172's one-click add lives on an ACTIONABLE card. A coupon-gated offer must
    // never become one: the add would qualify the bonus buy and burn nothing.
    actionableCards: document.querySelectorAll('[data-cc-card-class="actionable"]').length,
    count: document.querySelector('[data-cc-guidance-strip-count]')?.innerText ?? '',
    couponCards: document.querySelectorAll('[data-cc-card-class="needsCoupon"]').length,
  }))
  ok(m.needsCoupon === 1, 'the coupon-gated offer is STATED')
  ok(m.actionableCards === 0, 'and is never an actionable card — so it grows no Add')
  ok(m.couponCards === 0, 'it is not drawn as an expandable card at all')
  ok(/coupon/i.test(m.text), 'the row says a coupon is what it needs')
  ok(!/add \d+ more/i.test(m.text), 'and never *add N more*, which no basket change can satisfy')
  ok(!/1 offer/i.test(m.count), 'the top bar does not count it as within reach')
  await shot('coupon-gated-offer')
}

/* ------------------------------------------------- the signup ------------- */
//
// 🚩 **Re-pointed at the WIRED console** (ticket 190). Everything above drives
// the prototype, because contract v1.10's coupon projection exists on no server;
// the signup does not need one — both routes have been on the door since 137 —
// so from here the drive opens `/callcenter`, the real `CallCenterConsolePage`,
// with only the wire stubbed. Which is what lets it assert the two things the
// prototype never could: what actually goes out on the wire, and what does not.

console.log('\nthe wired console — a lookup that finds nobody, and the enrolment that follows')
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const consolePage = await context.newPage()
  const wire = []
  const calls = []
  const pageErrors = []
  consolePage.on('pageerror', (e) => pageErrors.push(String(e)))
  consolePage.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      pageErrors.push(m.text()),
  )

  // The contract's own committed fixture for the session half; the loyalty half
  // is this drive's ⚠ stub — the routes ship, but no SIS.Api runs beside this.
  const OPEN = fixture('01-open-empty')
  const LINES = fixture('02-two-lines-priced').lines
  const MEMBER = {
    loyId: '8809900123',
    mobile: '+966501234567',
    fullName: 'Reem S. Al-Otaibi',
    tier: 'Blue',
    pointsBalance: 0,
    email: null,
  }
  let served = { ...OPEN.state, lines: LINES }

  await consolePage.route('**/api/**', async (route) => {
    const request = route.request()
    const p = request.url().split('/api/')[1].split('?')[0]
    const method = request.method()
    calls.push(`${method} ${p}`)
    if (method === 'POST') {
      let body = null
      try {
        body = request.postDataJSON()
      } catch {
        body = null
      }
      wire.push({ path: p, body })
    }

    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'a.alharbi',
          displayName: 'A. Alharbi',
          currentStoreCode: '1001',
        }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(served))

    // 🚩 A miss is an empty payload on the SUCCESS path, not a 404 — the ordinary
    // outcome of the first thing that happens on a call.
    if (p.startsWith('CallCenterWeb/MemberByMobile')) return route.fulfill(envelope(null))

    // The enrolment's two legs. The first answers nothing but success; the second
    // answers the member — the same shape the lookup would have.
    if (p === 'CallCenterWeb/SignUpByBranch') return route.fulfill(envelope(null))
    if (p === 'CallCenterWeb/ConfirmSignUpByBranch') return route.fulfill(envelope(MEMBER))

    if (p === 'CallCenterWeb/AttachCustomer') {
      served = {
        ...served,
        version: served.version + 1,
        header: {
          ...served.header,
          customer: {
            customerId: MEMBER.loyId,
            name: MEMBER.fullName,
            mobile: MEMBER.mobile,
            loyaltyAttached: true,
          },
        },
      }
      return route.fulfill(envelope(served))
    }

    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }))
    return route.fulfill(envelope([]))
  })

  await consolePage.goto(`http://localhost:5199/callcenter`)
  await consolePage.waitForSelector('[data-cc-rail]')

  // ---- the miss, on ordinary ground --------------------------------------
  await consolePage.fill('#cc-phone', '0501234567')
  await consolePage.click('[data-cc-find]')
  await consolePage.waitForSelector('[data-cc-lookup-miss]')

  const miss = await consolePage.evaluate(() => {
    const block = document.querySelector('[data-cc-lookup-miss]')
    return {
      offered: !!document.querySelector('[data-cc-signup-open]'),
      // A miss is not a failure and must not be dressed as one — no danger
      // ground and no alarm colour anywhere in the block that offers enrolment.
      alarmed: /danger|destructive/.test(block.outerHTML),
      panelBefore: !!document.querySelector('[data-cc-signup]'),
    }
  })
  ok(miss.offered, 'a not-found lookup OFFERS the enrolment')
  ok(!miss.alarmed, 'on ordinary ground — a miss is not a failure')
  ok(!miss.panelBefore, 'and the panel is shut until the agent asks for it')

  await consolePage.click('[data-cc-signup-open]')
  await consolePage.waitForSelector('[data-cc-signup]')

  const opened = await consolePage.evaluate(() => {
    const panel = document.querySelector('[data-cc-signup]')
    const rail = document.querySelector('[data-cc-rail]')
    return {
      insideRail: !!(panel && rail && rail.contains(panel)),
      isModal: !!document.querySelector('[role="dialog"] [data-cc-signup]'),
      mobile: document.querySelector('[data-cc-signup-mobile]')?.value ?? null,
      preview: document.querySelector('[data-cc-signup-preview]')?.innerText ?? '',
      fields: document.querySelectorAll('[data-cc-signup] input, [data-cc-signup] select').length,
      basketRows: document.querySelectorAll('[data-cc-line]').length,
      receipt: !!document.querySelector('[data-cc-receipt]'),
    }
  })
  // 🚩 INLINE. The wait between *Send code* and the code arriving is SPOKEN, and
  // a modal would take the basket away for the length of a conversation the
  // agent is having anyway.
  ok(opened.insideRail, 'the signup runs INLINE in the caller rail')
  ok(!opened.isModal, 'and never as a modal over the console')
  ok(opened.receipt && opened.basketRows > 0, 'the basket is still on screen and still readable')
  ok(opened.mobile === '0501234567', 'the number already typed carries into the signup')
  ok(opened.fields === 2, 'exactly two fields — country and mobile, no name and no email')
  ok(/\+966501234567/.test(opened.preview), 'the previewed number drops SA’s leading zero')
  await consolePage.screenshot({ path: `${OUT}/wired-signup-details.png` })

  // ---- send: what goes on the wire, and what does not ---------------------
  await consolePage.click('[data-cc-signup-send]')
  await consolePage.waitForSelector('[data-cc-signup-otp]')

  const sent = wire.filter((w) => w.path === 'CallCenterWeb/SignUpByBranch')
  ok(sent.length === 1, `one SignUpByBranch on the wire (${sent.length})`)
  const sentBody = sent[0]?.body ?? {}
  // 🚩 The ticket's first deliberate omission. `BranchId` is written to
  // `CreatedByBranchId` PERMANENTLY and the validator does not require it, so a
  // console that named a branch could credit any pharmacy in the estate.
  ok(
    !Object.keys(sentBody).some((k) => /branch/i.test(k)),
    'the body carries NO branch — the server stamps the call centre’s own',
  )
  // 🚩 The second. One normalisation rule, in one place, and that place is not a
  // browser — the loyalty base is keyed on this value (156's exact failure).
  ok(sentBody.mobile === '0501234567', 'the mobile goes out AS TYPED, un-normalised')
  ok(
    sentBody.mobile !== '+966501234567' && !String(sentBody.mobile).includes('966'),
    'the dialling-code line the agent read back is a PREVIEW and never the wire',
  )
  ok(sentBody.countryCode === 'SA', 'the country goes out beside it')
  ok(typeof sentBody.requestId === 'string' && sentBody.requestId.length > 0, 'one action, one id')

  const otp = await consolePage.evaluate(() => ({
    spoken: document.querySelector('[data-cc-signup-spoken]')?.innerText ?? '',
    focused: document.activeElement?.dataset.ccSignupOtp !== undefined,
    resend: !!document.querySelector('[data-cc-signup-resend]'),
    countdown: /\b\d{1,2}:\d\d\b/.test(document.querySelector('[data-cc-signup]').innerText),
    receipt: !!document.querySelector('[data-cc-receipt]'),
  }))
  ok(/read back/i.test(otp.spoken), 'the OTP step scripts what the agent says')
  ok(otp.focused, 'the caret is in the code box')
  // CC2 has neither, and a countdown the console invented would promise an
  // expiry only the loyalty service knows.
  ok(!otp.resend && !otp.countdown, 'no resend and no countdown')
  ok(otp.receipt, 'the basket is still there through the spoken wait')
  await consolePage.screenshot({ path: `${OUT}/wired-signup-otp.png` })

  // ---- confirm: it ends at a member, not at an attached caller ------------
  await consolePage.fill('[data-cc-signup-otp]', '1234')
  await consolePage.click('[data-cc-signup-confirm]')
  await consolePage.waitForSelector('[data-cc-signup-created]')

  const confirmed = wire.filter((w) => w.path === 'CallCenterWeb/ConfirmSignUpByBranch')
  ok(confirmed.length === 1, `one ConfirmSignUpByBranch on the wire (${confirmed.length})`)
  ok(confirmed[0]?.body?.otp === '1234', 'the code the caller read back is on it')
  ok(
    !Object.keys(confirmed[0]?.body ?? {}).some((k) => /branch/i.test(k)) &&
      confirmed[0]?.body?.mobile === '0501234567',
    'the confirm keeps both omissions — no branch, and the number as typed',
  )
  // 🚩 165's two steps, which a freshly enrolled caller does not get to skip.
  ok(
    (await consolePage.locator('[data-cc-signup-attach]').count()) === 1,
    'the confirm ends at a member the agent still has to ATTACH',
  )
  ok(
    calls.filter((c) => /AttachCustomer/.test(c)).length === 0,
    'and NOTHING has been attached — enrolling and attaching are two acts',
  )
  await consolePage.screenshot({ path: `${OUT}/wired-signup-created.png` })

  // ---- the attach the agent still presses ---------------------------------
  await consolePage.click('[data-cc-signup-attach]')
  await consolePage.waitForSelector('[data-cc-caller]')
  const attached = wire.filter((w) => w.path === 'CallCenterWeb/AttachCustomer')
  ok(attached.length === 1, 'pressing Attach sends ONE AttachCustomer')
  ok(attached[0]?.body?.customerId === '8809900123', 'carrying the loyalty id the confirm answered')
  ok(
    (await consolePage.locator('[data-cc-signup]').count()) === 0,
    'and the panel closes behind it — its member is on the order',
  )
  await consolePage.screenshot({ path: `${OUT}/wired-signup-attached.png` })

  ok(pageErrors.length === 0, `the wired console threw nothing (${pageErrors.length})`)
  if (pageErrors.length) console.log(pageErrors.join('\n'))
  await context.close()
}

/* ------------------------------------------------------------ verdict ----- */

ok(errors.length === 0, `no page errors (${errors.length})`)
if (errors.length) console.log(errors.join('\n'))

console.log(`\n${pass}/${pass + fail} — ⚠ every state above is a STUB (contract v1.10 is unbuilt)`)
await browser.close()
process.exit(fail ? 1 : 0)
