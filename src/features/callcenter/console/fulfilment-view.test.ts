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
import type { SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
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
})

describe('theWordFollowsTheModeAndTheValueFollowsOms', () => {
  it('🚩 words the SAME wire value two ways', () => {
    expect(paymentWordKey(header({ paymentType: 'CashOnDelivery' }))).toBe('cashOnDelivery')
    expect(paymentWordKey(header({ paymentType: 'CashOnDelivery', deliveryType: 'PickInStore' }))).toBe(
      'payOnCollection',
    )
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

  it('draws nothing rather than a wrong word for a value it cannot say', () => {
    expect(paymentWordKey(header({ paymentType: 'Something' as never }))).toBeNull()
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
