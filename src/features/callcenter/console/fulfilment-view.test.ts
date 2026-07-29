/**
 * The fulfilment axis's five consequences (ticket 176).
 *
 * 🚩 Every case here is about a **rendering**, never about a rule: the server
 * clears the address, drops `MISSING_SLOT` and zeroes the fee on its own, and
 * capture 09 proves it does. What these cases hold is the half the wire cannot
 * carry — that a zero fee is drawn as *nothing*, that a `CashOnDelivery` on a
 * collection order is worded for the caller who will never see a driver, and
 * that neither of those is inferred from a figure the console happens to hold.
 */
import { describe, expect, it } from 'vitest'
import type {
  DeliveryType,
  PaymentType,
  SessionCapabilities,
  SessionHeader,
} from '@/core/models/callcenter'
import capture11 from '../../../../.issues/assets/136-cc-contract/11-payment-type.json'
import type { DeliveryFeeView } from './basket-view'
import {
  capabilityGate,
  feeLine,
  isPickup,
  paymentWordKey,
  railBlock,
  showsDeliveryRegion,
} from './fulfilment-view'

const header = (over: Partial<SessionHeader> = {}) => ({ ...over }) as SessionHeader
const caps = (over: Partial<SessionCapabilities> = {}) =>
  ({ submitBlockers: [], ...over }) as SessionCapabilities
const fee = (over: Partial<DeliveryFeeView> = {}): DeliveryFeeView => ({
  waived: false,
  waivedReason: null,
  amount: 12,
  thresholdGross: 100,
  ...over,
})

describe('theModeIsOneFieldAndFiveThingsOnScreen', () => {
  it('🚩 reads an ABSENT deliveryType as delivery', () => {
    // §2.2 — a v1.0 server does not send the field, and a console that treated
    // its absence as "unknown" would draw the collection layout on every order a
    // pre-1.1 server answers.
    expect(isPickup(header())).toBe(false)
    expect(isPickup(header({ deliveryType: 'Delivery' }))).toBe(false)
    expect(isPickup(header({ deliveryType: 'PickInStore' }))).toBe(true)
  })

  it('gives the two modes the same place in the rail, never one place and a hole', () => {
    expect(railBlock(header({ deliveryType: 'Delivery' }))).toBe('address')
    expect(railBlock(header({ deliveryType: 'PickInStore' }))).toBe('collection')
  })

  it('🚩 draws NO delivery region under collection — absent, not zero', () => {
    // 156's ruling against capture 09's own pickup state: `amount: 0,
    // waived: false, thresholdGross: 100`. Drawn literally that is
    // `Delivery SAR 0.00` plus "free over SAR 100" — a delivery promise on an
    // order nobody is delivering.
    expect(showsDeliveryRegion(header({ deliveryType: 'PickInStore' }))).toBe(false)
    expect(showsDeliveryRegion(header({ deliveryType: 'Delivery' }))).toBe(true)
  })
})

describe('theFeeSaysWhatHappenedToIt', () => {
  it('quotes the fee and the threshold while it stands', () => {
    expect(feeLine(fee())).toEqual({ kind: 'amount', amount: 12, thresholdGross: 100 })
  })

  it('🚩 carries the server’s own branch when it fell away', () => {
    expect(feeLine(fee({ waived: true, waivedReason: 'PromotionalWindow' }))).toEqual({
      kind: 'waived',
      reason: 'PromotionalWindow',
    })
  })

  it('🚩 never invents a reason the server did not send', () => {
    // A pre-1.5 server. The bare word is v1.4's behaviour and is honest; a
    // comparison of gross against thresholdGross would be the client
    // recomputing a server rule, and would say "because you're over 100" during
    // a campaign that is the real cause.
    expect(feeLine(fee({ waived: true, waivedReason: null }))).toEqual({ kind: 'waivedNoReason' })
  })

  it('🚩 degrades a category it has no words for to the SAME bare word', () => {
    // §9 — a v1.6 server adding a fourth branch must not reach the agent as a
    // key, a blank sentence, or a neighbouring reason. The set of categories
    // this console can SAY lives here rather than in the receipt's `t()` call,
    // so the degrade is provable without rendering anything.
    expect(feeLine(fee({ waived: true, waivedReason: 'SomethingNewer' }))).toEqual({
      kind: 'waivedNoReason',
    })
  })

  it('🚩 cannot be told the reason by the numbers — only by the server', () => {
    // The guard against re-deriving 156's rule here. Both fees below are waived
    // with the basket nowhere near the threshold the server still quotes; only
    // the branch the server NAMED separates them. A console that compared a
    // total against `thresholdGross` would call the campaign a threshold — the
    // sentence the agent then reads to the caller is false.
    const campaign = feeLine(fee({ waived: true, waivedReason: 'PromotionalWindow', thresholdGross: 100 }))
    const override = feeLine(fee({ waived: true, waivedReason: 'ConfiguredOverride', thresholdGross: 100 }))
    expect(campaign).toEqual({ kind: 'waived', reason: 'PromotionalWindow' })
    expect(override).toEqual({ kind: 'waived', reason: 'ConfiguredOverride' })
    // And the threshold does not survive into the waived arm at all: there is
    // no number here for a later edit to compare anything against.
    expect(campaign).not.toHaveProperty('thresholdGross')
  })
})

describe('theWordFollowsTheModeAndTheValueFollowsOms', () => {
  it('🚩 words the SAME wire value two ways', () => {
    expect(paymentWordKey(header({ paymentType: 'CashOnDelivery' }))).toBe('cashOnDelivery')
    expect(paymentWordKey(header({ paymentType: 'CashOnDelivery', deliveryType: 'PickInStore' }))).toBe(
      'payOnCollection',
    )
  })

  it('🚩 words the mode WITHOUT touching the value the wire carries', () => {
    // §2.4 — the console says *Pay on collection* and OMS still receives
    // `CashOnDelivery` / `"C"`. The module is asked for a word and hands back a
    // key; the header it was given is the header it leaves behind, so there is
    // no path by which a wording decision could reach the value.
    const collecting = header({ paymentType: 'CashOnDelivery', deliveryType: 'PickInStore' })
    expect(paymentWordKey(collecting)).toBe('payOnCollection')
    expect(collecting.paymentType).toBe('CashOnDelivery')
    expect(collecting.deliveryType).toBe('PickInStore')
  })

  it('leaves online alone — it means the same thing under either mode', () => {
    expect(paymentWordKey(header({ paymentType: 'Online' }))).toBe('paidOnline')
    expect(paymentWordKey(header({ paymentType: 'Online', deliveryType: 'PickInStore' }))).toBe('paidOnline')
  })

  it('defaults an absent paymentType to the value the order actually carries', () => {
    // §2.4 — the column defaults to `"C"`, so a pre-1.4 server's silence means
    // cash, not "unknown".
    expect(paymentWordKey(header())).toBe('cashOnDelivery')
  })

  it('🚩 draws nothing rather than a wrong word for a value it cannot say', () => {
    // US22 / 182's ninth consequence. `Receivable` is the case that matters: §2.4
    // RESERVES it, no phase-1 path produces or accepts it, and the business has
    // never asked for it — so a chip reading *On account* would be this console
    // selling a payment arrangement nobody agreed to. Silence is the only honest
    // rendering, and the chip leaves the row rather than standing there empty.
    expect(paymentWordKey(header({ paymentType: 'Receivable' }))).toBeNull()
    expect(paymentWordKey(header({ paymentType: 'Receivable', deliveryType: 'PickInStore' }))).toBeNull()
    // And any other future value degrades identically — never a throw (§9).
    expect(paymentWordKey(header({ paymentType: 'Something' as never }))).toBeNull()
  })

  it('words all four legal combinations off the capture that round-trips them', () => {
    // 🚩 The wire's own four, from capture 11 — the axes are independent (§2.4)
    // and the console must word every combination the server accepts. Read from
    // the capture rather than listed here, so a combination the server stops
    // round-tripping stops being asserted.
    const combinations = (
      capture11 as { combinations: Record<string, { deliveryType: DeliveryType; paymentType: PaymentType }> }
    ).combinations
    expect(Object.keys(combinations)).toHaveLength(4)
    const worded = Object.fromEntries(
      Object.entries(combinations).map(([key, h]) => [key, paymentWordKey(header(h))]),
    )
    expect(worded).toEqual({
      'Delivery-CashOnDelivery': 'cashOnDelivery',
      'PickInStore-CashOnDelivery': 'payOnCollection',
      'Delivery-Online': 'paidOnline',
      'PickInStore-Online': 'paidOnline',
    })
  })
})

describe('aShutCapabilitySaysWhyItIsShut', () => {
  it('treats an ABSENT capability as open — the door refuses in words anyway', () => {
    expect(capabilityGate(caps(), 'canChangeFulfilment')).toEqual({ open: true })
  })

  it('carries the server’s typed reason when it is shut', () => {
    expect(
      capabilityGate(
        caps({
          canChangeFulfilment: false,
          capabilityReasons: { canChangeFulfilment: 'DELIVERY_ONLY_SOURCE' },
        }),
        'canChangeFulfilment',
      ),
    ).toEqual({ open: false, reason: 'DELIVERY_ONLY_SOURCE' })
  })

  it('asks the SAME question of the payment axis — ⚠ unreachable in phase 1, answered anyway', () => {
    // §2.4: no phase-1 order can force the payment type, so this state is
    // stubbed rather than captured. It is implemented because a capability the
    // client ignores is the failure §2's advisory-but-authoritative rule exists
    // to prevent — the day a forcing rule is configured, the console is right
    // without a change.
    expect(capabilityGate(caps({ canChangePaymentType: true }), 'canChangePaymentType')).toEqual({
      open: true,
    })
    expect(
      capabilityGate(
        caps({
          canChangePaymentType: false,
          capabilityReasons: { canChangePaymentType: 'PAYMENT_TYPE_FORCED' },
        }),
        'canChangePaymentType',
      ),
    ).toEqual({ open: false, reason: 'PAYMENT_TYPE_FORCED' })
  })

  it('🚩 is shut with NO reason where the server sent none', () => {
    // The console still stops offering the control; what it cannot do is
    // manufacture a sentence about why. A vague phrase is the honest fallback —
    // a guessed reason is a wrong one read out to a caller.
    expect(capabilityGate(caps({ canChangeFulfilment: false }), 'canChangeFulfilment')).toEqual({
      open: false,
      reason: null,
    })
  })
})
