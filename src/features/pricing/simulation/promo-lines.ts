import type { PromoBlock } from './promo-view'

/**
 * The promotion card's printed line list (ticket 117, spec 110).
 *
 * A promotion card names the lines it touched — `lines 10 · 20` — because the hover
 * cross-highlight is the *enhancement*, not the mechanism. The captures decided this:
 * one bonus buy discounts two lines with a single summed discount, and the rail can be
 * a scroll away from the lines it explains. A link that exists only under a pointer is
 * no link at all when the layout stacks (ticket 119) or when there is no pointer.
 *
 * Pure and machine-token-only — it returns NUMBERS, not the `·`-joined string. The
 * separator and the `promotions.lines` wording are the render tier's, so this module
 * stays node-testable and the i18n rule stays intact.
 *
 * It reads `touchedItems`, which `promoView` populates on BOTH paths: the flat
 * `affectedItemNumbers` on the degraded path, and the union of every application's
 * buy and get lines once the projection (ticket 044) lands. So the printed list
 * sharpens with the backend and needs no change here.
 */
export function promoLineList(block: Pick<PromoBlock, 'touchedItems'>): number[] {
  // De-duplicate then sort ASCENDING. `touchedItems` arrives in wire order, which the
  // captures show is not sorted (`05-pricing-elements` affects `[20, 10]`), and a card
  // that prints `lines 20 · 10` beside a table ordered 10, 20 is a puzzle, not a link.
  return [...new Set(block.touchedItems.map((item) => item.itemNumber))].sort((a, b) => a - b)
}
