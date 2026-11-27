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
import type { AppliedCoupon, FiredPromotion, NearMiss, OfferDefinition, SessionLine, SessionState } from '@/core/models/callcenter'
import { lineNumbers } from './basket-view'
import { guidanceView, type GuidanceCard, type GuidancePhrase, type GuidanceView } from './guidance-view'
import { offerBadges, type OfferBadge } from './offer-badges'
import { offerHeadline, type OfferHeadline } from './offer-headline'
import { pitchSay } from './offer-say'
import { offerAdd, offerStrip, type OfferAddQty, type OfferStrip } from './offer-strip'

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
  /**
   * 996 (card D) — the ONE basket line it landed on, with that line's quantity and its own
   * `unitPrice.gross` / `lineTotal.gross`, verbatim. `null` when it landed on none or on several:
   * the arithmetic is drawn for a single line only.
   */
  landed: { line: number; qty: number; unitGross: number; lineGross: number } | null
  /** 996 — the offer gave a free unit (`getQty > 0` on the definition remembered from when it was
   *  a near-miss), so removing one takes the free one away. `false` where nothing was remembered. */
  keepAll: boolean
}

/**
 * The pitch card's facts for one One step away card (996, spec 995 A), keyed by `cardId`.
 * 🚩 No money (D5): a headline, units, badges and a sentence.
 */
export interface OfferPitch {
  headline: OfferHeadline
  /** `null` with no `unitsHave` — the card keeps the old have/need meter. */
  strip: OfferStrip | null
  /** One `addItem` of the missing quantity of the offer's MATERIAL. `null` for a grouping (its
   *  items are chosen: the sheet, 997), with no units, or where the wire named no material.
   *  `itemName` is that item's own name as the basket holds it (`null` when it is not on a line) —
   *  never the offer's description: the add's placeholder line and outcome name the item. */
  add: (OfferAddQty & { itemNumber: string; itemName: string | null; uom: string | null }) | null
  /** A set prerequisite (grouping) with units to go: the agent CHOOSES the items (the sheet, 997). */
  choose: boolean
  badges: OfferBadge[]
  say: GuidancePhrase[]
}

export interface PanelOptions {
  /** The console's clock, for days left (D4). */
  now?: Date
  /** Definitions seen while each offer was a near-miss, by `offerId` (`rememberDefinitions`). */
  remembered?: ReadonlyMap<string, OfferDefinition>
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
  /** 996 — the pitch card's facts, by `cardId`. */
  pitch: Map<string, OfferPitch>
}

export function promotionsPanel(state: SessionState, options: PanelOptions = {}): PromotionsPanel {
  const numbers = lineNumbers(state)
  const now = options.now ?? new Date()
  const remembered = options.remembered ?? new Map<string, OfferDefinition>()
  const misses = state.nearMisses ?? []
  const coupons = state.header.coupons ?? []
  const guidance = guidanceView(state.nearMisses)
  return {
    applied: (state.firedPromotions ?? []).map((fired, index) =>
      appliedCard(fired, index, numbers, coupons, state.lines ?? [], remembered),
    ),
    oneStepAway: guidance.withinReach,
    guidance,
    say: new Map(
      guidance.withinReach.flatMap((card) => {
        const phrase = recommend(card)
        return phrase ? [[card.cardId, phrase] as const] : []
      }),
    ),
    // `guidanceView` keeps the server's order and positions, so a card's index in `cards` is its
    // near-miss's index on the wire.
    pitch: new Map(
      guidance.cards.flatMap((card, index) =>
        guidance.withinReach.includes(card) && misses[index] ? [[card.cardId, pitchOf(misses[index], now, state.lines ?? [])] as const] : [],
      ),
    ),
  }
}

/**
 * The definitions of the offers on this state, added to what was remembered before (996). A fired
 * promotion carries no definition (C4: no other wire change), so card D's *removing one takes the
 * free one away* reads the definition the offer had while it was a near-miss. A blank `offerId`
 * (859) is never remembered: it addresses nothing.
 */
export function rememberDefinitions(
  previous: ReadonlyMap<string, OfferDefinition>,
  nearMisses: NearMiss[] | null | undefined,
): Map<string, OfferDefinition> {
  const next = new Map(previous)
  for (const miss of nearMisses ?? [])
    if (miss.offerId && miss.definition) next.set(miss.offerId, miss.definition)
  return next
}

function pitchOf(miss: NearMiss, now: Date, basket: SessionLine[]): OfferPitch {
  const qty = offerAdd(miss.progress, miss.definition)
  const material = miss.prereq?.kind === 'material' ? (miss.prereq.materialNumber ?? '') : ''
  const add =
    qty && material !== ''
      ? {
          ...qty,
          itemNumber: material,
          itemName: basket.find((line) => line.itemNumber === material)?.description ?? null,
          // The prerequisite's unit, as the what-if's own add names it (4459: `adds[].uom`).
          uom: miss.definition?.buyUom ?? null,
        }
      : null
  const badges = offerBadges(miss.audience, miss.endsOn, now)
  return {
    headline: offerHeadline(miss.definition, miss.description ?? ''),
    strip: offerStrip(miss.progress, miss.definition),
    add,
    choose: add === null && qty !== null && (miss.prereq?.kind === 'grouping' || miss.prereq?.kind === 'condition'),
    badges,
    say: pitchSay({ description: miss.description ?? '', add, badges }),
  }
}

function appliedCard(
  fired: FiredPromotion,
  index: number,
  numbers: Map<string, number>,
  coupons: AppliedCoupon[],
  basket: SessionLine[],
  remembered: ReadonlyMap<string, OfferDefinition>,
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
    landed: landedOn(fired, basket, numbers),
    keepAll: (remembered.get(fired.offerId)?.getQty ?? 0) > 0,
  }
}

/** The one line a promotion landed on, with its own figures, verbatim. */
function landedOn(fired: FiredPromotion, basket: SessionLine[], numbers: Map<string, number>): AppliedCard['landed'] {
  const ids = [...new Set(fired.lineIds ?? [])].filter((lineId) => numbers.has(lineId))
  if (ids.length !== 1) return null
  const line = basket.find((candidate) => candidate.lineId === ids[0])
  const number = numbers.get(ids[0])
  if (!line || number === undefined) return null
  return { line: number, qty: line.qty, unitGross: line.unitPrice.gross, lineGross: line.lineTotal.gross }
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
