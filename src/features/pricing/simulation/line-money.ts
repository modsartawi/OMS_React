import type { SimulationResultItem } from '@/core/models/simulation'
import { conditionBadge } from './aggregate'

/**
 * The result line's money projection (ticket 115, spec 110 — ruled in 104 against
 * the 098 captures). One pure function turning a wire line into the seven-column
 * line's figures and its one promotion slot.
 *
 * It is pure and hue-free and holds **no `t()`** — a blank column is `null`, not a
 * faint `·`, and the promotion slot is a token, not a translated phrase. The table
 * resolves both. That is what keeps this rule node-testable, and this is the rule
 * worth testing: every failure mode here is a *plausible-looking number*.
 *
 * The three rules, each overturning something the old grid did (104 §1/§4/§5):
 *
 * - **`was`/`saved` blank on an undiscounted line.** On an undiscounted line
 *   `grossValue ≡ netValue`, so the majority of lines in the corpus spent five money
 *   columns on **two** independent numbers. Blank means *nothing happened here*;
 *   `0.00` would mean *we measured, and it was nothing* — a figure to read and
 *   discard on every plain line.
 * - **`saved` is a magnitude.** Every real discount in the corpus is negative, and
 *   a column labelled "saved" must not read `-63.88`. (The old grid also painted it
 *   `text-destructive` — a third hue, spent on good news.)
 * - **A non-ok line prints no money at all.** `04b` #10 `COUP01` returns `0` for
 *   unit price, gross, net, tax and total. Printing those says *priced at zero*; the
 *   truth is *did not price*.
 */

/**
 * The promotion slot's resolution — exactly one of four states, matching 104 §3.
 * `fired` carries `manual` because those two are the only pair that can co-occur
 * (capture 06: a hand-entered `ZB01` alongside the bonus buy, both folded into one
 * `promotionDiscount`). A modelled union rather than a bag of booleans, so
 * "resolves to exactly one state" is a type-level fact and not a test-only hope.
 */
export type PromoSlot =
  /** The line failed to price — 082's `StatusBadge` takes the slot; there is no
   *  status column, and no collision, because such a line never fires a promotion. */
  | { state: 'warned' }
  /** A promotion fired on this line, possibly with a hand-entered condition too. */
  | { state: 'fired'; manual: boolean }
  /** Only a hand-entered condition touched the line — a neutral `MANUAL` chip. */
  | { state: 'manual' }
  /** A healthy, untouched line — an em-dash. A healthy line carries no mark. */
  | { state: 'none' }

export interface LineMoney {
  /** `grossValue`, the PRE-discount figure — `null` when the line is undiscounted
   *  (blank, not `0.00`) or did not price. */
  was: number | null
  /** The magnitude of `promotionDiscount` — `null` under the same two conditions. */
  saved: number | null
  /** `netTotal`, the line's one emphasised figure — `null` only when it did not price. */
  netTotal: number | null
  /** `netPrice`, promoted onto the line under the quantity — the analyst's cheapest
   *  sanity check on a price-master problem. `null` when the line did not price. */
  unitPrice: number | null
  /** The line failed to price: read `not priced`, never the zeros the wire sent. */
  notPriced: boolean
  promoSlot: PromoSlot
  /** The engine's own line messages (`[070] Mandatory condition 'VKP0' …`). They ride
   *  the LINE, always visible — 104's correction from 103: the expansion is closed at
   *  rest, so a badge pointing at a message you must first open is the exact failure
   *  the E/W count banner was retired for. Server text, passed through as data. */
  messages: string[]
}

/** Ok is the empty status; `E` and `W` both mean the line did not price. The letter
 *  is not the reasoning — an error is not a weaker failure than a warning — so the
 *  rule keys on "not ok" rather than on `'W'`. */
function isNotPriced(item: SimulationResultItem): boolean {
  return (item.pricingStatus ?? '').trim() !== ''
}

/** `P`/`B` origins are the promotion rows; `isBonusBuy` is the same fact stated by
 *  the projection (044), so either one firing counts. */
function hasPromotion(item: SimulationResultItem): boolean {
  return item.conditions.some(
    (c) => c.isBonusBuy === true || conditionBadge(c.conditionOrigin) === 'promotion',
  )
}

/** An `M` origin — a condition the operator entered by hand for this run. */
function hasManual(item: SimulationResultItem): boolean {
  return item.conditions.some((c) => conditionBadge(c.conditionOrigin) === 'manual')
}

function promoSlot(item: SimulationResultItem): PromoSlot {
  // `warned` wins unconditionally. The two can never legitimately collide, so this
  // is a guard rather than a precedence rule: the slot must resolve to ONE state
  // whatever the wire sends.
  if (isNotPriced(item)) return { state: 'warned' }
  const manual = hasManual(item)
  if (hasPromotion(item)) return { state: 'fired', manual }
  return manual ? { state: 'manual' } : { state: 'none' }
}

export function lineMoney(item: SimulationResultItem): LineMoney {
  const notPriced = isNotPriced(item)
  const messages = item.pricingStatusMessages ?? []

  if (notPriced) {
    return {
      was: null,
      saved: null,
      netTotal: null,
      unitPrice: null,
      notPriced: true,
      promoSlot: { state: 'warned' },
      messages,
    }
  }

  // One decision, two columns: `was` without `saved` would be a pre-discount figure
  // beside no discount, which reads as a discrepancy.
  const discounted = item.promotionDiscount !== 0

  return {
    was: discounted ? item.grossValue : null,
    saved: discounted ? Math.abs(item.promotionDiscount) : null,
    netTotal: item.netTotal,
    unitPrice: item.netPrice,
    notPriced: false,
    promoSlot: promoSlot(item),
    messages,
  }
}
