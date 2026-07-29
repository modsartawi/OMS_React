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
    // 176: the mode leads the row. 159: the coupon closes it — the only chip an
    // order need never fill, which is why it sits past the ones that must be.
    // Neither enumerated chip can be marked by a blocker (the mode has none;
    // payment carries none by ruling) and neither can the coupon.
    expect(chips.map((c) => c.id)).toEqual([
      'fulfilment',
      'store',
      'slot',
      'source',
      'reference',
      'payment',
      'coupon',
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
    expect(ids).toEqual(['fulfilment', 'store', 'source', 'reference', 'payment', 'coupon'])
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
    expect(ids).toEqual(['fulfilment', 'store', 'slot', 'source', 'reference', 'coupon'])
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
