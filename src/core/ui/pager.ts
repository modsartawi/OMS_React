// Pure pager arithmetic for a paged grid footer. No React, no network: the page
// number is a field of the screen's query object, and everything the footer needs
// is a function of that number plus what the read came back knowing.
//
// Graduated out of `features/admin/ua-admin/` (ticket 232) when the Loy member
// screen's Actions tab became its second consumer — a feature may never import
// another feature, so shared logic moves up to `core/`
// (`.claude/rules/feature-structure.md`).
//
// Two things changed in the move, both additions:
//   - the page size is a **parameter**, not a constant. Ua Users walks 50 a page;
//     Loy actions walks 25, the server's own default.
//   - Next has two derivations, because callers know two different things. See
//     `pagerButtonEnablement`.

/** The `skip` a 1-based page number asks the server for. */
export function skipForPage(page: number, pageSize: number): number {
  return Math.max(0, (Math.max(1, Math.floor(page)) - 1) * pageSize)
}

/**
 * How many pages a match count spans. An empty result is one (empty) page, not
 * zero — "Page 1 of 0" is not a thing the footer should ever be able to read.
 */
export function pageCountFromTotalMatches(totalMatches: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalMatches) / pageSize))
}

/**
 * Does the footer render at all? Only past the first page — a four-row result
 * grows no controls it doesn't need (spec 147).
 */
export function showsPager(totalMatches: number, pageSize: number): boolean {
  return totalMatches > pageSize
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
  pageSize: number
}): number {
  if (p.rowCount > 0 || p.page <= 1) return p.page
  return Math.min(p.page, pageCountFromTotalMatches(p.totalMatches, p.pageSize))
}

/**
 * What a caller knows about the far end of the result.
 *
 * - `isCapped` — the envelope's "more rows exist beyond THIS page" flag, and all
 *   the Ua Users read ever knows (ticket 143).
 * - `totalMatches` — a real record count, which the Loy actions read returns.
 *   Next is then arithmetic, not a flag.
 */
export type PagerBounds = { page: number; pageSize: number } & (
  | { isCapped: boolean }
  | { totalMatches: number }
)

function knowsOnlyThatMoreExist(
  p: PagerBounds,
): p is { page: number; pageSize: number } & { isCapped: boolean } {
  return 'isCapped' in p && typeof p.isCapped === 'boolean'
}

/**
 * Which of Previous / Next is live. Previous is the same question either way;
 * Next is answered by whichever fact the caller actually holds — never by
 * guessing the missing one. Driving a real total off `isCapped` would leave Next
 * dead on a page that has a successor; driving a capped envelope off arithmetic
 * would invent a total nobody sent.
 */
export function pagerButtonEnablement(p: PagerBounds): { previous: boolean; next: boolean } {
  const previous = p.page > 1
  if (knowsOnlyThatMoreExist(p)) return { previous, next: p.isCapped }
  return { previous, next: p.page < pageCountFromTotalMatches(p.totalMatches, p.pageSize) }
}
