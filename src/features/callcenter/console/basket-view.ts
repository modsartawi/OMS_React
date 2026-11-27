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
  /** 1-based position in the basket (D4). Display only, never sent; `0` on a
   *  line viewed on its own, outside a basket. */
  lineNumber: number
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
  /** `unitPrice.gross`, verbatim — the price column. Display only (CONTRACT §2). */
  unitPrice: number
  /**
   * The discount column: each discount condition (negative, not statistical,
   * not VAT) as the server sent it. 🚩 Listed, never summed — a line with two
   * discounts shows two figures, and the total beside them is the engine's.
   */
  discounts: LineCondition[]
  /** The VAT class on the line's second row (D5) — `null` with no VAT condition. */
  vatRate: number | null
  /** The pricing detail opened under the line. */
  pricing: PricingRow[]
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
    lineNumber: 0,
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
    unitPrice: line.unitPrice.gross,
    discounts: (line.conditions ?? []).filter((c) => !isVat(c) && !c.isStatistical && c.value < 0),
    vatRate: lineVatRate(line),
    pricing: linePricing(line),
  }
}

/** The units to offer: the server's list with the line's own unit in it, or
 *  nothing at all where the list holds no alternative. */
function uomChoices(line: SessionLine): string[] {
  const offered = line.uomOptions ?? []
  if (!offered.some((option) => option !== line.uom)) return []
  return offered.includes(line.uom) ? offered : [line.uom, ...offered]
}

/**
 * The condition type the engine prices VAT with (§2.1: a separate condition).
 * A set, so a second VAT type the engine starts emitting is one entry here.
 */
const VAT_CONDITION_TYPES = new Set(['MWST'])

const isVat = (condition: LineCondition) => VAT_CONDITION_TYPES.has(condition.type)

/**
 * One row of a line's pricing detail (ticket 985), opened under the line. Every
 * `value` is a field the server sent — a condition's own value, `lineTotal.net`,
 * `lineTotal.gross` — and none is arrived at from the others.
 */
export type PricingRow =
  | ({ kind: 'condition' } & LineCondition)
  | { kind: 'net'; value: number }
  /** D5: VAT as **rate and amount**. `rate` is a whole percent, or `null`
   *  where the line gives no way to tell it. */
  | { kind: 'vat'; rate: number | null; value: number }
  | { kind: 'total'; value: number }

/**
 * The pricing detail: basic price, each condition by name (the server's order,
 * VAT held back), net, then VAT as rate and amount, then the line total.
 */
export function linePricing(line: SessionLine): PricingRow[] {
  const conditions = line.conditions ?? []
  return [
    ...conditions.filter((c) => !isVat(c)).map((c) => ({ kind: 'condition' as const, ...c })),
    { kind: 'net', value: line.lineTotal.net },
    ...conditions.filter(isVat).map((c) => ({ kind: 'vat' as const, rate: vatRate(c, line), value: c.value })),
    { kind: 'total', value: line.lineTotal.gross },
  ]
}

/** The line's VAT rate from its VAT condition, or `null` with no VAT condition. */
function lineVatRate(line: SessionLine): number | null {
  const vat = (line.conditions ?? []).find(isVat)
  return vat ? vatRate(vat, line) : null
}

/**
 * The rate of one VAT condition (D5).
 *
 * 🚩 The wire's condition carries **no rate field** (`CallCenterLineCondition`
 * is type · description · value · isStatistical), and the live engine describes
 * MWST as "Vat %" with the AMOUNT beside it — the "Vat % 20.32" D5 fixes. So:
 * 1. the server's own words, where its description states a percent;
 * 2. a zero amount is 0% (a medicine line) — nothing to divide;
 * 3. otherwise the condition's amount over the line's own net, as a **whole
 *    percent**. That is a ratio of two server figures, never an amount: no
 *    figure the agent quotes is computed here. KSA rates are whole (15, 0).
 * 4. `null` where there is no net to read it against.
 * The clean fix is an additive `rate` on the condition — an owner/BackOffice ask.
 */
function vatRate(condition: LineCondition, line: SessionLine): number | null {
  const worded = /(\d+(?:\.\d+)?)\s*%/.exec(condition.description ?? '')
  if (worded) return Number(worded[1])
  if (condition.value === 0) return 0
  const net = line.lineTotal.net
  return net > 0 ? Math.round((condition.value / net) * 100) : null
}

const sharedLines = (promo: FiredPromotion | undefined, lineId: string): number =>
  promo ? promo.lineIds.filter((id) => id !== lineId).length : 0

/** The whole basket, in the engine's own order — nothing here re-sorts it. */
export function basketLineViews(state: SessionState): BasketLineView[] {
  return (state.lines ?? []).map((line, index) => ({
    ...basketLineView(line, state.firedPromotions ?? []),
    lineNumber: index + 1,
  }))
}

/**
 * Each line's number, by `lineId` (spec 983 D4) — so the promotions panel names
 * the lines an offer landed on by the same numbers the basket shows.
 *
 * 🚩 **Display only, and a position, never an id.** It is 1-based in the
 * engine's own order and recomputed from each `SessionState`, so a void
 * renumbers what follows it. It is never sent: the wire names a line by
 * `lineId`, and a number the agent read out a minute ago may name another line now.
 */
export function lineNumbers(state: SessionState): Map<string, number> {
  return new Map((state.lines ?? []).map((line, index) => [line.lineId, index + 1]))
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
  /** v1.5 (§2.5) — the server's own branch, never inferred here by comparing
   *  `gross` against `thresholdGross`. `null` on a pre-1.5 server. */
  waivedReason: string | null
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
          waivedReason: typeof fee.waivedReason === 'string' ? fee.waivedReason : null,
          amount: fee.amount,
          thresholdGross: typeof fee.thresholdGross === 'number' && fee.thresholdGross > 0 ? fee.thresholdGross : null,
        }
      : null,
    payable: totals.payable,
  }
}
