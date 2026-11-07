import type { HybrisStockMarkedFilter, HybrisStockStoreRow, HybrisStockStoresQuery } from '@/core/models/hybris-stock'

// The stores page's URL (ticket 847) and its in-place row patch. Pure.

export const MARKED_FILTERS: readonly HybrisStockMarkedFilter[] = ['any', 'marked', 'unmarked']

/** The URL is the query: `?marked=marked&q=olaya`. An unknown `marked` reads as `any`. */
export function storesFromParams(params: URLSearchParams): HybrisStockStoresQuery {
  const marked = params.get('marked')
  const q = params.get('q')?.trim() || null
  return { marked: MARKED_FILTERS.includes(marked as HybrisStockMarkedFilter) ? (marked as HybrisStockMarkedFilter) : 'any', q }
}

/** The query back to the URL, defaults left off. The drawer's `?history=` is the page's, not kept here. */
export function storesToParams(query: HybrisStockStoresQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (query.marked !== 'any') p.set('marked', query.marked)
  if (query.q) p.set('q', query.q)
  return p
}

/** A cached store list with the store's row swapped where it stands (mark / unmark answer the row). */
export function replaceRow<T extends HybrisStockStoreRow[] | undefined>(rows: T, next: HybrisStockStoreRow): T {
  if (!rows || !rows.some((r) => r.storeCode === next.storeCode)) return rows
  return rows.map((r) => (r.storeCode === next.storeCode ? next : r)) as T
}
