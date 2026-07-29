// The fulfilment axis, driven against the WIRED console (ticket 182).
//
//   1. npx vite --port 5199
//   2. node tools/fulfilment-176-drive.mjs
//
// 🚩 **Re-pointed.** This drive was written for ticket 176's prototype route
// (`/prototype/callcenter-fulfilment`), where the flip was applied in local
// component state and no verb existed. It now drives **`/callcenter` — the real
// `CallCenterConsolePage`** through the real `setFulfilment` / `setPaymentType`
// mutations, which is the thing 182 exists to prove: an unwired prototype
// component mounting in the shipped page against a real mutation.
//
// Nothing about the app is stubbed except the wire. The two poles of the flip
// are the WIRE'S OWN BYTES — capture 09, both sides of a real `setFulfilment` —
// and the stub's `SetFulfilment` handler reproduces exactly the transformation
// that capture recorded. ⚠ Everything else is a **stub and says so** (177's
// rule), because four of the paths drawn here are unreachable against today's
// server: `SetFulfilment` and `SetPaymentType` are contract v1.8 / v1.4 and
// BackOffice 877 / 871 are unbuilt; `waivedReason` is v1.5 and 874 is unbuilt;
// `canChangePaymentType: false` is a state §2.4 says no phase-1 order reaches;
// and `retainedAddressLabel` postdates the capture it rides on.
//
// What it asserts is everything a screenshot cannot:
//
//   1. the slot chip is ABSENT under collection, not empty and not disabled
//   2. the delivery region is ABSENT under collection — 156's ruling, against
//      the capture that would otherwise draw `Delivery SAR 0.00` + a
//      free-delivery promise on an order nobody delivers
//   3. the rail's two blocks occupy the SAME place, so the flip moves no
//      furniture — 135's one winning property, measured rather than eyeballed
//   4. the retained address leaves a trace after the flip
//   5. a shut `canChangeFulfilment` stops being a control AND says why
//   6. the payment chip's WORD follows the mode while the wire value does not —
//      now provable from the REQUESTS: the flip sends one `SetFulfilment` and no
//      `SetPaymentType` at all
//   7. `STORE_NOT_CHOSEN` reaches the receipt as real words on the store chip,
//      never as the *unknown blocker* phrase (175's own blocker, US17)
//   8. no state throws, and the centre column never scrolls sideways
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const OUT = '.issues/assets/176-fulfilment'

/* ------------------------------------------------ the two poles, captured --- */

const capture09 = JSON.parse(
  readFileSync(new URL('../.issues/assets/136-cc-contract/09-fulfilment-flip.json', import.meta.url), 'utf8'),
)
const leg = (name) => capture09[name].response.body.data

/** The pickup side — `setFulfilment` answered. Address gone, slot gone, fee 0.
 *  ⚠ One field is ADDED: `retainedAddressLabel` (v1.8) postdates the capture. */
const PICKUP = (() => {
  const captured = leg('flip')
  return { ...captured, header: { ...captured.header, retainedAddressLabel: 'Home' } }
})()

/**
 * The delivery side. The capture's delivery leg has an empty basket while its
 * pickup leg has lines (un-captured adds happened between them), and for a
 * comparison of two MODES that difference is noise — the receipt would be
 * comparing two baskets. So the delivery state borrows the pickup leg's lines
 * with the fee the capture itself recorded for delivery. Nothing about the fee,
 * the mode or the capabilities is invented.
 */
const DELIVERY = (() => {
  const bare = leg('deliveryBefore')
  return {
    ...bare,
    lines: PICKUP.lines,
    firedPromotions: PICKUP.firedPromotions,
    capabilities: {
      ...bare.capabilities,
      submitBlockers: bare.capabilities.submitBlockers.filter((b) => b !== 'NO_LINES'),
    },
    totals: {
      ...PICKUP.totals,
      deliveryFee: bare.totals.deliveryFee,
      payable: Number((PICKUP.totals.gross + bare.totals.deliveryFee.amount).toFixed(2)),
    },
  }
})()

/** A shallow patch reaching the three nests the scenarios actually vary in. */
const patch = (base, { header, capabilities, deliveryFee } = {}) => ({
  ...base,
  header: { ...base.header, ...header },
  capabilities: { ...base.capabilities, ...capabilities },
  totals: { ...base.totals, deliveryFee: { ...base.totals.deliveryFee, ...deliveryFee } },
})

const SCENARIOS = {
  delivery: DELIVERY,
  pickup: PICKUP,
  pickupUnchosen: patch(PICKUP, {
    header: { plantSource: 'seededAtOpen' },
    capabilities: {
      canAddItem: false,
      canConfirmSeededStore: true,
      submitBlockers: ['STORE_NOT_CHOSEN', 'MISSING_SOURCE_REFERENCE'],
    },
  }),
  pickupChosen: patch(PICKUP, { header: { plantSource: 'chosenForPickup' } }),
  deliveryPaidOnline: patch(DELIVERY, { header: { paymentType: 'Online' } }),
  pickupPaidOnline: patch(PICKUP, { header: { paymentType: 'Online' } }),
  waivedThreshold: patch(DELIVERY, {
    deliveryFee: { amount: 0, waived: true, waivedReason: 'ThresholdReached' },
  }),
  waivedCampaign: patch(DELIVERY, {
    deliveryFee: { amount: 0, waived: true, waivedReason: 'PromotionalWindow' },
  }),
  waivedUnknown: patch(DELIVERY, {
    deliveryFee: { amount: 0, waived: true, waivedReason: 'SomethingNewer' },
  }),
  lockedSource: patch(DELIVERY, {
    header: { documentSource: 'WSFD', sourceReference: 'WSF-40218' },
    capabilities: {
      canChangeFulfilment: false,
      capabilityReasons: { canChangeFulfilment: 'DELIVERY_ONLY_SOURCE' },
      submitBlockers: ['MISSING_SLOT'],
    },
  }),
  lockedPayment: patch(DELIVERY, {
    header: { paymentType: 'Online', paymentTypeForcedReason: 'PAYMENT_TYPE_FORCED' },
    capabilities: {
      canChangePaymentType: false,
      capabilityReasons: { canChangePaymentType: 'PAYMENT_TYPE_FORCED' },
    },
  }),
}
const PICKUP_STATES = new Set(['pickup', 'pickupUnchosen', 'pickupChosen', 'pickupPaidOnline'])

mkdirSync(OUT, { recursive: true })

let pass = 0
let fail = 0
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`)))

/* ------------------------------------------------------------- the wire ----- */

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

/**
 * The server half this slice waits on, stubbed. ⚠ `SetFulfilment` and
 * `SetPaymentType` DO NOT EXIST server-side yet (BackOffice 877 / 871), so what
 * they answer here is capture 09's own transformation applied to whatever state
 * the scenario opened with — the same fields moving, in the same response.
 */
const consequencesOf = (served, mode) => {
  const collecting = mode === 'PickInStore'
  return {
    ...served,
    version: served.version + 1,
    header: {
      ...served.header,
      deliveryType: mode,
      // The server clears it and the sidecar keeps it; the LABEL is what comes
      // back, because a client that remembers the address reads two ways.
      address: collecting ? null : DELIVERY.header.address,
      retainedAddressLabel: collecting
        ? (served.header.address?.label ?? served.header.retainedAddressLabel ?? null)
        : null,
      slot: collecting ? null : DELIVERY.header.slot,
    },
    totals: {
      ...served.totals,
      deliveryFee: {
        ...served.totals.deliveryFee,
        amount: collecting ? 0 : DELIVERY.totals.deliveryFee.amount,
      },
      payable: Number(
        (served.totals.gross + (collecting ? 0 : DELIVERY.totals.deliveryFee.amount)).toFixed(2),
      ),
    },
    capabilities: {
      ...served.capabilities,
      canOpenAddressBook: !collecting,
      submitBlockers: collecting
        ? served.capabilities.submitBlockers.filter((b) => b !== 'MISSING_SLOT')
        : [...new Set([...served.capabilities.submitBlockers, 'MISSING_SLOT'])],
    },
  }
}

const browser = await chromium.launch()

/** A fresh context per scenario — each opens on a different state. */
async function open(scenario) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const wire = []
  let served = SCENARIOS[scenario]

  page.on('pageerror', (e) => errors.push(String(e)))
  // Chromium logs every non-2xx as a console error whether or not the app
  // handled it; that line is the browser's network log, not the app's.
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (route.request().method() === 'POST') {
      let body = null
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
      wire.push({ path, body })
    }
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (path === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (path === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (path === 'CallCenterWeb/State') return route.fulfill(envelope(served))
    // ⚠ The two verbs this ticket wires. Unbuilt server-side (877 / 871).
    if (path === 'CallCenterWeb/SetFulfilment') {
      served = consequencesOf(served, route.request().postDataJSON().mode)
      return route.fulfill(envelope(served))
    }
    if (path === 'CallCenterWeb/SetPaymentType') {
      // 🚩 The axis is independent: nothing else in the response moves. Not the
      // plant, not a line, not the fee — `deliveryFee`'s predicate has no
      // payment term in it at all (§2.4).
      served = {
        ...served,
        version: served.version + 1,
        header: { ...served.header, paymentType: route.request().postDataJSON().paymentType },
      }
      return route.fulfill(envelope(served))
    }
    if (/Access$/.test(path))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })

  await page.goto(`${BASE}/callcenter`)
  await page.waitForSelector('[data-cc-chips]')
  return { context, page, errors, wire }
}

const shot = async (page, name) => {
  await page.addStyleTag({ content: '.fixed{display:none !important}' })
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const measure = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main')
    const rail = document.querySelector('[data-cc-rail]')
    return {
      chips: [...document.querySelectorAll('[data-cc-chip]')].map((c) => c.dataset.ccChip),
      chipText: document.querySelector('[data-cc-chips]').innerText,
      fee: !!document.querySelector('[data-cc-delivery-fee]'),
      waived: !!document.querySelector('[data-cc-delivery-waived]'),
      waivedReason: document.querySelector('[data-cc-delivery-waived-reason]')?.innerText ?? null,
      threshold: !!document.querySelector('[data-cc-delivery-threshold]'),
      receipt: document.querySelector('[data-cc-receipt]').innerText,
      blockers: document.querySelector('[data-cc-blockers]')?.innerText ?? null,
      collection: document.querySelector('[data-cc-collection]')?.dataset.ccCollection ?? null,
      address: document.querySelector('[data-cc-address]')?.dataset.ccAddress ?? null,
      payable: document.querySelector('[data-cc-payable]')?.innerText ?? null,
      retained: document.querySelector('[data-cc-address-retained]')?.innerText ?? null,
      // The rail's SECOND block, measured two ways — the numbers that prove the
      // flip moves no furniture. `blockTop` is taken from the rail's own top so
      // a scroll position cannot flatter it; `blockHeight` is the one the spec
      // names (226 px in both modes) and the one that can actually fail, since
      // the block is the last thing in the rail and its top could not move even
      // if its contents doubled.
      ...(() => {
        const block = document.querySelector('[data-cc-collection], [data-cc-address]')
        if (!block || !rail) return { blockTop: null, blockHeight: null, blockIsLast: null }
        const box = block.getBoundingClientRect()
        // 🚩 What is UNDER the block, which is the half a top-offset measurement
        // cannot see: the two faces are not the same height (an address is more
        // lines than a store name), and the reason that is harmless is that
        // nothing follows them. The day something does, this goes false and the
        // drive demands the height invariant be proven rather than assumed.
        const section = block.closest('[data-cc-rail] > *') ?? block
        return {
          blockTop: Math.round(box.top - rail.getBoundingClientRect().top),
          blockHeight: Math.round(box.height),
          blockIsLast: section === rail.lastElementChild,
        }
      })(),
      fulfilmentLocked: document.querySelector('[data-cc-fulfilment-locked]')?.innerText ?? null,
      paymentLocked: document.querySelector('[data-cc-payment-locked]')?.innerText ?? null,
      fulfilmentIsButton: document.querySelector('[data-cc-chip="fulfilment"]')?.tagName === 'BUTTON',
      paymentIsButton: document.querySelector('[data-cc-chip="payment"]')?.tagName === 'BUTTON',
      overflowX: main.scrollWidth > main.clientWidth + 1,
    }
  })

/* ------------------------------------------------- the eleven states ------- */

const allErrors = []

for (const st of Object.keys(SCENARIOS)) {
  console.log(`\n${st}`)
  const { context, page, errors } = await open(st)
  const m = await measure(page)
  const collecting = PICKUP_STATES.has(st)

  // 1. The mode chip is first and always present — everything to its right is a
  //    consequence of it, and the order always holds a mode.
  ok(m.chips[0] === 'fulfilment', 'the fulfilment chip is FIRST in the row')

  // 2. 🚩 Absent, not disabled. `RequiresSlot(bool isDelivery) => isDelivery`,
  //    and the server drops MISSING_SLOT in the same response.
  ok(
    m.chips.includes('slot') === !collecting,
    `slot chip ${collecting ? 'ABSENT under collection' : 'present under delivery'}`,
  )

  // 3. 🚩 156's ruling, against the capture that breaks it today.
  if (collecting) {
    ok(!m.fee && !m.waived, 'no delivery figure at all under collection')
    ok(!m.threshold, 'no free-delivery promise under collection')
    ok(!/Delivery/.test(m.receipt), 'the word "Delivery" is not in the receipt at all')
  }

  // 4. The rail's two blocks are the same block.
  ok(
    collecting ? m.collection !== null && m.address === null : m.address !== null && m.collection === null,
    `the rail draws the ${collecting ? 'COLLECTION' : 'ADDRESS'} block and only that one`,
  )

  ok(!m.overflowX, 'the centre never scrolls sideways')

  // 🚩 The capture's own contradiction, drawn: `plantSource` stays
  // `derivedFromAddress` across the flip while `address` goes null, so a chip
  // reading *from the address* would point at something the console cannot show
  // — and under pickup the plant is what the agent CHOSE.
  if (st === 'pickup') {
    ok(SCENARIOS.pickup.header.plantSource === 'derivedFromAddress', 'the capture still says derivedFromAddress…')
    ok(SCENARIOS.pickup.header.address === null, '…on a response that carries no address…')
    ok(!/derived/i.test(m.chipText), '…and the store chip drops the (derived) parenthetical anyway')
  }
  if (st === 'delivery') ok(/derived/i.test(m.chipText), 'the parenthetical is present under delivery — the mode suppresses it, nothing else')

  if (st === 'lockedSource') {
    ok(!m.fulfilmentIsButton, 'a delivery-only source makes the chip stop being a control')
    ok(!!m.fulfilmentLocked, 'and it SAYS WHY, beside the row')
    ok(/delivered, never collected/.test(m.fulfilmentLocked ?? ''), 'in words an agent can repeat to a caller')
  } else {
    ok(m.fulfilmentIsButton, 'the fulfilment chip is a control')
  }

  if (st === 'lockedPayment') {
    ok(!m.paymentIsButton, 'a forced payment type makes the chip settled and non-interactive')
    ok(!!m.paymentLocked, 'and it carries its reason (⚠ unreachable in phase 1 — stubbed)')
  }

  // 7. 🚩 US17 — 175 ruled this code onto the contract and this client never had
  //    it, so the ONE blocker that ticket exists to raise would have reached the
  //    agent as the *unknown* phrase.
  if (st === 'pickupUnchosen') {
    ok(/choose the fulfilment store/.test(m.blockers ?? ''), 'STORE_NOT_CHOSEN reaches the receipt as real words')
    ok(
      !/something else this order needs/.test(m.blockers ?? ''),
      'and never as the unknown-blocker phrase',
    )
  }

  if (st === 'waivedThreshold') ok(/over the free-delivery threshold/.test(m.waivedReason ?? ''), 'the waived fee names its reason')
  if (st === 'waivedCampaign')
    ok(
      /campaign/.test(m.waivedReason ?? ''),
      'the branch the client could never infer: under the threshold and still free',
    )
  if (st === 'waivedUnknown')
    ok(m.waived && m.waivedReason === null, 'an unknown category degrades to the bare word — v1.4 behaviour, never a guess')

  // 6. The payment chip's word follows the mode; the wire value does not.
  if (st === 'pickup') ok(/Pay on collection/.test(m.chipText), 'the payment chip reads "Pay on collection" under collection')
  if (st === 'delivery') ok(/Cash on delivery/.test(m.chipText), 'and "Cash on delivery" under delivery')

  console.log(`  · rail block: ${m.blockHeight}px tall, ${m.blockTop}px from the rail's top`)
  await shot(page, st)
  allErrors.push(...errors)
  await context.close()
}

/* --------------------------------------------- the flip, interactively ----- */
//
// The one thing no screenshot can argue: what MOVES when the agent flips the
// mode mid-call, now through the real page and the real mutation. 135's winning
// property is that the furniture does not move, and the flip is the single
// largest change of state on the screen.

console.log('\nthe flip, in one gesture — through the wired console')
const { context, page, errors, wire } = await open('delivery')

const before = await measure(page)

await page.click('[data-cc-chip-open="fulfilment"]')
await page.waitForSelector('[data-cc-fulfilment-picker]')
ok(
  await page.$('[data-cc-fulfilment-option="PickInStore"]'),
  'the chip opens two full-sentence choices, never a toggle',
)
const consequence = await page.innerText('[data-cc-fulfilment-option="PickInStore"]')
ok(/No address, no slot/.test(consequence), 'each option states its own consequence BEFORE it is chosen')
await shot(page, 'flip-open')

await page.click('[data-cc-fulfilment-option="PickInStore"]')
await page.waitForSelector('[data-cc-collection]')

const after = await measure(page)

// 🚩 THE measurement this ticket exists for: one block with two faces at the
// SAME pixels. Height as well as position, because the block is the rail's last
// child — its top cannot move, so a height-blind assertion would pass over a
// block that had grown by an inch and pushed nothing because there is nothing
// below it to push.
ok(
  before.blockTop === after.blockTop && after.blockTop === 226,
  `the rail's second block starts at the same pixel across the flip (${before.blockTop}px, both modes)`,
)
// 🚩 And the half that measurement cannot see. The two faces are NOT the same
// height (an address is more lines than a store name), so *nothing moves* rests
// entirely on there being nothing beneath them — asserted, not assumed, because
// the day a section is added under this block the invariant silently stops
// holding while every top-offset assertion still passes.
ok(
  before.blockIsLast && after.blockIsLast,
  `nothing is drawn below the block, so its height cannot move anything (${before.blockHeight}px → ${after.blockHeight}px)`,
)
ok(before.chips.length - after.chips.length === 1, 'exactly one chip leaves the row — the slot')
ok(before.payable !== after.payable, 'the total re-quotes with the fee gone')

// 🚩 The ticket's own question: an agent who cannot see the kept address has no
// way to know a flip back will move the store.
ok(!!after.retained, 'the address the order kept leaves a trace')
ok(/switch back to delivery/i.test(after.retained ?? ''), 'and the trace says what a flip back will do')
await shot(page, 'flip-collection')

// 🚩 The wire, not the screen: ONE verb, carrying the mode and a requestId.
const flips = wire.filter((w) => w.path === 'CallCenterWeb/SetFulfilment')
ok(flips.length === 1, `exactly one SetFulfilment (${flips.length})`)
ok(flips[0]?.body?.mode === 'PickInStore', 'carrying the mode the agent chose')
ok(typeof flips[0]?.body?.requestId === 'string' && flips[0].body.requestId.length > 0, 'and one requestId (law 3)')

// 🚩 US21, provable only from the requests: the chip's WORD changed and the
// wire value did not — no payment verb was sent at all.
ok(/Pay on collection/.test(after.chipText), 'the payment chip now reads "Pay on collection"')
ok(!/Cash on delivery/.test(after.chipText), 'and no longer reads "Cash on delivery"')
ok(
  wire.filter((w) => w.path === 'CallCenterWeb/SetPaymentType').length === 0,
  'and NOTHING was sent to change the payment type — the word moved, the value did not',
)

await page.click('[data-cc-chip-open="payment"]')
await page.waitForSelector('[data-cc-payment-picker]')
const payText = await page.innerText('[data-cc-payment-picker]')
ok(/Pay on collection/.test(payText), 'the payment options are worded for collection')
ok(!/Cash on delivery/.test(payText), 'and the delivery wording is nowhere on a collection order')
ok(!/Receivable|On account/.test(payText), 'the reserved third value is not offered (§2.4)')
await shot(page, 'payment-collection')

// The payment verb, on its own act.
await page.click('[data-cc-payment-option="Online"]')
await page.waitForSelector('[data-cc-payment-picker]', { state: 'hidden' })
const paid = wire.filter((w) => w.path === 'CallCenterWeb/SetPaymentType')
ok(paid.length === 1 && paid[0].body?.paymentType === 'Online', 'choosing online sends SetPaymentType once, with the value')
const online = await measure(page)
ok(/Paid online/.test(online.chipText), 'and the chip re-renders from the projection, not from what was clicked')
ok(online.chips.includes('slot') === false, 'the payment change moved nothing else — still a collection order')

await page.click('[data-cc-chip-open="fulfilment"]')
await page.waitForSelector('[data-cc-fulfilment-picker]')
const backText = await page.innerText('[data-cc-fulfilment-picker]')
ok(
  /re-derives the store/.test(backText),
  'going back to delivery warns that the store may move BEFORE the confirmation arrives',
)
await shot(page, 'flip-back-warning')

await page.click('[data-cc-fulfilment-option="Delivery"]')
await page.waitForSelector('[data-cc-address]')
const restored = await measure(page)
ok(restored.chips.includes('slot'), 'the slot chip returns on the way back')
ok(restored.fee, 'and the delivery region re-quotes instantly')
ok(
  restored.blockTop === before.blockTop && restored.blockHeight === before.blockHeight,
  'and the rail block is back to the size and place it started at',
)
// The payment value survives the round trip untouched: two axes, independently.
ok(/Paid online/.test(restored.chipText), 'the payment type survives the flip back — an independent axis')

allErrors.push(...errors)
await context.close()

/* ------------------------------------------------------------------------- */

ok(allErrors.length === 0, `no page errors (${allErrors.length})`)
if (allErrors.length) console.log(allErrors.slice(0, 5))

console.log(
  '\n⚠ STUBS: SetFulfilment + SetPaymentType (BO 877 / 871, unbuilt), waivedReason (v1.5, BO 874),',
)
console.log('  canChangePaymentType:false (§2.4 — unreachable in phase 1), retainedAddressLabel (postdates capture 09).')
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
