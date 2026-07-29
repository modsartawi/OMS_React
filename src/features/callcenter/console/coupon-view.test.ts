import { describe, expect, it } from 'vitest'
import type { AppliedCoupon, SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import { appliedCoupons, couponChipValue, couponSurface } from './coupon-view'
import { EMPTY_SESSION } from './__fixtures__/payloads'

const header = (coupons?: AppliedCoupon[]): SessionHeader => ({
  ...EMPTY_SESSION.header,
  ...(coupons ? { coupons } : {}),
})

const caps = (extra: Partial<SessionCapabilities> = {}): SessionCapabilities => ({
  ...EMPTY_SESSION.capabilities,
  ...extra,
})

const SAVE20: AppliedCoupon = { code: 'SAVE20', description: '20% off oral care', amount: -8.4 }
const FREEDEL: AppliedCoupon = { code: 'FREEDEL', description: null, amount: -12 }

describe('appliedCoupons', () => {
  it('reads an absent field as an order with no coupon, never as an error', () => {
    // §9 — a pre-v1.10 server cannot say otherwise, and the console's rule is to
    // render what it does not know as *nothing here*. The chip is still the way
    // to apply one, so nothing is lost by degrading quietly.
    expect(appliedCoupons(header())).toEqual([])
  })
})

describe('couponChipValue', () => {
  it('is null with no coupon, so the chip draws its own not-set wording', () => {
    expect(couponChipValue(header())).toBeNull()
  })

  it('is the CODE, never the amount', () => {
    // 🚩 The chip row has never carried money — 135 reserved the money register
    // and 138 kept the guidance region free of any figure formatted as money.
    // The coupon's amount is real engine money and it draws in the modal.
    const value = couponChipValue(header([SAVE20]))
    expect(value).toBe('SAVE20')
    expect(value).not.toContain('8.4')
  })

  it('joins a second, DIFFERENT code rather than collapsing to a count', () => {
    // The engine holds a list and the server's duplicate check is per-code, so a
    // second coupon is accepted today. A count would have been the console
    // asserting a one-coupon rule the server does not enforce.
    expect(couponChipValue(header([SAVE20, FREEDEL]))).toBe('SAVE20 · FREEDEL')
  })
})

describe('couponSurface', () => {
  it('opens the entry box on a server that has never heard of the capability', () => {
    expect(couponSurface(header(), caps()).canApply).toBe(true)
  })

  it('shuts the entry box with the SERVER’S reason when the gate is closed', () => {
    // The live phase-1 rule: `canApplyCoupon` is `canAddItem`'s predicate,
    // because the redemption is stamped with the order's plant in the coupon
    // service's ledger and a rebind does not move it.
    const surface = couponSurface(
      header(),
      caps({
        canApplyCoupon: false,
        capabilityReasons: { canApplyCoupon: 'STORE_NOT_CHOSEN' },
      }),
    )
    expect(surface.canApply).toBe(false)
    expect(surface.applyReason).toBe('STORE_NOT_CHOSEN')
  })

  it('still lists what the order holds while the entry box is shut', () => {
    // 🚩 A shut apply-gate is not a shut chip. An order can hold a coupon the
    // agent has to read out on a call where a new one may not be applied.
    const surface = couponSurface(header([SAVE20]), caps({ canApplyCoupon: false }))
    expect(surface.canApply).toBe(false)
    expect(surface.coupons).toHaveLength(1)
  })

  it('falls back to no reason rather than to silence', () => {
    const surface = couponSurface(header(), caps({ canApplyCoupon: false }))
    expect(surface.applyReason).toBeNull()
  })

  it('does NOT derive removability from the array being non-empty', () => {
    // 🚩 The removal reverses a burn at the coupon service BEFORE it touches the
    // order (issue 211's ordering). Whether that remote leg is available is the
    // server's answer; a client offering the control whenever it held a coupon
    // would be guessing about a hop it cannot see.
    const surface = couponSurface(header([SAVE20]), caps())
    expect(surface.coupons).toHaveLength(1)
    expect(surface.canRemove).toBe(false)

    expect(couponSurface(header([SAVE20]), caps({ canRemoveCoupon: true })).canRemove).toBe(true)
  })
})
