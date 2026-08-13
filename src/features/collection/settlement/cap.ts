/**
 * The account grid's page size and its cap (ticket 269).
 *
 * 🚩 **Copied from `features/collection/inquiry/cap.ts`, not imported and not
 * graduated** — and the copy is ticket 268's own rubric applied, not a lapse.
 * `tools/check-boundaries.mjs` reads `collection/inquiry` and `collection/settlement`
 * as two features, and a feature may not import a feature; 268 ruled that *copying
 * is the cheaper default and matches the neighbours, and graduating is right only if
 * the copy would be the second one and the component is genuinely identical*. This
 * is the second copy and it is **not** identical:
 *
 * - the limit differs — **500** here, the `TOP` the account door applies (spec 267
 *   D3), against the inquiries' 2,000;
 * - the neighbour's docblock argues at length about a WPF `Limit = 200` box that
 *   truncated an HQ-wide day in silence. This screen never had that box, and
 *   inheriting the argument would be inheriting a history that is not ours.
 *
 * The three lines below are all that is shared, and they are three lines.
 */

/**
 * How many entries a page of the account grid holds.
 *
 * 50, matching the four collection inquiries, the Ua Users grid and the Loy Actions
 * grid — the repo's other paged lists. **The browser pages, not the server**, so
 * sort and the per-column filter row operate over the whole account rather than over
 * the visible page.
 */
export const GRID_PAGE_SIZE = 50

/**
 * The `TOP` the account door applies (spec 267 D3 — *"50 per page inside the
 * server's 500-row `TOP` cap, with the banner when it bites"*).
 *
 * 🚩 One constant, asked for by the query **and** measured against the answer. Two
 * numbers here would mean the banner measuring one cap while the door applied
 * another, at which point it either cries wolf or stays silent on a truncated
 * branch — and a branch whose history is silently cut in half is a phone call the
 * accountant loses.
 */
export const ACCOUNT_LIMIT = 500

/**
 * Did this account actually **reach** the cap?
 *
 * **Reached, not merely large** — a banner that fired at "nearly 500" would be a
 * guess, and a reader who learns the warning is usually wrong stops reading it.
 * `>=` rather than `===` because a door that over-served has still truncated
 * *something*.
 *
 * ⚠️ It is a client-side inference: the door returns rows, not a total, so an exact
 * fit is indistinguishable from a truncation. The sentence it fires is worded as a
 * possibility for exactly that reason, and erring towards saying so beats erring
 * towards silence.
 */
export function isCapReached(rowCount: number, limit: number): boolean {
  if (!Number.isFinite(rowCount) || !Number.isFinite(limit) || limit <= 0) return false
  return rowCount >= limit
}
