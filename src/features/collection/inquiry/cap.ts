/**
 * The system cap, and the one honest thing the screen can say about it
 * (ticket 254).
 *
 * Lives beside the four screens rather than inside one of them: all four ask for
 * the same generous `Limit` and all four banner the same way, and a relative
 * import between siblings of ONE feature is what the feature-structure rule
 * intends (`features/collection/` is one feature holding a tight cluster of
 * screens). It does **not** graduate to `core/` — no second feature wants it.
 *
 * Why it exists at all: the WPF's `Limit = 200` truncated an ordinary HQ-wide day
 * and said nothing, which is the bug this wave was chartered to end. Replacing 200
 * with 2,000 does not end it — it only makes the silence rarer. The banner is what
 * ends it.
 */

/**
 * How many rows a page of any of the four grids holds.
 *
 * **The browser pages, not the server.** None of the four endpoints has
 * `Skip`/`Offset`/a count, so server paging would mean real `OFFSET/FETCH` +
 * `COUNT` SQL on four endpoints — and it would confine sort, per-column filter and
 * export to the current page. Client paging keeps all three operating over the
 * whole matched result (244 §3), which is what 258's export depends on.
 *
 * 50 matches the Ua Users and Loy Actions grids, the repo's other paged lists.
 */
export const GRID_PAGE_SIZE = 50

/**
 * Did this result actually **reach** the cap?
 *
 * 🚩 **Reached, not merely large.** A banner that fired at "nearly 2,000" would be
 * a guess, and a supervisor who learns that the warning is usually wrong stops
 * reading it — at which point the one query that really was truncated goes past
 * unread. `>=` rather than `===` because a door that over-served (an off-by-one on
 * a `TOP`, a cap raised server-side without telling us) has still truncated
 * *something*, and the banner is right in that case too.
 *
 * ⚠️ It is a **client-side inference**, and it has to be: none of the four
 * endpoints returns a total count — only `Limit` — which is the same fact that
 * ruled out true server paging (244 §3). So `rowCount === limit` may be an exact
 * fit rather than a truncation. The banner is worded as a possibility for exactly
 * that reason, and erring towards saying so beats erring towards silence.
 */
export function isCapReached(rowCount: number, limit: number): boolean {
  if (!Number.isFinite(rowCount) || !Number.isFinite(limit) || limit <= 0) return false
  return rowCount >= limit
}
