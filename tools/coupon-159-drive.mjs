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
//   9. no state throws, and the centre column never scrolls sideways
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199/prototype/callcenter-coupon'
const OUT = '.issues/assets/159-coupon-signup'
const STATES = ['none', 'applied', 'twoCoupons', 'shutNoStore', 'shutHolding', 'couponGated', 'signupMiss']

mkdirSync(OUT, { recursive: true })

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

console.log('\nsignupMiss — the enrolment hangs off a lookup that found nobody')
await load('signupMiss')
{
  const m = await page.evaluate(() => {
    const panel = document.querySelector('[data-cc-signup]')
    const rail = document.querySelector('[data-cc-rail]')
    return {
      // 7. INLINE. A modal over the console during a wait the agent is talking
      //    through takes the basket away for no reason.
      insideRail: !!(panel && rail && rail.contains(panel)),
      isModal: !!document.querySelector('[role="dialog"] [data-cc-signup]'),
      mobile: document.querySelector('[data-cc-signup-mobile]')?.value ?? null,
      preview: document.querySelector('[data-cc-signup-preview]')?.innerText ?? null,
      fields: document.querySelectorAll('[data-cc-signup] input, [data-cc-signup] select').length,
      basketStillThere: !!document.querySelector('[data-cc-receipt]'),
    }
  })
  ok(m.insideRail, 'the signup is INLINE in the caller rail')
  ok(!m.isModal, 'and never a modal over the console')
  ok(m.basketStillThere, 'the receipt is still on screen throughout')
  // 🚩 The number already typed carries in — asking again would read as *that
  // was wrong* when it was merely new.
  ok(m.mobile === '0501234567', 'the number from the lookup carries into the signup')
  // 132's ruling kept whole: country + mobile, and nothing else.
  ok(m.fields === 2, 'exactly two fields — country and mobile, no name and no email')
  ok(/\+966501234567/.test(m.preview ?? ''), 'the number the agent reads back drops SA’s leading zero')
  await shot('signup-details')

  await page.click('[data-cc-signup-send]')
  await page.waitForSelector('[data-cc-signup-otp]')
  const otp = await page.evaluate(() => ({
    spoken: document.querySelector('[data-cc-signup-spoken]')?.innerText ?? '',
    focused: document.activeElement?.dataset.ccSignupOtp !== undefined,
    resend: !!document.querySelector('[data-cc-signup-resend]'),
  }))
  // The wait is SPOKEN, so the instruction is the agent's script rather than a
  // field label.
  ok(/read back/i.test(otp.spoken), 'the OTP step scripts what the agent says')
  ok(otp.focused, 'the caret is in the code box — the agent’s next keystroke is the code')
  // CC2 has neither a resend nor a countdown, and a countdown the console
  // invented would promise an expiry only the loyalty service knows.
  ok(!otp.resend, 'no resend and no countdown — cancelling and starting again is the retry')
  await shot('signup-otp')

  await page.fill('[data-cc-signup-otp]', '1234')
  await page.click('[data-cc-signup-confirm]')
  await page.waitForSelector('[data-cc-signup-created]')
  // 8. 165's two steps. Enrolling somebody and putting them on a live order are
  //    two acts, and only the second is about this order.
  ok(
    (await page.locator('[data-cc-signup-attach]').count()) === 1,
    'the confirm ends at a member the agent still has to ATTACH',
  )
  await shot('signup-created')
}

/* ------------------------------------------------------------ verdict ----- */

ok(errors.length === 0, `no page errors (${errors.length})`)
if (errors.length) console.log(errors.join('\n'))

console.log(`\n${pass}/${pass + fail} — ⚠ every state above is a STUB (contract v1.10 is unbuilt)`)
await browser.close()
process.exit(fail ? 1 : 0)
