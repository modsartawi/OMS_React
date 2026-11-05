/**
 * Lens counts (ticket 398, spec 380 L1, L2, L9; ruling 366; graduated from the Deliveries list's
 * `lenses.ts` at ticket 786, when the Order / ERX list became its second reader).
 *
 * A lens is a predicate over the rows ALREADY LOADED, so it never calls the server, and its count
 * is the loaded rows it matches, said honestly:
 *
 * - before any search there is nothing to count, so it reads "—";
 * - when the result may have been cut, EVERY count is a lower bound ("200+", "7+") — the status
 *   bar's exact vs "at least". A server that says so (`limited`) is believed; otherwise a page
 *   that came back full (rows = Limit) is taken as cut;
 * - counts cover the whole loaded result and ignore the grid's column filters. When column
 *   filters narrow the grid, the grid bar's pill says "N of M shown" instead.
 *
 * Pure: no React, no i18n. A count is returned as its wording's key and number, for the caller to
 * render and isolate once. Each list binds its own predicates with {@link lensKit}.
 */

/** The rows the last search loaded, and the Limit it ran with. `null` = no search yet. */
export interface LoadedResult<Row> {
  rows: readonly Row[]
  limit: number
  /** The server's own word that more rows matched than the limit let through, when it gives one. */
  limited?: boolean
}

/** A count's wording: "—" (`none`), "12" (`exact`) or "12+" (`atLeast`). */
export type CountWording = { key: 'none' } | { key: 'exact' | 'atLeast'; count: number }

/**
 * The grid bar's row pill: the active lens's loaded rows ("5 deliveries", "200+ deliveries"),
 * or, while column filters narrow the grid, what the grid shows of them ("12 of 40 shown").
 */
export type RowPill =
  | { key: 'rows'; total: CountWording }
  | { key: 'shown'; shown: number; total: CountWording }

/** There are more rows than were loaded: the server said so, or (when it does not say) the page came back full. */
export function isCut(result: LoadedResult<unknown> | null): boolean {
  if (result === null) return false
  return typeof result.limited === 'boolean' ? result.limited : result.rows.length >= result.limit
}

/** One list's lenses, bound to its predicates and its rail order. */
export interface LensKit<L extends string, Row> {
  lensMatches(lens: L, row: Row): boolean
  lensCount(result: LoadedResult<Row> | null, lens: L): CountWording
  lensCounts(result: LoadedResult<Row> | null): Record<L, CountWording>
  /** `null` before a search. */
  rowPill(result: LoadedResult<Row> | null, lens: L, grid: { displayed: number; columnFiltered: boolean }): RowPill | null
  /**
   * "No loaded rows match this lens": rows were loaded and the lens matches none of them. An
   * empty search is a different state (nothing matched the search), and so is no search.
   */
  lensIsEmpty(result: LoadedResult<Row> | null, lens: L): boolean
}

export function lensKit<L extends string, Row>(
  predicates: Record<L, (row: Row) => boolean>,
  ids: readonly L[],
): LensKit<L, Row> {
  const matchCount = (result: LoadedResult<Row>, lens: L) => result.rows.filter(predicates[lens]).length
  const lensCount = (result: LoadedResult<Row> | null, lens: L): CountWording =>
    result === null ? { key: 'none' } : { key: isCut(result) ? 'atLeast' : 'exact', count: matchCount(result, lens) }
  return {
    lensMatches: (lens, row) => predicates[lens](row),
    lensCount,
    lensCounts: (result) =>
      Object.fromEntries(ids.map((lens) => [lens, lensCount(result, lens)])) as Record<L, CountWording>,
    rowPill: (result, lens, grid) => {
      if (result === null) return null
      const total = lensCount(result, lens)
      return grid.columnFiltered ? { key: 'shown', shown: grid.displayed, total } : { key: 'rows', total }
    },
    lensIsEmpty: (result, lens) => result !== null && result.rows.length > 0 && matchCount(result, lens) === 0,
  }
}
