// The caller's open sales request becoming this order, driven against the WIRED
// console (ticket 194).
//
//   1. npx vite --port 5199
//   2. node tools/linked-request-drive.mjs
//
// ⚠ **STUBS, and they are the whole server half.** `CallCenterWeb/CustomerRequests`
// and `CallCenterWeb/LinkRequest` DO NOT EXIST server-side — BackOffice 880 is
// being built alongside this slice — so what they answer here is 880's own
// documented shape (§3 for the read, §4 for the compound act), with §4's
// transformation applied to whatever state the scenario opened with. The same rule
// 186 and 182 followed: a stub says so in the drive's own header, and nothing else
// about the app is stubbed except the wire.
//
// Everything else rides on the real captures: capture 01 is the empty order the
// call starts on, capture 02 supplies the priced lines the copy produces (the
// engine's own bytes for two real materials), and the attach leg is the same
// `SessionCustomer`-not-`LoyMemberModel` distinction 165's drive spells out.
//
// What it asserts is everything a screenshot cannot:
//
//   1. attaching a caller with two open requests puts a COUNT in the rail — and a
//      caller with none leaves the rail silent (no furniture on a plain order)
//   2. nothing opens by itself: the picker is drawn only after the agent asks
//   3. the picker lists both requests WITH their lines, the reason in WORDS, and
//      the pharmacist's note — and the reason CODE (`TMRA`) is nowhere on screen
//   4. linking a TMRA request lands the store, PickInStore, paid-online, the copied
//      lines and the source reference in ONE act
//   5. on the WIRE: exactly one `LinkRequest` carrying one `requestId`, **zero**
//      `AddItem`, and **no `customerId`** on the requests read (880 §3 — an
//      unscoped list is every open request in the estate)
//   6. the linked card replaces the count and holds no figure formatted as money
//   7. the skipped report is TWO kinds of row: below-ATP with its figures and an
//      *add anyway*, refused with the server's reason and no handle — and the
//      below-ATP line is NOT on the order until the agent presses
//   8. a basket with lines shuts the offer (`LINES_EXIST`) — read off the
//      capability, never re-derived; the picker's own refusal wording guards the
//      rarer mid-call case, where a link lands in another tab under an open picker
//   9. no page errors, and the centre column never scrolls sideways
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const OUT = '.issues/assets/194-linked-request'
const CONTRACT = new URL('../.issues/assets/136-cc-contract/', import.meta.url)
const capture = (file) => JSON.parse(readFileSync(new URL(file, CONTRACT), 'utf8'))

/* --------------------------------------------------- the captured ground ---- */

/** Capture 01 — the empty order a call opens on. */
const EMPTY = capture('01-open-empty.json').response.body.data.state
/** Capture 02 — two real priced lines, the engine's own bytes. */
const PRICED = capture('02-two-lines-priced.json').response.body.data

/** The caller as the loyalty service knows them (`LoyMemberModel`, not session). */
const MEMBER = {
  loyId: PRICED.header.customer.customerId,
  mobile: '0551234567',
  fullName: 'Nouf Al-Qahtani',
  tier: 'Gold',
  pointsBalance: 1240,
  email: 'caller@example.com',
}
/** The caller as the ORDER holds them — deliberately a different name, so a check
 *  that cannot tell the projection from the lookup proves nothing. */
const ATTACHED_CUSTOMER = { ...PRICED.header.customer }

/* --------------------------------------------- the requests (880 §3, stub) --- */
//
// Each row: documentNo, documentDate, storeCode, reason, reasonDescription, note,
// lines[] {itemNumber, description, quantity, uom}. NO money — the request is
// unpriced and there is no price to carry.

const REQUEST_LINE = (line, quantity) => ({
  itemNumber: line.itemNumber,
  description: line.description,
  quantity,
  uom: line.uom,
})

/** The Tamara request: paid online, collecting in the pharmacy. Its store is NOT
 *  the agent's entry store (1001), so *the store was copied* is provable. */
const TMRA_REQUEST = {
  documentNo: 'SREQ-0001234',
  documentDate: '2026-07-28T09:14:00+03:00',
  storeCode: '1234',
  reason: 'TMRA',
  reasonDescription: 'Tamara payment',
  note: 'Customer paid via Tamara, collecting Mounjaro 5mg',
  lines: [REQUEST_LINE(PRICED.lines[0], 2), REQUEST_LINE(PRICED.lines[1], 1)],
}

/** An ordinary out-of-stock request — no TMRA, so no pickup and no online, and
 *  one line the copy will refuse plus one it will find below availability. */
const STOCK_REQUEST = {
  documentNo: 'SREQ-0001299',
  documentDate: '2026-07-27T16:02:00+03:00',
  storeCode: '1007',
  reason: 'OSTK',
  reasonDescription: 'Item out of stock at the branch',
  note: 'Ring the caller when the insulin pens land',
  lines: [
    REQUEST_LINE(PRICED.lines[0], 6),
    { itemNumber: '900777', description: 'INSULIN PEN NEEDLE 4MM', quantity: 1, uom: 'EA' },
  ],
}

const REQUESTS = [TMRA_REQUEST, STOCK_REQUEST]

/* ------------------------------------------------------------ scenarios ----- */

const withLines = (state) => ({
  ...state,
  lines: PRICED.lines,
  totals: PRICED.totals,
  firedPromotions: PRICED.firedPromotions,
  capabilities: {
    ...state.capabilities,
    canAddItem: true,
    submitBlockers: state.capabilities.submitBlockers.filter((b) => b !== 'NO_LINES'),
  },
})

/** Which state the run opens on, and which requests the caller has. */
const SCENARIOS = {
  // The ordinary path: an empty order, two open requests.
  twoRequests: { state: EMPTY, requests: REQUESTS },
  // A plain order — the rail must gain nothing at all.
  noRequests: { state: EMPTY, requests: [] },
  // 🚩 880 §4.1: the basket already holds lines, so the link is refused. The
  // capability carries the reason and the console never re-derives it.
  linesExist: { state: withLines(EMPTY), requests: REQUESTS },
}

mkdirSync(OUT, { recursive: true })

let pass = 0
let fail = 0
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`)))

/* --------------------------------------------------------------- the wire --- */

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

/** `canLinkRequest` + its reason, derived the way 880 §9 says the server does —
 *  so the console is reading a capability rather than a client rule. */
const gated = (state) => {
  const reason = !state.header.customer
    ? 'NO_CUSTOMER'
    : state.status !== 'open'
      ? 'ORDER_CLOSED'
      : state.lines.length > 0
        ? 'LINES_EXIST'
        : state.header.linkedRequest
          ? 'LINES_EXIST'
          : null
  const capabilityReasons = { ...state.capabilities.capabilityReasons }
  if (reason) capabilityReasons.canLinkRequest = reason
  else delete capabilityReasons.canLinkRequest
  return {
    ...state,
    capabilities: { ...state.capabilities, canLinkRequest: reason === null, capabilityReasons },
  }
}

/**
 * 880 §4, applied — the compound act, in the order the ticket writes it.
 *
 * Stamp + reason, copy the store (`plantSource: fromLinkedRequest`, which does NOT
 * shut the item gate), TMRA ⇒ PickInStore + Online, prefill `sourceReference` only
 * where it is empty, and copy the lines through the guardrails: this stub refuses
 * one line and reports one below ATP on the non-TMRA request, so the report's two
 * kinds are both reachable.
 */
const linked = (served, request) => {
  const tamara = request.reason === 'TMRA'
  // The lines that land, as the engine would answer them — capture 02's own bytes
  // for the materials it holds, at the request's quantity.
  const copyable = request.lines.filter((line) => PRICED.lines.some((l) => l.itemNumber === line.itemNumber))
  const skipped = []
  const copied = []
  for (const line of request.lines) {
    const priced = PRICED.lines.find((l) => l.itemNumber === line.itemNumber)
    if (!priced) {
      // Not sellable at the request's plant — reported with the server's own code.
      skipped.push({ itemNumber: line.itemNumber, quantity: line.quantity, reason: 'NOT_SELLABLE_AT_PLANT' })
      continue
    }
    if (line.quantity > 2) {
      // 🚩 Below availability: NOT added, and never auto-confirmed. `HasBelowAtp`
      // stays false, which is the assertion 880's own Done-when names.
      skipped.push({
        itemNumber: line.itemNumber,
        quantity: line.quantity,
        reason: 'BELOW_ATP',
        requested: line.quantity,
        available: 2,
      })
      continue
    }
    copied.push({ itemNumber: line.itemNumber, quantity: line.quantity })
  }
  void copyable
  const lines = copied.map((c) => {
    const priced = PRICED.lines.find((l) => l.itemNumber === c.itemNumber)
    return { ...priced, qty: c.quantity }
  })
  const state = gated({
    ...served,
    version: served.version + 1,
    header: {
      ...served.header,
      linkedRequest: {
        documentNo: request.documentNo,
        reason: request.reason,
        reasonDescription: request.reasonDescription,
        storeCode: request.storeCode,
        note: request.note,
      },
      plant: request.storeCode,
      plantName: `Store ${request.storeCode}`,
      plantSource: 'fromLinkedRequest',
      ...(tamara ? { deliveryType: 'PickInStore', paymentType: 'Online', address: null, slot: null } : {}),
      // §4.4 — filled only where the agent has typed nothing, never overwritten.
      sourceReference: served.header.sourceReference || request.documentNo,
      // §8.2 — the note is SHOWN by the read and copied onto nothing.
      orderNote: served.header.orderNote,
    },
    lines,
    // The engine re-quotes on every add, so a copy that landed lines has to move
    // the money too — capture 02's own totals where both landed, the opening
    // zeroes where none did. ⚠ Stub arithmetic, and the reason it is crude rather
    // than wrong: law 1 forbids the console computing money, so nothing on screen
    // depends on these being the engine's — only that they are the SERVER's.
    totals: lines.length === request.lines.length ? PRICED.totals : served.totals,
    capabilities: {
      ...served.capabilities,
      // 🚩 `fromLinkedRequest` does not shut the gate: a pharmacist chose that
      // store, in a document, on the record (880 §2).
      canAddItem: true,
      canPriceCheck: true,
      submitBlockers: served.capabilities.submitBlockers.filter(
        (b) =>
          b !== 'STORE_NOT_CHOSEN' &&
          b !== 'MISSING_SOURCE_REFERENCE' &&
          (lines.length > 0 ? b !== 'NO_LINES' : true) &&
          (tamara ? b !== 'NO_ADDRESS' && b !== 'MISSING_SLOT' : true),
      ),
    },
  })
  return { state, copied, skipped }
}

const browser = await chromium.launch()

async function open(scenario) {
  const { state, requests } = SCENARIOS[scenario]
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const wire = []
  let served = gated(state)

  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    const method = route.request().method()
    let body = null
    if (method === 'POST') {
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
    }
    // Every call, with its query string — the requests read is asserted on the
    // absence of a `customerId` param, so the URL has to be recorded whole.
    wire.push({ path, method, url, body })

    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (path === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (path === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (path === 'CallCenterWeb/State') return route.fulfill(envelope(served))
    if (path.startsWith('CallCenterWeb/MemberByMobile/')) return route.fulfill(envelope(MEMBER))
    if (path === 'CallCenterWeb/AttachCustomer') {
      served = gated({
        ...served,
        version: served.version + 1,
        header: { ...served.header, customer: ATTACHED_CUSTOMER },
        capabilities: {
          ...served.capabilities,
          canOpenAddressBook: true,
          submitBlockers: served.capabilities.submitBlockers.filter((b) => b !== 'NO_CUSTOMER'),
        },
      })
      return route.fulfill(envelope(served))
    }
    // ⚠ The two routes this ticket wires. Unbuilt server-side (BackOffice 880).
    if (path === 'CallCenterWeb/CustomerRequests') {
      // 🚩 The scope is the SESSION ROW's. This handler is deliberately blind to
      // anything on the query string — the assertion is that the console sent none.
      return route.fulfill(envelope(requests))
    }
    if (path === 'CallCenterWeb/LinkRequest') {
      const request = requests.find((r) => r.documentNo === body?.documentNo)
      if (!request)
        return route.fulfill(
          envelope(null, {
            status: 409,
            success: false,
            message: 'That request is no longer open.',
            errors: [{ code: 'REQUEST_NOT_OPEN', message: 'That request is no longer open.' }],
          }),
        )
      const result = linked(served, request)
      served = result.state
      return route.fulfill(envelope(result))
    }
    if (path === 'CallCenterWeb/AddItem') {
      // The ordinary add, in its ordinary TWO phases (§5.2) — reached here only by
      // the report's *add anyway*. The first send answers the unchanged state with
      // a `belowAtp` token: a below-ATP line is the agent's to accept, and never
      // this door's to add for them.
      if (!body?.confirmToken) {
        served = {
          ...served,
          pendingConfirmation: {
            kind: 'belowAtp',
            confirmToken: 'TOKEN-194',
            expiresInMs: 120000,
            detail: { itemNumber: body?.itemNumber, requested: body?.qty, available: 2, plant: served.header.plant },
          },
        }
        return route.fulfill(envelope(served))
      }
      // The acceptance, carrying the token: NOW the line lands, and `hasBelowAtp`
      // becomes true because a real agent accepted a real number.
      const priced = PRICED.lines.find((l) => l.itemNumber === body.itemNumber)
      served = {
        ...served,
        version: served.version + 1,
        pendingConfirmation: null,
        header: { ...served.header, hasBelowAtp: true },
        lines: [...served.lines, { ...priced, lineId: `L${served.lines.length + 90}`, qty: body.qty }],
      }
      return route.fulfill(envelope(served))
    }
    if (/Access$/.test(path)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
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

/** Attach the caller — the act that fires the scoped read. */
async function attach(page) {
  await page.fill('#cc-phone', MEMBER.mobile)
  await page.click('[data-cc-find]')
  await page.waitForSelector('[data-cc-attach]')
  await page.click('[data-cc-attach]')
  await page.waitForSelector('[data-cc-caller]')
}

const measure = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main')
    return {
      offer: document.querySelector('[data-cc-request-offer]')?.dataset.ccRequestOffer ?? null,
      offerText: document.querySelector('[data-cc-request-offer]')?.innerText ?? null,
      view: !!document.querySelector('[data-cc-request-view]'),
      picker: !!document.querySelector('[data-cc-request-picker]'),
      card: document.querySelector('[data-cc-request-card]')?.innerText ?? null,
      rail: document.querySelector('[data-cc-rail]').innerText,
      chipText: document.querySelector('[data-cc-chips]').innerText,
      chips: [...document.querySelectorAll('[data-cc-chip]')].map((c) => c.dataset.ccChip),
      basket: document.querySelector('[data-cc-basket]')?.innerText ?? '',
      lines: [...document.querySelectorAll('[data-cc-line]')].length,
      report: document.querySelector('[data-cc-request-report]')?.innerText ?? null,
      skipped: [...document.querySelectorAll('[data-cc-request-skipped]')].map((row) => ({
        item: row.dataset.ccRequestSkipped,
        kind: row.dataset.ccRequestSkippedKind,
        text: row.innerText,
        handle: !!row.querySelector('[data-cc-request-add-anyway]'),
      })),
      screen: document.body.innerText,
      overflowX: main.scrollWidth > main.clientWidth + 1,
    }
  })

const allErrors = []

/* ------------------------------- 1. the count, and the silence beside it ---- */

console.log('\nthe rail volunteers the request')
{
  const { context, page, errors, wire } = await open('twoRequests')
  const before = await measure(page)
  ok(before.offer === null, 'no caller, no count — the read cannot even be fired (880 §3)')

  await attach(page)
  await page.waitForSelector('[data-cc-request-offer]')
  const m = await measure(page)
  ok(m.offer === '2', `the rail counts the caller's open requests (${m.offer})`)
  ok(/2 open requests/.test(m.offerText ?? ''), 'in words, on the caller card it belongs to')
  ok(m.view, 'and offers a way in')
  // 🚩 Nothing opens by itself: the agent is mid-greeting.
  ok(!m.picker, 'the modal is NOT drawn until the agent asks for it')
  ok(m.card === null, 'and there is no linked card on an order that converts nothing')
  ok(!m.overflowX, 'the centre never scrolls sideways')
  await shot(page, 'rail-count')

  // The wire: the read is scoped by the DOOR, and the console sends nothing.
  const reads = wire.filter((w) => w.path === 'CallCenterWeb/CustomerRequests')
  ok(reads.length === 1, `one CustomerRequests read (${reads.length})`)
  ok(
    reads.every((r) => !/customerId/i.test(r.url)),
    '🚩 carrying NO customerId — an unscoped list is every open request in the estate',
  )
  ok(
    reads.every((r) => r.method === 'GET'),
    'as a pure read: no requestId, nothing to collide with',
  )

  allErrors.push(...errors)
  await context.close()
}

console.log('\na plain order gains no furniture')
{
  const { context, page, errors, wire } = await open('noRequests')
  await attach(page)
  const m = await measure(page)
  ok(m.offer === null && !m.view, 'a caller with no open request leaves the rail silent')
  ok(!/request/i.test(m.rail), 'the word "request" appears nowhere in the rail')
  ok(
    wire.filter((w) => w.path === 'CallCenterWeb/CustomerRequests').length === 1,
    'the read still happened — silence is an ANSWER, not a skipped call',
  )
  await shot(page, 'rail-silent')
  allErrors.push(...errors)
  await context.close()
}

/* --------------------------- 2. the picker, and what it says before it copies */

console.log('\nthe picker shows what it is about to copy')
const { context, page, errors, wire } = await open('twoRequests')
await attach(page)
await page.waitForSelector('[data-cc-request-view]')
await page.click('[data-cc-request-view]')
await page.waitForSelector('[data-cc-request-picker]')

const listed = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('[data-cc-request-row]')].map((row) => ({
    documentNo: row.dataset.ccRequestRow,
    text: row.innerText,
    lines: [...row.querySelectorAll('[data-cc-request-line]')].map((l) => l.dataset.ccRequestLine),
    reason: row.querySelector('[data-cc-request-reason]')?.innerText ?? null,
    note: row.querySelector('[data-cc-request-note]')?.innerText ?? null,
    href: row.querySelector('a')?.getAttribute('href') ?? null,
    target: row.querySelector('a')?.getAttribute('target') ?? null,
    link: !!row.querySelector('[data-cc-request-link]'),
  })),
  picker: document.querySelector('[data-cc-request-picker]').innerText,
}))

ok(listed.rows.length === 2, `both requests are listed (${listed.rows.length})`)
ok(listed.rows[0].documentNo === 'SREQ-0001234', 'newest first, as the server ordered them')
ok(listed.rows[0].lines.length === 2, 'with the lines it is about to copy')
ok(/8X4 DEO SPRAY/.test(listed.rows[0].text), 'each line named as the agent would read it out')
ok(/2 EA/.test(listed.rows[0].text), 'with its quantity and UoM')
// 🚩 The reason in WORDS. 880 §3 resolves the description server-side precisely so
// the agent never reads `TMRA` to a caller.
ok(listed.rows[0].reason === 'Tamara payment', 'the reason in WORDS')
ok(!/TMRA|OSTK/.test(listed.picker), '🚩 and the reason CODE is nowhere in the picker')
ok(/Raised at store 1234/.test(listed.rows[0].text), 'the store the pharmacist stood in is named')
// 🚩 WHEN — the half of "the Mounjaro you paid for on Tuesday" that neither the
// number nor the reason carries, and the only thing telling apart two requests
// raised at the same store for the same reason.
ok(/28 Jul 2026/.test(listed.rows[0].text), 'and the day it was raised')
ok(/collecting Mounjaro/.test(listed.rows[0].note ?? ''), "the pharmacist's own note is shown")
// 🚩 The escape hatch, and the ONLY thing this console says about that screen.
ok(listed.rows[0].href === '/oms/document/SREQ-0001234', 'the deep dig is a LINK OUT to the OMS document')
ok(listed.rows[0].target === '_blank', 'in a new tab, so the call keeps its console')
ok(listed.rows.every((r) => r.link), 'and each row offers the link')
// No money: the request is unpriced and there is no figure to invent.
ok(!/SAR|\d+\.\d{2}/.test(listed.picker), 'no figure formatted as money anywhere in the picker')
await shot(page, 'picker-two-requests')

/* ------------------------------------ 3. one press, one act ----------------- */

console.log('\nlinking the TMRA request')
await page.click('[data-cc-request-link="SREQ-0001234"]')
await page.waitForSelector('[data-cc-request-card]')
const after = await measure(page)

ok(!after.picker, 'the picker has answered its question and closed')
ok(after.offer === null, 'the count is gone — the card replaces it')
ok(/SREQ-0001234/.test(after.card ?? ''), 'the linked card names the request')
ok(/Tamara payment/.test(after.card ?? ''), 'in words, again never the code')
ok(/Raised at store 1234/.test(after.card ?? ''), 'and names the store it came from')
// 🚩 No money on the card. Narrow form: the pharmacist's NOTE is server text the
// console may not sub-edit, so what is asserted is that no figure formatted as
// money is drawn — the request is unpriced and the basket holds the order's money.
ok(!/SAR|\d+\.\d{2}/.test(after.card ?? ''), 'the linked card holds no figure formatted as money')

// The four consequences of the one press, read off the projection.
ok(/1234/.test(after.chipText), 'the STORE was copied off the request')
ok(!after.chips.includes('slot'), 'TMRA forced PickInStore — the slot chip is gone (176)')
ok(/Paid online/.test(after.chipText), 'and paid online, which is how Tamara settles')
ok(after.lines === 2, `the request's items are in the basket (${after.lines})`)
ok(/SREQ-0001234/.test(after.chipText), 'the mandatory source reference filled itself (§4.4)')

// 🚩 THE two wire assertions of this ticket.
const links = wire.filter((w) => w.path === 'CallCenterWeb/LinkRequest')
ok(links.length === 1, `exactly one LinkRequest (${links.length})`)
ok(links[0]?.body?.documentNo === 'SREQ-0001234', 'carrying the one request the agent picked')
ok(
  typeof links[0]?.body?.requestId === 'string' && links[0].body.requestId.length > 0,
  'and ONE requestId (law 3) — one agent action, one id',
)
ok(
  wire.filter((w) => w.path === 'CallCenterWeb/AddItem').length === 0,
  '🚩 and ZERO AddItem calls — the console never loops the copy',
)
await shot(page, 'linked-tmra')
allErrors.push(...errors)
await context.close()

/* --------------------------------- 4. the skipped report -------------------- */

console.log('\nthe lines the copy did not take')
{
  const { context, page, errors, wire } = await open('twoRequests')
  await attach(page)
  await page.waitForSelector('[data-cc-request-view]')
  await page.click('[data-cc-request-view]')
  await page.waitForSelector('[data-cc-request-picker]')
  // The out-of-stock request: one line below availability, one the plant refuses.
  await page.click('[data-cc-request-link="SREQ-0001299"]')
  await page.waitForSelector('[data-cc-request-report]')
  const m = await measure(page)

  ok(m.card !== null, '🚩 the link is MADE even though nothing was copied…')
  ok(m.lines === 0, '…and the basket is empty, because both lines were skipped')
  ok(m.skipped.length === 2, `both skipped lines are reported (${m.skipped.length})`)

  const below = m.skipped.find((r) => r.kind === 'belowAtp')
  const refused = m.skipped.find((r) => r.kind === 'refused')
  ok(!!below && !!refused, 'refused and below-ATP are DIFFERENT rows, not one sentence')
  ok(/Asked for 6.*has 2/.test(below?.text ?? ''), 'the below-ATP row carries both figures')
  ok(below?.handle === true, 'and offers the ordinary add-anyway')
  ok(/cannot sell/.test(refused?.text ?? ''), "the refused row carries the server's own reason")
  ok(refused?.handle === false, '🚩 and NO handle — a refusal is not something an agent accepts past')
  await shot(page, 'skipped-report')

  // 🚩 The line is not on the order until the agent presses, and pressing raises
  // the acceptance sheet the console already had — never an auto-confirm.
  await page.click('[data-cc-request-add-anyway="200021"]')
  await page.waitForSelector('[data-cc-confirm-sheet]')
  const sheet = await page.innerText('[data-cc-confirm-sheet]')
  ok(/6/.test(sheet) && /2/.test(sheet), 'add-anyway raises the ORDINARY below-availability sheet')
  const adds = wire.filter((w) => w.path === 'CallCenterWeb/AddItem')
  ok(adds.length === 1, `one AddItem, minted by the agent's own press (${adds.length})`)
  ok(adds[0]?.body?.qty === 6, "at the request's own quantity")
  ok(!adds[0]?.body?.confirmToken, 'and unconfirmed — the token comes from the sheet the agent answers')
  await shot(page, 'add-anyway-sheet')

  // 🚩 And once the agent accepts, the row that said *this did not land* goes —
  // a banner still claiming it over a basket that now holds the line would be the
  // console arguing with the receipt. The refused row stays: nothing answered it.
  await page.click('[data-cc-confirm-accept]')
  await page.waitForSelector('[data-cc-request-skipped="200021"]', { state: 'detached' })
  const landed = await measure(page)
  ok(landed.lines === 1, `the accepted line is on the order (${landed.lines})`)
  ok(
    landed.skipped.length === 1 && landed.skipped[0].item === '900777',
    'its row is gone and the refused one stays — nothing answered that one',
  )
  const confirms = wire.filter((w) => w.path === 'CallCenterWeb/AddItem')
  ok(
    confirms.length === 2 && confirms[1].body?.requestId === confirms[0].body?.requestId,
    'the acceptance is the SAME action re-sent (law 3), not a second add',
  )
  ok(!!confirms[1].body?.confirmToken, 'carrying the token the sheet was drawn from')

  allErrors.push(...errors)
  await context.close()
}

/* --------------------------------- 5. the shut gate ------------------------- */

console.log('\na basket with lines refuses the link')
{
  const { context, page, errors } = await open('linesExist')
  await attach(page)
  const m = await measure(page)
  // 🚩 The count is silent because `canLinkRequest` is false — the server's own
  // LINES_EXIST, never a client re-derivation of it.
  ok(m.offer === null, 'the rail volunteers nothing on a basket that cannot take a link')
  ok(m.lines > 0, `…on an order that does hold lines (${m.lines})`)
  allErrors.push(...errors)
  await context.close()
}

/* --------------------------------------------------------------------------- */

ok(allErrors.length === 0, `no page errors (${allErrors.length})`)
if (allErrors.length) console.log(allErrors.slice(0, 5))

console.log('\n⚠ STUBS: CallCenterWeb/CustomerRequests + LinkRequest (BackOffice 880, UNBUILT) — 880 §3/§4 shape,')
console.log('  and `header.linkedRequest` / `capabilities.canLinkRequest` are contract v1.11, which no server answers yet.')
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
