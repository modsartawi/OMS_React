/**
 * Lenses (ticket 398, spec 380 L1, L2, L9; ruling 366): the built-in views of the Deliveries
 * list. A lens is a predicate over the rows ALREADY LOADED, so it never calls the server, and
 * its count is the loaded rows it matches, said honestly:
 *
 * - before any search there is nothing to count, so it reads "—";
 * - when the page came back full (rows = Limit) the result may have been cut, so EVERY count
 *   is a lower bound ("200+", "7+");
 * - counts cover the whole loaded result and ignore the grid's column filters. When column
 *   filters narrow the grid, the grid bar's pill says "N of M shown" instead.
 *
 * There is no server count. Pure: no React, no i18n. A count is returned as its wording's key
 * (`deliveries:lens.count.<key>`) and number, for the caller to render and isolate once.
 */
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'

type Row = DeliveryDocumentModel

export type LensId = 'all' | 'attention' | 'cancelRequested' | 'dawaaNow' | 'rescheduled'

const PREDICATES: Record<LensId, (row: Row) => boolean> = {
  all: () => true,
  attention: (row) => (row.failedJobsCount ?? 0) > 0,
  // Close requested, which is final. A close (`C`, `X`) is not a request.
  cancelRequested: (row) => row.closeStatus === 'R',
  dawaaNow: (row) => row.isExpressDelivery === true,
  rescheduled: (row) => row.rescheduled === true,
}

/** The five lenses, in the views rail's order. */
export const LENS_IDS: readonly LensId[] = ['all', 'attention', 'cancelRequested', 'dawaaNow', 'rescheduled']

export function lensMatches(lens: LensId, row: Row): boolean {
  return PREDICATES[lens](row)
}

/** The rows the last search loaded, and the Limit it ran with. `null` = no search yet. */
export interface LoadedResult {
  rows: readonly Row[]
  limit: number
}

/** A count's wording: "—" (`none`), "12" (`exact`) or "12+" (`atLeast`). */
export type CountWording = { key: 'none' } | { key: 'exact' | 'atLeast'; count: number }

/** The page came back full, so there may be more rows than were loaded. */
export function isCut(result: LoadedResult | null): boolean {
  return result !== null && result.rows.length >= result.limit
}

function matchCount(result: LoadedResult, lens: LensId): number {
  return lens === 'all' ? result.rows.length : result.rows.filter(PREDICATES[lens]).length
}

export function lensCount(result: LoadedResult | null, lens: LensId): CountWording {
  if (result === null) return { key: 'none' }
  return { key: isCut(result) ? 'atLeast' : 'exact', count: matchCount(result, lens) }
}

export function lensCounts(result: LoadedResult | null): Record<LensId, CountWording> {
  return Object.fromEntries(LENS_IDS.map((lens) => [lens, lensCount(result, lens)])) as Record<
    LensId,
    CountWording
  >
}

/**
 * The grid bar's row pill: the active lens's loaded rows ("5 deliveries", "200+ deliveries"),
 * or, while column filters narrow the grid, what the grid shows of them ("12 of 40 shown").
 * `null` before a search.
 */
export type RowPill =
  | { key: 'rows'; total: CountWording }
  | { key: 'shown'; shown: number; total: CountWording }

export function rowPill(
  result: LoadedResult | null,
  lens: LensId,
  grid: { displayed: number; columnFiltered: boolean },
): RowPill | null {
  if (result === null) return null
  const total = lensCount(result, lens)
  return grid.columnFiltered ? { key: 'shown', shown: grid.displayed, total } : { key: 'rows', total }
}

/**
 * "No loaded rows match this lens": rows were loaded and the lens matches none of them. An
 * empty search is a different state (nothing matched the search), and so is no search.
 */
export function lensIsEmpty(result: LoadedResult | null, lens: LensId): boolean {
  return result !== null && result.rows.length > 0 && matchCount(result, lens) === 0
}
