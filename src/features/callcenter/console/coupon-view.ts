/**
 * The coupon, derived once — what the order holds, and what the agent may do
 * about it. Contract v1.10 ([159](.issues/159-coupon-and-loyalty-signup-drawn.md)).
 *
 * 🚩 **The projection deliberately hides the coupon, and nothing replaced it.**
 * `AddCouponAsync` scans the campaign SKU as a `COUP` line, and the server drops
 * every `COUP` line from `lines[]` — correctly, since its money is already
 * flattened onto the product line and two lines for one discount is worse. But
 * that left `applyCoupon` as the only verb on the contract with no field to show
 * its result: the totals moved and nothing said why. `header.coupons` is that
 * field, and this module is the only place the console reads it.
 *
 * The console's own rule about coupons is that it has none. Every predicate here
 * is a `capabilities` answer; nothing derives *may I* from the array's own
 * contents, because the server's redeem gate, its duplicate check and its
 * reversal gate are three rules a client copy would eventually disagree with.
 */
import type { AppliedCoupon, SessionCapabilities, SessionHeader } from '@/core/models/callcenter'

/**
 * The order's coupons, normalised.
 *
 * Absent means a pre-v1.10 server, and §9's rule is that the client renders what
 * it does not know as *nothing here*, never as an error — so a console talking
 * to an older server simply draws an empty coupon chip. That is not a lie: such
 * a server cannot tell it otherwise, and the chip is still the way to apply one.
 */
export function appliedCoupons(header: SessionHeader): AppliedCoupon[] {
  return header.coupons ?? []
}

/**
 * The chip's value — the codes themselves, or `null` for a chip that draws its
 * own *none* wording.
 *
 * 🚩 **The code, never the money.** The owner ruled the coupon a chip rather
 * than a receipt row, and the chip row has never carried an amount: 135 reserved
 * the money column for engine money and 138 kept the guidance region free of any
 * figure formatted as money. The coupon's amount is engine money and it is real
 * — so it draws inside the chip's modal, where there is room to label it, and
 * the receipt goes on reporting the engine's totals exactly as before, with no
 * coupon line of its own.
 *
 * Two codes join rather than collapsing to a count: the engine holds a list and
 * the server's duplicate check is per-code, so a second, different coupon is
 * accepted today. The row already wraps.
 */
export function couponChipValue(header: SessionHeader): string | null {
  const codes = appliedCoupons(header).map((coupon) => coupon.code)
  return codes.length > 0 ? codes.join(' · ') : null
}

/**
 * What the modal is: a way in, a way out, or a statement.
 *
 * `canApplyCoupon` carries the sharp rule — it is `canAddItem`'s predicate,
 * because the redemption is stamped with the ORDER'S PLANT in the coupon
 * service's ledger and a later rebind does not move it. Redeeming against a
 * store 175 has labelled *unchosen* burns a real coupon against a store the
 * order will not ship from.
 */
export interface CouponSurface {
  coupons: AppliedCoupon[]
  /** The entry box is drawn at all. False ⇒ the modal states why and offers
   *  nothing — 153's rule, a control the door would refuse is worse than none. */
  canApply: boolean
  /** Why not, as the server's own typed code. Null ⇒ the console's general
   *  phrase; never silence. */
  applyReason: string | null
  /** A remove control appears beside each applied coupon. */
  canRemove: boolean
}

/**
 * Which sentence a refused REMOVAL gets, and whether it OUTRANKS the server's
 * own — the one wording rule on this surface the console owns rather than
 * passing the envelope through.
 *
 * 🚩 **Only `COUPON_REVERSAL_REFUSED` may say *nothing changed*.** The server
 * reverses the burn at the coupon service before it voids the line (issue 211's
 * till invariant), so that code — and only that code — guarantees the order is
 * byte-identical with the coupon still on it. Its envelope message is true but
 * short (*"the coupon service would not release that code"*), and an agent
 * reading only that would reasonably tell the caller the discount had gone. So
 * this is the one refusal whose sentence the console replaces rather than
 * relays, and the replacement also names the only escape there is: abandon.
 *
 * 🚩 **And every other failure must promise nothing.** A lost response or a
 * transport fault may well have landed the void — *nothing changed* there would
 * be the console asserting the one fact it cannot see. Those keep the envelope's
 * own words (§7) and fall back to a phrase that claims no outcome.
 *
 * It takes the CODE rather than the error so the rule stays pure, and `ApiError`
 * stays out of a module that decides only what the agent sees.
 */
export function couponRemoveFailure(code: string | null): {
  /** The i18n key, namespaced for the console's own bundle. */
  key: string
  /** True ⇒ draw this INSTEAD of the server's message, not merely under it. */
  overridesServer: boolean
} {
  return code === 'COUPON_REVERSAL_REFUSED'
    ? { key: 'coupon.refusedReversal', overridesServer: true }
    : { key: 'coupon.removeFailed', overridesServer: false }
}

export function couponSurface(
  header: SessionHeader,
  capabilities: SessionCapabilities,
): CouponSurface {
  const coupons = appliedCoupons(header)
  // Absent means a server older than the field. §9: the client does not assume
  // the worst about what it cannot see — the door refuses in words if it must.
  const canApply = capabilities.canApplyCoupon !== false
  return {
    coupons,
    canApply,
    applyReason: canApply ? null : (capabilities.capabilityReasons?.canApplyCoupon ?? null),
    // 🚩 `canRemoveCoupon` is NOT re-derived from `coupons.length` even though
    // the server derives it partly that way. Removal reverses a burn at the
    // coupon service before it touches the order, and whether that leg is
    // available is the server's to answer — a client that offered the control
    // whenever the array was non-empty would be guessing about a remote hop.
    canRemove: capabilities.canRemoveCoupon === true,
  }
}
