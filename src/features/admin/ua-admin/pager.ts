// Pure pager arithmetic for the Ua Users grid (ticket 148). No React, no network:
// the page number is a field of the screen's query object, and everything the
// footer needs is a function of that number plus the envelope's counts.

/**
 * Fixed page size. NOT configurable: `MaxSearchRows` clamps `take` *downward*
 * server-side, so the only selectable range would be 25/50 — not worth a control
 * (ticket 143). The export walk (ticket 150) walks with this same step.
 */
export const PAGE_SIZE = 50

/** The `skip` a 1-based page number asks the server for. */
export function skipForPage(page: number): number {
  return Math.max(0, (Math.max(1, Math.floor(page)) - 1) * PAGE_SIZE)
}

/**
 * How many pages a match count spans. An empty result is one (empty) page, not
 * zero — "Page 1 of 0" is not a thing the footer should ever be able to read.
 */
export function pageCountFromTotalMatches(totalMatches: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalMatches) / PAGE_SIZE))
}

/**
 * Does the footer render at all? Only past the first page — a four-row result
 * grows no controls it doesn't need (spec 147).
 */
export function showsPager(totalMatches: number): boolean {
  return totalMatches > PAGE_SIZE
}

/**
 * Where the grid should sit after a mutation's refetch (ticket 149). The rule is
 * *hold* — page 7 of a worklist stays page 7 — with one guard: an action can
 * remove the last row of the last page (fix the final person on *Awaiting
 * activation* and that page is now empty), and landing on an empty grid would
 * look like the screen broke at the exact moment the work succeeded. So an
 * emptied page above 1 falls back to the new last page.
 *
 * Page 1 emptying is NOT a clamp — there is nowhere to go, and "no results" is
 * the honest state.
 */
export function clampToLastPageWhenCurrentPageEmpties(p: {
  page: number
  rowCount: number
  totalMatches: number
}): number {
  if (p.rowCount > 0 || p.page <= 1) return p.page
  return Math.min(p.page, pageCountFromTotalMatches(p.totalMatches))
}

/**
 * Which of Previous / Next is live. `isCapped` is the envelope's "more rows
 * exist beyond THIS page" flag; it used to be shown as a cap note and is now
 * simply what enables Next (ticket 143).
 */
export function pagerButtonEnablement(p: { page: number; isCapped: boolean }): {
  previous: boolean
  next: boolean
} {
  return { previous: p.page > 1, next: p.isCapped }
}
