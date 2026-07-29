/**
 * The chip row's derivation, asserted at its edge: header + capabilities in,
 * chip states out. Shape from the open fixture; every state below is set by the
 * test (CONTRACT.md §11 — a fixture value is never evidence).
 */
import { describe, expect, it } from 'vitest'
import type { SessionState } from '@/core/models/callcenter'
import capture09 from '../../../../.issues/assets/136-cc-contract/09-fulfilment-flip.json'
import { EMPTY_SESSION } from './__fixtures__/payloads'
import { headerChips } from './header-chips'
import { blockedChips } from './submit-blockers'

/** Every blocker code CONTRACT.md §7 names — the whole list, so "no blocker owns
 *  the note chip" is asserted against the contract rather than against one. */
const EVERY_BLOCKER_CODE = [
  'NO_LINES',
  'NO_CUSTOMER',
  'NO_ADDRESS',
  'STORE_NOT_CHOSEN',
  'MISSING_SLOT',
  'MISSING_SOURCE',
  'MISSING_SOURCE_REFERENCE',
  'SOURCE_REFERENCE_REQUIRED',
  'ALREADY_SUBMITTED',
]

/**
 * 🚩 The pickup leg of capture [09](.issues/assets/136-cc-contract/09-fulfilment-flip.json)
 * — the wire's own bytes, chosen because they carry the exact contradiction this
 * ticket's rule exists for: `plantSource: "derivedFromAddress"` surviving in a
 * response that also carries `address: null`. A hand-written state could be
 * accused of inventing the contradiction; the capture cannot.
 */
const PICKUP = (capture09 as { flip: { response: { body: { data: SessionState } } } }).flip.response
  .body.data

const byId = (chips: ReturnType<typeof headerChips>) =>
  Object.fromEntries(chips.map((c) => [c.id, c]))

describe('headerChips', () => {
  it('renders an open, empty order as store-settled and the rest unset', () => {
    const chips = byId(headerChips(EMPTY_SESSION.header, { ...EMPTY_SESSION.capabilities, submitBlockers: [] }))
    // `open` seeds the plant from the agent's entry store, so a store exists
    // before the first item (CONTRACT.md §2.2) — the chip is settled at once.
    expect(chips.store.state).toBe('settled')
    expect(chips.slot.state).toBe('unset')
    expect(chips.source.state).toBe('unset')
    expect(chips.reference.state).toBe('unset')
  })

  it('takes "needs attention" from the server blocker list, not a second rule', () => {
    const chips = byId(
      headerChips(EMPTY_SESSION.header, {
        ...EMPTY_SESSION.capabilities,
        submitBlockers: ['NO_LINES', 'MISSING_SLOT', 'MISSING_SOURCE_REFERENCE'],
      }),
    )
    expect(chips.slot.state).toBe('needsAttention')
    expect(chips.reference.state).toBe('needsAttention')
    // NO_LINES belongs to the basket, not the chip row — it must not leak in.
    expect(chips.store.state).toBe('settled')
    expect(chips.source.state).toBe('unset')
  })

  it('marks the store derived only when it came from the address', () => {
    const derived = byId(
      headerChips({ ...EMPTY_SESSION.header, plantSource: 'derivedFromAddress' }, EMPTY_SESSION.capabilities),
    )
    expect(derived.store.derived).toBe(true)
    const override = byId(
      headerChips({ ...EMPTY_SESSION.header, plantSource: 'operatorOverride' }, EMPTY_SESSION.capabilities),
    )
    expect(override.store.derived).toBeUndefined()
  })

  it('never lets an unknown blocker code reach the chip row', () => {
    // §9 — an additive server change ships server-first, so a code this client
    // has never heard of is an ordinary wire state. It must not become a chip,
    // must not mark an existing one, and must not leak into a chip's text: a
    // raw `MISSING_PAYMENT_TYPE` on screen is a machine code read out to a
    // caller. The receipt still names what is blocking submit — that is where a
    // blocker is answered, and the chip row is not it.
    const chips = headerChips(EMPTY_SESSION.header, {
      ...EMPTY_SESSION.capabilities,
      submitBlockers: ['MISSING_PAYMENT_TYPE', 'MISSING_SLOT'],
    })
    // 176: the mode leads the row. 159 + 183: the coupon and the note close it —
    // the two chips an order need never fill, which is why they sit past the ones
    // that must be. Neither enumerated chip can be marked by a blocker (the mode
    // has none; payment carries none by ruling) and neither can those two.
    expect(chips.map((c) => c.id)).toEqual([
      'fulfilment',
      'store',
      'slot',
      'source',
      'reference',
      'payment',
      'coupon',
      'note',
    ])
    expect(byId(chips).slot.state).toBe('needsAttention')
    expect(chips.filter((c) => c.state === 'needsAttention')).toHaveLength(1)
    expect(chips.some((c) => c.value === 'MISSING_PAYMENT_TYPE')).toBe(false)
  })

  it('🚩 drops the slot chip ENTIRELY under collection — absent, not empty', () => {
    // `RequiresSlot(bool isDelivery) => isDelivery`, and the server drops
    // `MISSING_SLOT` from `submitBlockers` in the same response (capture 09). A
    // slot chip here would be the console asking for something nothing will ever
    // wait on — and an empty or disabled one would imply a collection time this
    // business has no system to keep.
    const ids = headerChips(PICKUP.header, PICKUP.capabilities).map((c) => c.id)
    expect(ids).not.toContain('slot')
    expect(ids[0]).toBe('fulfilment')
    // Nothing else leaves with it: the row is the delivery row minus one chip.
    expect(ids).toEqual(['fulfilment', 'store', 'source', 'reference', 'payment', 'coupon', 'note'])
  })

  it('🚩 suppresses (derived) under collection even where plantSource still says otherwise', () => {
    // The capture's own contradiction: the flip leaves `plantSource` at
    // `derivedFromAddress` while clearing `address`. A chip reading *from the
    // address* on an order that has no address points at something the console
    // cannot show — and under pickup the plant is what the agent CHOSE.
    expect(PICKUP.header.plantSource).toBe('derivedFromAddress')
    expect(PICKUP.header.address).toBeNull()
    const collecting = byId(headerChips(PICKUP.header, PICKUP.capabilities))
    expect(collecting.store.derived).toBeUndefined()
    // ...and it is the MODE that suppresses it, not something else about the
    // capture: the same header under delivery carries the parenthetical.
    const delivering = byId(
      headerChips({ ...PICKUP.header, deliveryType: 'Delivery' }, PICKUP.capabilities),
    )
    expect(delivering.store.derived).toBe(true)
  })

  it('🚩 drops the payment chip entirely for a value it cannot word', () => {
    // US22, the row's half of it. `Receivable` is reserved (§2.4) and no phase-1
    // path produces it; a chip drawn empty — or worse, worded — would be this
    // console describing a payment arrangement nobody agreed to. It leaves the
    // row, exactly as the slot chip does under pickup, and every other chip
    // stays where it was.
    const ids = headerChips(
      { ...EMPTY_SESSION.header, paymentType: 'Receivable' },
      EMPTY_SESSION.capabilities,
    ).map((c) => c.id)
    expect(ids).not.toContain('payment')
    expect(ids).toEqual(['fulfilment', 'store', 'slot', 'source', 'reference', 'coupon', 'note'])
  })

  it('🚩 carries the order note as text, and reads unset when it is null', () => {
    // 183 — the agent types what the caller told them and it travels with the
    // order. It is server-supplied text like the reference chip, never a key:
    // there is no enumeration to word.
    const noted = byId(
      headerChips(
        { ...EMPTY_SESSION.header, orderNote: 'Caller asked for the box, not the strip.' },
        EMPTY_SESSION.capabilities,
      ),
    )
    expect(noted.note.state).toBe('settled')
    expect(noted.note.value).toBe('Caller asked for the box, not the strip.')
    // 🚩 Cleared is UNSET, not settled-and-blank. `setOrderNote(null)` is a real
    // act (a stale instruction must not travel with the order), so the chip has
    // to read as empty afterwards rather than as a note nobody can see. The
    // server clears to `null`; an empty string reaching the client is the same
    // fact and must not draw a settled chip either.
    for (const cleared of [null, '', '   ']) {
      const chips = byId(
        headerChips({ ...EMPTY_SESSION.header, orderNote: cleared }, EMPTY_SESSION.capabilities),
      )
      expect(chips.note.state).toBe('unset')
      expect(chips.note.value).toBeNull()
    }
    // An order that never had one is the same resting state.
    expect(byId(headerChips(EMPTY_SESSION.header, EMPTY_SESSION.capabilities)).note.state).toBe('unset')
  })

  it('🚩 the note never contributes a submit blocker', () => {
    // An order with no note is an ordinary order (183). Nothing in the server's
    // list names it — and the chip must not invent an attention state of its own
    // for a field nothing waits on.
    const chips = byId(
      headerChips(EMPTY_SESSION.header, {
        ...EMPTY_SESSION.capabilities,
        submitBlockers: ['NO_LINES', 'MISSING_SLOT', 'MISSING_SOURCE_REFERENCE'],
      }),
    )
    expect(chips.note.state).toBe('unset')
    expect(blockedChips(['NO_LINES', 'MISSING_SLOT', 'MISSING_SOURCE_REFERENCE'])).not.toContain('note')
    // And no blocker the contract names owns it — a chip that could be marked
    // would be a client-side rule about what an order needs (§2).
    expect([...blockedChips(EVERY_BLOCKER_CODE)]).not.toContain('note')
  })

  it('keeps a blocking chip attention-marked even once it carries a value', () => {
    const chips = byId(
      headerChips(
        { ...EMPTY_SESSION.header, sourceReference: 'CRM-1' },
        { ...EMPTY_SESSION.capabilities, submitBlockers: ['SOURCE_REFERENCE_REQUIRED'] },
      ),
    )
    expect(chips.reference.state).toBe('needsAttention')
    expect(chips.reference.value).toBe('CRM-1')
  })
})
