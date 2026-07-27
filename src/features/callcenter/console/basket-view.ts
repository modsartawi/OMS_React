/**
 * What the basket and the receipt READ (ticket 170) — one pure module, because
 * the ruling both halves exist to hold is a rule rather than a rendering:
 *
 * 🚩 **The console never sums lines.** `totals` is engine truth (law 1 / §2.1),
 * and a client-side total is how the web starts quoting a different number from
 * the till. So there is no function here that takes lines and answers money:
 * `basketLineView` reads ONE line's own projection, `receiptView` reads
 * `totals`, and the two never meet. A component cannot re-introduce the sum,
 * because there is nothing here to sum with.
 *
 * The second ruling is the line's *why*. A line shows what it costs and the
 * conditions behind that — the store price and VAT as **separate things**,
 * because VAT is a separate 15% condition (§2.1) and is exactly what makes the
 * search row's ex-VAT estimate read ~13% under the line beside it. Folding them
 * would erase the only fact that explains the gap the agent is looking at.
 */
import type {
  FiredPromotion,
  LineCondition,
  SessionLine,
  SessionState,
  SessionTotals,
} from '@/core/models/callcenter'
import { frozenAvailability } from './below-atp'
import type { Availability } from './item-search'

/** One pricing condition, passed through. `isStatistical` is kept rather than
 *  filtered: an informational condition did not move the money, and a console
 *  that drew it like the others would offer the agent a figure to quote. */
export type LineConditionView = LineCondition

/** One promotion that fired on this line. */
export interface LinePromotionView {
  offerId: string
  /** The offer's own words, server-supplied. */
  description: string
  /** 🚩 The OFFER's amount, not this line's share of it. Where it spans lines,
   *  `sharedLines` says so — apportioning it here would be the console computing
   *  money it was not given. */
  amount: number
  /** How many OTHER lines the same promotion fired on. `0` is this line alone. */
  sharedLines: number
}

/** One basket row, as the projection gives it. Every figure is a field of the
 *  server's line; none is derived from another. */
export interface BasketLineView {
  lineId: string
  itemNumber: string
  /** The name the agent reads out. */
  description: string
  qty: number
  uom: string
  /**
   * The units this line can be corrected to, **the current one included** so the
   * control can show what is on the line — and **empty where there is nothing
   * else to pick**. The same rule as the store chip (167): a control with
   * nowhere to go is not a control, so the component draws a word instead.
   */
  uomOptions: string[]
  /** Engine money, VAT included. `lineTotal.gross`, verbatim. */
  total: number
  conditions: LineConditionView[]
  promotions: LinePromotionView[]
  /** Availability as FROZEN at add (§2.1) — never live, and `known:false` is
   *  unknown rather than a zero. */
  availability: Availability
  /** The server's own flag, from the agent's acceptance (169). Never re-derived. */
  belowAtpAtScan: boolean
  warnings: string[]
}

export function basketLineView(line: SessionLine, firedPromotions: FiredPromotion[]): BasketLineView {
  const fired = firedPromotions.filter((promo) => promo.lineIds?.includes(line.lineId))
  const own = (line.promotions ?? []).map((promo) => ({
    offerId: promo.offerId,
    description: promo.description,
    amount: promo.amount,
    sharedLines: sharedLines(fired.find((f) => f.offerId === promo.offerId), line.lineId),
  }))
  // 🚩 A promotion projected only at the order level still fired on this line —
  // it names it. Said once: the same offer on both projections is one promotion,
  // and saying it twice would read as two discounts.
  const alsoFired = fired
    .filter((promo) => !own.some((p) => p.offerId === promo.offerId))
    .map((promo) => ({
      offerId: promo.offerId,
      description: promo.description,
      amount: promo.amount,
      sharedLines: sharedLines(promo, line.lineId),
    }))

  return {
    lineId: line.lineId,
    itemNumber: line.itemNumber,
    description: line.description,
    qty: line.qty,
    uom: line.uom,
    // 🚩 The test is *is there another unit*, not *is the list longer than one*:
    // a list of exactly one unit that is NOT the one on the line is a real
    // correction, and counting entries would silently refuse to offer it.
    uomOptions: uomChoices(line),
    total: line.lineTotal.gross,
    conditions: line.conditions ?? [],
    promotions: [...own, ...alsoFired],
    availability: frozenAvailability(line.atpAtScan),
    belowAtpAtScan: line.belowAtpAtScan === true,
    warnings: line.warnings ?? [],
  }
}

/** The units to offer: the server's list with the line's own unit in it, or
 *  nothing at all where the list holds no alternative. */
function uomChoices(line: SessionLine): string[] {
  const offered = line.uomOptions ?? []
  if (!offered.some((option) => option !== line.uom)) return []
  return offered.includes(line.uom) ? offered : [line.uom, ...offered]
}

const sharedLines = (promo: FiredPromotion | undefined, lineId: string): number =>
  promo ? promo.lineIds.filter((id) => id !== lineId).length : 0

/** The whole basket, in the engine's own order — nothing here re-sorts it. */
export function basketLineViews(state: SessionState): BasketLineView[] {
  return (state.lines ?? []).map((line) => basketLineView(line, state.firedPromotions ?? []))
}

/**
 * The delivery fee as the receipt draws it (§2.1, and 156's correction).
 *
 * 🚩 `waived` is an **outcome the agent is shown, never a control they operate**.
 * The manual waiver was removed, so there is nothing here to switch — only what
 * the engine already decided, quoted live as the basket moves.
 */
export interface DeliveryFeeView {
  waived: boolean
  amount: number
  /** What the basket has to reach for the fee to fall away, where the server
   *  sent one. `null` rather than `0`: a threshold of nought is not a threshold,
   *  and drawing one the server did not state would be a promise. */
  thresholdGross: number | null
}

/** The four figures the caller is told, and only those. */
export interface ReceiptView {
  net: number
  vat: number
  /** `null` where the projection carried no fee block at all (§9). */
  delivery: DeliveryFeeView | null
  payable: number
}

/**
 * 🚩 **Engine truth, read and not computed.** It takes `totals` and nothing else
 * — it is not given the lines, so it could not sum them if a later edit wanted
 * to.
 */
export function receiptView(totals: SessionTotals): ReceiptView {
  const fee = totals.deliveryFee
  return {
    net: totals.net,
    vat: totals.vat,
    delivery: fee
      ? {
          waived: fee.waived === true,
          amount: fee.amount,
          thresholdGross: typeof fee.thresholdGross === 'number' && fee.thresholdGross > 0 ? fee.thresholdGross : null,
        }
      : null,
    payable: totals.payable,
  }
}
