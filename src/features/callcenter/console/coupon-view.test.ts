import { describe, expect, it } from 'vitest'
import type { AppliedCoupon, SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import {
  appliedCoupons,
  couponChipValue,
  couponRemoveFailure,
  couponSurface,
} from './coupon-view'
import { ATTACHED_SESSION, EMPTY_SESSION } from './__fixtures__/payloads'

/**
 * 🚩 **The captures now carry v1.10, so the fixture is no longer neutral.** The
 * re-capture for 189 caught `header.coupons`, `canApplyCoupon` and
 * `canRemoveCoupon` off the real handlers — and capture 01's gate is SHUT
 * (`NO_CUSTOMER`), which is the truth about an order with no caller on it. Every
 * case below therefore says which of the three it is varying, and the two that
 * are about a server OLDER than the field strip them rather than assuming the
 * fixture left them unset.
 */
const header = (coupons?: AppliedCoupon[]): SessionHeader => ({
  ...EMPTY_SESSION.header,
  ...(coupons ? { coupons } : {}),
})

const caps = (extra: Partial<SessionCapabilities> = {}): SessionCapabilities => ({
  ...EMPTY_SESSION.capabilities,
  ...extra,
})

/** A pre-v1.10 server: the two coupon capabilities are absent, not false. */
const preV110 = (): SessionCapabilities => {
  const { canApplyCoupon: _apply, canRemoveCoupon: _remove, ...rest } = EMPTY_SESSION.capabilities
  return { ...rest, capabilityReasons: {} }
}

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
    expect(couponSurface(header(), preV110()).canApply).toBe(true)
  })

  it('reads the CAPTURE’S own shut gate — an order with no caller on it', () => {
    // Capture 01, the wire's bytes since the v1.10 re-capture: the opening gate
    // is shut and it names itself. This is the state an agent meets before the
    // caller is attached, and it is the one the console must not dress as a
    // coupon problem.
    const surface = couponSurface(EMPTY_SESSION.header, EMPTY_SESSION.capabilities)
    expect(surface.canApply).toBe(false)
    expect(surface.applyReason).toBe('NO_CUSTOMER')
    expect(surface.coupons).toEqual([])
    expect(surface.canRemove).toBe(false)
  })

  it('reads the CAPTURE’S own applied coupon, removal and all', () => {
    // 🚩 Capture 02 now carries a real redeemed coupon — the state that did not
    // exist before v1.10, where the totals moved and nothing named it. Its
    // `description` is the campaign's own word (`"Coupon"`), not a phrase the
    // console invented, and its amount is negative engine money.
    const surface = couponSurface(ATTACHED_SESSION.header, ATTACHED_SESSION.capabilities)
    expect(surface.coupons.map((c) => c.code)).toEqual(['HD20AA1335717'])
    expect(surface.coupons[0].amount).toBeLessThan(0)
    expect(surface.canApply).toBe(true)
    expect(surface.canRemove).toBe(true)
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
    // A gate shut with no reason beside it — the server may add a code the
    // console has never heard of, and both degrade to the same general phrase.
    const surface = couponSurface(header(), caps({ canApplyCoupon: false, capabilityReasons: {} }))
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

describe('couponRemoveFailure', () => {
  it('gives the reversal refusal the console’s OWN sentence, outranking the server’s', () => {
    // 🚩 The reverse runs before the void, so this code — and only this code —
    // guarantees the order is untouched and the coupon is still on it. The
    // envelope's own phrase is true but short ("would not release that code"),
    // and an agent reading only that would tell the caller the discount had
    // gone. So the console replaces it rather than relaying it.
    const failure = couponRemoveFailure('COUPON_REVERSAL_REFUSED')
    expect(failure.key).toBe('coupon.refusedReversal')
    expect(failure.overridesServer).toBe(true)
  })

  it('promises NOTHING about any other failure, and never outranks the server', () => {
    // 🚩 The half a *nothing changed* fallback would get wrong: a lost response
    // or a transport fault may well have landed the void. Saying the coupon is
    // still there would be the console asserting the one fact it cannot see —
    // and it would be doing it in the wording reserved for the one code that
    // does guarantee it.
    for (const code of ['SESSION_BUSY', 'SESSION_CLOSED', 'COUPON_UNAVAILABLE', null]) {
      const failure = couponRemoveFailure(code)
      expect(failure.key).toBe('coupon.removeFailed')
      expect(failure.overridesServer).toBe(false)
    }
  })
})
