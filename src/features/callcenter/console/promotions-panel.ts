/**
 * The promotions panel's view model (spec 983 D7, ticket 987) — what fired, what is one step
 * away, and what the agent can say about each.
 *
 * - **Applied** reads `firedPromotions`: the server's description and amount, and the lines it
 *   landed on named by D4's numbers (`lineNumbers` in `basket-view.ts`).
 * - **One step away** is the guidance strip's within-reach list, unchanged: `guidanceView`'s
 *   `withinReach`, so 412's ranking (every get-side shortfall above every actionable offer, the
 *   server's order within each) and its card wording survive the move by construction.
 * - **Could still use** is not modelled. D7 lets it read only what `CouponPicker` already reads,
 *   and that is `header.coupons`, the coupons already APPLIED. Nothing on the wire lists coupons
 *   the caller holds and has not used, so the column is absent and no read is invented.
 *
 * 🚩 **No figure is computed here.** An applied card's `amount` is the `FiredPromotion`'s own,
 * passed through verbatim; nothing is summed, subtracted or divided. Line numbers are positions,
 * not figures. Every phrase is a key plus params, filled from server facts.
 */
import type { AppliedCoupon, FiredPromotion, SessionState } from '@/core/models/callcenter'
import { lineNumbers } from './basket-view'
import { guidanceView, type GuidanceCard, type GuidancePhrase, type GuidanceView } from './guidance-view'

/** One fired promotion, as the Applied column draws it. */
export interface AppliedCard {
  /** React identity on this projection: the `offerId`, or the position where it is blank (859). */
  cardId: string
  offerId: string
  /** The server's own words, passed through as data. */
  description: string
  /** The engine's money for this promotion, verbatim (negative, like every discount). */
  amount: number
  /** D4's numbers for `lineIds`, ascending. A lineId the basket does not hold is dropped. */
  lines: number[]
  /** The applied coupon this promotion is, when one names it; `null` for an automatic one. */
  coupon: string | null
  /**
   * The basket lines a coupon's promotion did NOT land on (the walk's medicine line). Empty for
   * an automatic promotion: a bonus buy on two items is not "skipping" the rest of the basket.
   * 🚩 No reason rides with it: neither `FiredPromotion` nor any near-miss carries one per line.
   */
  notOn: number[]
}

export interface PromotionsPanel {
  applied: AppliedCard[]
  /** `guidanceView(...).withinReach`, untouched — 412's order. */
  oneStepAway: GuidanceCard[]
  /** The whole guidance view, for what still draws under One step away (counted, needs a
   *  coupon, not available here, the get-side note) and the top bar's count. */
  guidance: GuidanceView
  /** The sentence to recommend each One step away card, keyed by `cardId`. */
  say: Map<string, GuidancePhrase>
}

export function promotionsPanel(state: SessionState): PromotionsPanel {
  const numbers = lineNumbers(state)
  const coupons = state.header.coupons ?? []
  const guidance = guidanceView(state.nearMisses)
  return {
    applied: (state.firedPromotions ?? []).map((fired, index) => appliedCard(fired, index, numbers, coupons)),
    oneStepAway: guidance.withinReach,
    guidance,
    say: new Map(
      guidance.withinReach.flatMap((card) => {
        const phrase = recommend(card)
        return phrase ? [[card.cardId, phrase] as const] : []
      }),
    ),
  }
}

function appliedCard(
  fired: FiredPromotion,
  index: number,
  numbers: Map<string, number>,
  coupons: AppliedCoupon[],
): AppliedCard {
  const lines = [
    ...new Set(
      (fired.lineIds ?? []).flatMap((lineId) => {
        const number = numbers.get(lineId)
        return number === undefined ? [] : [number]
      }),
    ),
  ].sort((a, b) => a - b)
  const coupon = couponFor(fired, coupons)
  return {
    cardId: fired.offerId ? `${fired.offerId}#${index}` : `#${index}`,
    offerId: fired.offerId,
    description: fired.description ?? '',
    amount: fired.amount,
    lines,
    coupon,
    notOn: coupon === null ? [] : [...numbers.values()].filter((number) => !lines.includes(number)),
  }
}

/**
 * Which applied coupon a fired promotion is. The wire carries no attribution on
 * `FiredPromotion` (contract §2.7: the coupon's discount reaches the client as an ordinary
 * `AppliedBonusBuy`), so the one honest join is the campaign's own words: a coupon whose
 * non-blank `description` is exactly the promotion's. A coupon with none is matched to nothing.
 */
function couponFor(fired: FiredPromotion, coupons: AppliedCoupon[]): string | null {
  const description = (fired.description ?? '').trim()
  if (description === '') return null
  return coupons.find((coupon) => (coupon.description ?? '').trim() === description)?.code ?? null
}

/** What the agent says to recommend a card, or `null` where there is nothing to say. */
function recommend(card: GuidanceCard): GuidancePhrase | null {
  if (card.klass === 'shortfall') return { key: 'callcenter:promotions.say.reward', params: { offer: card.description } }
  if (card.klass === 'actionable' && card.stillNeeded > 0)
    return { key: 'callcenter:promotions.say.add', params: { count: card.stillNeeded, offer: card.description } }
  return null
}
