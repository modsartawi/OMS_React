// PROTOTYPE DRIVE — throwaway, wayfinder ticket 176 (drawing 155 and 156).
//
//   1. npx vite --port 5199
//   2. node tools/fulfilment-176-drive.mjs
//
// Drives the REAL `ConsoleShell` — not a host that looks like it — through the
// eleven states the fulfilment axis adds, at 1440×900 (135's design width), and
// writes a PNG per state into .issues/assets/176-fulfilment/.
//
// Two of the states are the WIRE'S OWN BYTES (capture 09, both sides of a real
// `setFulfilment`); the rest are stubs and the drive says which, because three
// of the paths drawn here are unreachable against today's server (177's rule).
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
//   6. the payment chip's WORD follows the mode while the wire value does not
//   7. no state throws, and the centre column never scrolls sideways
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199/prototype/callcenter-fulfilment'
const OUT = '.issues/assets/176-fulfilment'
const STATES = [
  'delivery',
  'pickup',
  'pickupUnchosen',
  'pickupChosen',
  'deliveryPaidOnline',
  'pickupPaidOnline',
  'waivedThreshold',
  'waivedCampaign',
  'waivedUnknown',
  'lockedSource',
  'lockedPayment',
]
const PICKUP_STATES = new Set(['pickup', 'pickupUnchosen', 'pickupChosen', 'pickupPaidOnline'])

mkdirSync(OUT, { recursive: true })

let pass = 0
let fail = 0
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`)))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
// 🚩 The capture carries a real near-miss, so the guidance strip does what it
// was built to do and calls `ResolvePrereq` — which the dev proxy answers 5xx
// because SIS.Api is not running beside this prototype. That is the environment,
// not the page: it is the ONE failure allowed through, named rather than
// silenced, so any other resource error still fails the drive.
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

/* ------------------------------------------------- the eleven states ------- */

for (const st of STATES) {
  console.log(`\n${st}`)
  await load(st)

  const m = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('[data-cc-chip]')].map((c) => c.dataset.ccChip)
    const main = document.querySelector('main')
    const rail = document.querySelector('[data-cc-rail]')
    return {
      chips,
      chipText: document.querySelector('[data-cc-chips]').innerText,
      fee: !!document.querySelector('[data-cc-delivery-fee]'),
      waived: !!document.querySelector('[data-cc-delivery-waived]'),
      waivedReason: document.querySelector('[data-cc-delivery-waived-reason]')?.innerText ?? null,
      threshold: !!document.querySelector('[data-cc-delivery-threshold]'),
      receipt: document.querySelector('[data-cc-receipt]').innerText,
      collection: document.querySelector('[data-cc-collection]')?.dataset.ccCollection ?? null,
      address: document.querySelector('[data-cc-address]')?.dataset.ccAddress ?? null,
      // Where the rail's SECOND block starts — the number that proves the flip
      // moves no furniture. Measured from the rail's own top, so a scroll
      // position cannot flatter it.
      blockTop: (() => {
        const block = document.querySelector('[data-cc-collection], [data-cc-address]')
        if (!block || !rail) return null
        return Math.round(block.getBoundingClientRect().top - rail.getBoundingClientRect().top)
      })(),
      fulfilmentLocked: document.querySelector('[data-cc-fulfilment-locked]')?.innerText ?? null,
      paymentLocked: document.querySelector('[data-cc-payment-locked]')?.innerText ?? null,
      fulfilmentIsButton: document.querySelector('[data-cc-chip="fulfilment"]')?.tagName === 'BUTTON',
      paymentIsButton: document.querySelector('[data-cc-chip="payment"]')?.tagName === 'BUTTON',
      overflowX: main.scrollWidth > main.clientWidth + 1,
    }
  })

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

  console.log(`  · rail block starts ${m.blockTop}px from the rail's top`)
  await shot(st)
}

/* --------------------------------------------- the flip, interactively ----- */
//
// The one thing no screenshot can argue: what MOVES when the agent flips the
// mode mid-call. 135's winning property is that the furniture does not move, and
// the flip is the single largest change of state on the screen.

console.log('\nthe flip, in one gesture')
await load('delivery')

const before = await page.evaluate(() => {
  const rail = document.querySelector('[data-cc-rail]')
  const block = document.querySelector('[data-cc-address]')
  return {
    blockTop: Math.round(block.getBoundingClientRect().top - rail.getBoundingClientRect().top),
    chips: [...document.querySelectorAll('[data-cc-chip]')].map((c) => c.dataset.ccChip),
    payable: document.querySelector('[data-cc-payable]').innerText,
  }
})

await page.click('[data-cc-chip-open="fulfilment"]')
await page.waitForSelector('[data-cc-fulfilment-picker]')
ok(
  await page.$('[data-cc-fulfilment-option="PickInStore"]'),
  'the chip opens two full-sentence choices, never a toggle',
)
const consequence = await page.innerText('[data-cc-fulfilment-option="PickInStore"]')
ok(/No address, no slot/.test(consequence), 'each option states its own consequence BEFORE it is chosen')
await shot('flip-open')

await page.click('[data-cc-fulfilment-option="PickInStore"]')
await page.waitForSelector('[data-cc-collection]')

const after = await page.evaluate(() => {
  const rail = document.querySelector('[data-cc-rail]')
  const block = document.querySelector('[data-cc-collection]')
  return {
    blockTop: Math.round(block.getBoundingClientRect().top - rail.getBoundingClientRect().top),
    chips: [...document.querySelectorAll('[data-cc-chip]')].map((c) => c.dataset.ccChip),
    payable: document.querySelector('[data-cc-payable]').innerText,
    retained: document.querySelector('[data-cc-address-retained]')?.innerText ?? null,
  }
})

// 🚩 THE measurement this ticket exists for. The address block and the
// collection block are the same pixels, so nothing under them moves.
ok(before.blockTop === after.blockTop, `the rail's second block does not move (${before.blockTop}px, both modes)`)
ok(before.chips.length - after.chips.length === 1, 'exactly one chip leaves the row — the slot')
ok(before.payable !== after.payable, 'the total re-quotes with the fee gone')

// 🚩 The ticket's own question: an agent who cannot see the kept address has no
// way to know a flip back will move the store.
ok(!!after.retained, 'the address the order kept leaves a trace')
ok(/switch back to delivery/i.test(after.retained ?? ''), 'and the trace says what a flip back will do')
await shot('flip-collection')

await page.click('[data-cc-chip-open="payment"]')
await page.waitForSelector('[data-cc-payment-picker]')
const payText = await page.innerText('[data-cc-payment-picker]')
ok(/Pay on collection/.test(payText), 'the payment options are worded for collection')
ok(!/Cash on delivery/.test(payText), 'and the delivery wording is nowhere on a collection order')
ok(!/Receivable|On account/.test(payText), 'the reserved third value is not offered (§2.4)')
await shot('payment-collection')

await page.click('[data-cc-payment-close]')
await page.click('[data-cc-chip-open="fulfilment"]')
await page.waitForSelector('[data-cc-fulfilment-picker]')
const backText = await page.innerText('[data-cc-fulfilment-picker]')
ok(
  /re-derives the store/.test(backText),
  'going back to delivery warns that the store may move BEFORE the confirmation arrives',
)
await shot('flip-back-warning')

await page.click('[data-cc-fulfilment-option="Delivery"]')
await page.waitForSelector('[data-cc-address]')
const restored = await page.evaluate(() => ({
  chips: [...document.querySelectorAll('[data-cc-chip]')].map((c) => c.dataset.ccChip),
  fee: !!document.querySelector('[data-cc-delivery-fee]'),
}))
ok(restored.chips.includes('slot'), 'the slot chip returns on the way back')
ok(restored.fee, 'and the delivery region re-quotes instantly')

/* ------------------------------------------------------------------------- */

ok(errors.length === 0, `no page errors (${errors.length})`)
if (errors.length) console.log(errors.slice(0, 5))

console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
