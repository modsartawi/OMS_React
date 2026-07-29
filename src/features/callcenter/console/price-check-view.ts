/**
 * The *about this item* panel's price half (ticket 185, CONTRACT.md §3.4) — one
 * pure module, because everything this surface exists to guarantee is a rule
 * about **which number may appear where**, and a component whose markup happened
 * to be right is one refactor from being wrong.
 *
 * 🚩 **The quote is engine money, and it never becomes the estimate.** The number
 * is a real pricing run at the ORDER's own plant, origin, customer and loyalty,
 * VAT-inclusive, at quantity one — so it renders in a money column with `SAR`
 * exactly like a basket line, and `unitPrice.gross` **equals** that line's for the
 * same item under the same header (§3.4 rule 1). Meanwhile `ItemSearchRow`'s
 * `estimatePriceExVat` reads ~13% under what the caller pays.
 *
 * A price check is READ OUT LOUD, with no basket line beside it to correct it
 * seconds later. So a pricing failure is a **typed refusal** and never a fall back
 * to the estimate — and that is structural here rather than remembered: this
 * module is handed the row (estimate and all) and none of its four states has a
 * field the estimate could be written into.
 *
 * 🚩 **The estimate does not move, either.** 168's spatial rule is untouched: the
 * `≈` stays on the row's meta line beside the item number, engine truth appears
 * only in the expanded panel, and the two coexist on one screen without ever
 * swapping places — so no row changes shape mid-list.
 *
 * 🚩 **The offers half holds no figure formatted as money at all.** It is the same
 * promise language as the guidance strip — the discount *definition*, `progress`,
 * `isReady` — so it is literally `guidance-view.ts`'s projection rather than a
 * second one that could drift. The region can guarantee the rule absolutely
 * because it holds no engine money; the *narrow* form of the rule (no figure the
 * console AUTHORED) is the one that survives server text nobody may edit.
 */
import { apiErrorCode } from '@/core/api'
import type { LineCondition, NearMiss, PriceCheckResult } from '@/core/models/callcenter'
import { guidanceView, type GuidanceCard, type GuidancePhrase } from './guidance-view'
import type { SearchRowView } from './item-search'

/** §3.4's five refusals, and no others — the read mints no new code. Listed
 *  because an unknown one is a minor-version addition that must degrade to a
 *  sentence rather than leak a code onto a screen the agent reads from. */
const REFUSALS = [
  'ITEM_NOT_FOUND',
  'ITEM_NOT_SELLABLE',
  'NO_PRICE_AT_PLANT',
  'NO_CUSTOMER_ATTACHED',
  'STORE_NOT_CHOSEN',
]

/**
 * What an item costs, as the panel draws it. Every figure is a field of the
 * server's answer; none is derived from another, and there is no quantity control
 * because there is no quantity — *"how much is X"* is a unit question (§3.4
 * rule 4).
 */
export interface PriceQuote {
  /**
   * 🚩 The item's NAME is deliberately not here. The row this panel expands from
   * is one line above it, carrying the English name, the Arabic name and the item
   * number already — repeating them would be the panel re-stating what the agent
   * is looking at, and a second copy that could disagree with the first.
   */
  uom: string
  /** WHERE it was priced. 🚩 Part of the answer, not decoration: a price with no
   *  store beside it is exactly the seeded-plant harm §3.4 rule 5 closes. */
  plantName: string
  /** ENGINE money, VAT included, one unit — `unitPrice.gross`, verbatim. It is
   *  the field that must equal the basket line's, so it is read and never
   *  computed. */
  gross: number
  /** The store price and VAT as SEPARATE things, exactly as a basket line carries
   *  them (§2.1) — and that separation is precisely what explains the gap to the
   *  `≈` estimate on the row above. */
  conditions: LineCondition[]
}

/**
 * The panel's four states, closed.
 *
 * 🚩 Three of them have **no money field at all**, which is the guarantee: a
 * refusal, a read in flight and a shut gate cannot show a price, because there is
 * nowhere for one to be put — not because a branch remembered not to.
 */
export type PriceCheckPanel =
  /** `capabilities.canPriceCheck` is not true — the row does not expand at all. */
  | { kind: 'shut' }
  | { kind: 'pending'; itemNumber: string }
  | { kind: 'refused'; itemNumber: string; refusal: GuidancePhrase }
  | {
      kind: 'quoted'
      itemNumber: string
      quote: PriceQuote
      /** The guidance strip's own cards — one vocabulary, learned once (US33). */
      offers: GuidanceCard[]
      /** 🚩 130's blindness, made visible: `false` prints *offers were not fully
       *  checked*, so silence never reads as *no offer exists*. It flips to
       *  `true` with no client change. */
      offersComplete: boolean
    }

export interface PriceCheckAsk {
  /**
   * The server's gate (§3.4 rule 5) — `canAddItem`'s predicate: a caller attached
   * AND a store somebody chose. Read **strictly**: absent on a pre-1.6 server, and
   * a panel is not worth quoting from a store nobody picked.
   */
  canPriceCheck: boolean | undefined
  /**
   * The row the panel expands from.
   *
   * 🚩 It is taken WHOLE — `≈` estimate included — deliberately. This module is
   * the only place a fall-back to that number could be written, and handing it the
   * estimate is what makes its absence a property of the model rather than a
   * promise about a component. Only `itemNumber` is read off it.
   */
  row: SearchRowView
  result?: PriceCheckResult | null
  /** The thrown `ApiError`, where the read refused. */
  error?: unknown
  pending?: boolean
}

export function priceCheckPanel({
  canPriceCheck,
  row,
  result,
  error,
  pending,
}: PriceCheckAsk): PriceCheckPanel {
  if (canPriceCheck !== true) return { kind: 'shut' }
  const itemNumber = row.itemNumber
  // 🚩 The refusal is read BEFORE the result. A stale success beside a fresh
  // failure must read as the failure: the number the agent is about to say out
  // loud is the one thing on this console with no second chance.
  if (error) return { kind: 'refused', itemNumber, refusal: refusalOf(error) }
  if (pending || !result) return { kind: 'pending', itemNumber }
  return {
    kind: 'quoted',
    itemNumber,
    quote: {
      uom: result.uom ?? '',
      plantName: result.plantName ?? '',
      gross: result.unitPrice.gross,
      conditions: result.conditions ?? [],
    },
    offers: offerCards(result),
    offersComplete: result.offersComplete === true,
  }
}

/**
 * The offers, through the guidance strip's own projection — one vocabulary, and
 * one implementation of it.
 *
 * 🚩 A price-check offer is a near-miss **with no prerequisite**: a one-item
 * pricing run has no basket to name one against. That absence is what makes the
 * reuse safe rather than merely convenient — 159's coupon-SKU hazard is a
 * property of the *add* a `kind: 'coupon'` prerequisite would offer, and this
 * panel offers no add at all. So the cards arrive with `set` and `reason`
 * resolved exactly as the strip resolves them, and nothing here re-words anything.
 */
function offerCards(result: PriceCheckResult): GuidanceCard[] {
  const asNearMisses: NearMiss[] = (result.offers ?? []).map((offer) => ({
    offerId: offer.offerId,
    description: offer.description,
    isReady: offer.isReady,
    progress: offer.progress,
    prereq: null,
    skipReason: offer.skipReason,
    discount: offer.discount,
  }))
  // Only `cards` is taken: the strip's `getSideCovered` is derived from a
  // prerequisite kind this read never carries, and the panel has the server's own
  // `offersComplete` for the same question — asked properly.
  return guidanceView(asNearMisses).cards
}

/**
 * Why the price could not be given, **in the agent's words** — §3.4's five codes,
 * each with its own sentence. 🚩 The wire code never reaches the screen, and a
 * code this client has never seen still resolves to a sentence rather than to
 * silence or to a machine string: a new refusal is a minor bump that ships
 * server-first (§9).
 */
function refusalOf(error: unknown): GuidancePhrase {
  const code = apiErrorCode(error)
  const known = typeof code === 'string' && REFUSALS.includes(code)
  return { key: known ? `callcenter:panel.refused.${code}` : 'callcenter:panel.refused.fallback', params: {} }
}
