/* PROTOTYPE — throwaway. Wayfinder ticket 159 (map 126).
 *
 * ⚠ **Every v1.10 field below is a STUB, and this is the whole file's health
 * warning.** 177's rule is that a hand-authored fixture is a hypothesis about
 * SHAPE *and* about POPULATION, and that only the wire settles either — so
 * unlike 176's prototype, which stood on a real capture of the flip, nothing
 * here can. `header.coupons`, `canApplyCoupon`, `canRemoveCoupon` and the
 * `removeCoupon` verb do not exist on any server: they are what this ticket
 * proposes, and the fixture that will kill or confirm them is BackOffice
 * `CcContractFixtureTests`, exactly as note 15 budgeted.
 *
 * What is NOT invented is the ground under them:
 *
 *   • the BASE state is capture 02 (`02-two-lines-priced.json`) — real lines,
 *     real promotions, real totals;
 *   • the coupon's money is the shape the engine already keeps per line
 *     (`TransactionLine.PromotionCouponDiscount`, negative like every discount);
 *   • the refusals are the server's own codes, already in the taxonomy
 *     (`COUPON_REJECTED`, `COUPON_ALREADY_APPLIED`) plus the one this ticket
 *     mints for the reversal leg;
 *   • the shut-apply reason is 175's `STORE_NOT_CHOSEN`, already on the wire.
 */
import type { AppliedCoupon, SessionState } from '@/core/models/callcenter'
import { ATTACHED_SESSION, EMPTY_SESSION } from '../__fixtures__/payloads'

/**
 * A coupon as the projection would carry it.
 *
 * The description is the campaign's own — the console never words one, which is
 * why the second scenario proves a null description draws the code alone rather
 * than a phrase this file made up.
 */
export const SAVE20: AppliedCoupon = {
  code: 'SAVE20',
  description: '20% off oral care',
  amount: -8.4,
}

const FREEDEL: AppliedCoupon = {
  code: 'FREEDEL',
  description: null,
  amount: -12,
}

const withCoupons = (
  base: SessionState,
  coupons: AppliedCoupon[],
  extra: Partial<SessionState['capabilities']> = {},
): SessionState => ({
  ...base,
  header: { ...base.header, coupons },
  capabilities: {
    ...base.capabilities,
    canApplyCoupon: true,
    // Removability follows the array here because a mock has no remote leg to be
    // honest about — the CONSOLE never derives it (`coupon-view.test.ts` proves
    // that), and this is the fixture standing in for the server that does.
    canRemoveCoupon: coupons.length > 0,
    ...extra,
  },
})

export interface Scenario {
  key: string
  label: string
  proves: string
  /** 177's rule, applied to a ticket where it is true of everything: no state on
   *  this prototype has ever been on a wire. */
  stubbed: boolean
  state: SessionState
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'none',
    label: 'No coupon',
    proves:
      'The resting state. The chip is last in the row, drawn unset, and carries no attention mark — a coupon is the only chip an order need never fill, so its emptiness is not an outstanding field.',
    stubbed: true,
    state: withCoupons(ATTACHED_SESSION, []),
  },
  {
    key: 'applied',
    label: 'One coupon applied',
    proves:
      'The state the whole ticket exists for: before v1.10 the totals moved and NOTHING named the coupon. The chip carries the code and never the money; the amount draws inside the modal.',
    stubbed: true,
    state: withCoupons(ATTACHED_SESSION, [SAVE20]),
  },
  {
    key: 'twoCoupons',
    label: 'Two coupons',
    proves:
      'The engine holds a LIST and the duplicate check is per-code, so a second, different coupon is accepted today. The chip joins the codes rather than collapsing to a count, and the second one has no description — the code alone, never an invented phrase.',
    stubbed: true,
    state: withCoupons(ATTACHED_SESSION, [SAVE20, FREEDEL]),
  },
  {
    key: 'shutNoStore',
    label: 'Apply shut — store not chosen',
    proves:
      '🚩 The rule this ticket found: the redemption is stamped with the ORDER’S PLANT in the coupon service’s ledger, and 129’s rebind does not move it. So `canApplyCoupon` is `canAddItem`’s predicate — the chip still opens (the modal is where the reason is said) and the entry box is absent, not disabled.',
    stubbed: true,
    state: withCoupons(EMPTY_SESSION, [], {
      canApplyCoupon: false,
      capabilityReasons: { canApplyCoupon: 'STORE_NOT_CHOSEN' },
    }),
  },
  {
    key: 'shutHolding',
    label: 'Apply shut, coupon held',
    proves:
      'A shut apply-gate is not a shut chip. The order holds a coupon the agent may have to read out on a call where a new one cannot be applied — so the list stays and only the way in goes.',
    stubbed: true,
    state: withCoupons(ATTACHED_SESSION, [SAVE20], {
      canApplyCoupon: false,
      capabilityReasons: { canApplyCoupon: 'ORDER_CLOSED' },
      canRemoveCoupon: false,
    }),
  },
  {
    key: 'couponGated',
    proves:
      '🚩 The finding the CAPTURE handed over, not the drawing: capture 02’s real near-miss is `T173 COUPON-GATED BBY` with `kind: "material", materialNumber: "COUPT173"` — a coupon SKU — which the guidance strip draws as *add 1 more* with 172’s one-click add behind it. `BonusBuySession.Prepare` filters only `!IsDeleted`, so that add qualifies the same bonus buy a redeemed coupon does and burns nothing. Here it is the proposed `kind: "coupon"`: stated, never offered, answered at the chip.',
    label: 'Offer that needs a coupon',
    stubbed: true,
    state: (() => {
      const base = withCoupons(ATTACHED_SESSION, [])
      return {
        ...base,
        nearMisses: base.nearMisses.map((miss) =>
          /COUPON-GATED/i.test(miss.description)
            ? { ...miss, prereq: { ...(miss.prereq ?? { kind: 'coupon' }), kind: 'coupon' } }
            : miss,
        ),
      }
    })(),
  },
  {
    key: 'signupMiss',
    label: 'Caller not in the base',
    proves:
      'The rail’s not-found state, which 165 deliberately left as a dead end. The enrolment hangs off it as the ordinary next thing — same block, no alarm ground — and the number already typed carries into it.',
    stubbed: true,
    state: withCoupons(EMPTY_SESSION, []),
  },
]

export const DEFAULT_SCENARIO = 'applied'

/**
 * The refusals, in the server's own codes.
 *
 * 🚩 `COUPON_REVERSAL_REFUSED` is the one this ticket mints, and its wording is
 * the point: the reverse is attempted BEFORE the void (issue 211's ordering, which
 * the till already defends), so a refusal means **nothing changed** — the coupon
 * is still on the order and still spent. That is the opposite of what a failed
 * remove normally means, and an agent told "could not remove" would reasonably
 * assume the discount had gone.
 */
export const REFUSALS: Record<string, string> = {
  COUPON_REJECTED: 'This coupon has expired.',
  COUPON_ALREADY_APPLIED: 'That coupon is already on this order.',
  COUPON_UNAVAILABLE: 'The coupon service is not answering. Try again in a moment.',
  COUPON_REVERSAL_REFUSED:
    'The coupon could not be released, so nothing has changed — it is still on this order. To take it off, the whole order has to be started again.',
}
