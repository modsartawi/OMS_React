import type { HybrisStockFlagFilter, HybrisStockHealthFilter, HybrisStockStoreRow, HybrisStockStoresQuery } from '@/core/models/hybris-stock'

// The stores page's URL ⇄ query ⇄ door mapping (ticket 847) and its in-place row patch. Pure.
// The URL speaks the door's own words (`?flag=&health=&q=`).

export const FLAG_FILTERS: readonly HybrisStockFlagFilter[] = ['any', 'marked', 'unmarked']
export const HEALTH_FILTERS: readonly HybrisStockHealthFilter[] = ['any', 'ok', 'unhealthy']

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T => (allowed.includes(value as T) ? (value as T) : allowed[0])

/** `?flag=marked&health=unhealthy&q=olaya`. A value the door does not know reads as `any`. */
export function storesFromParams(params: URLSearchParams): HybrisStockStoresQuery {
  return { flag: pick(params.get('flag'), FLAG_FILTERS), health: pick(params.get('health'), HEALTH_FILTERS), q: params.get('q')?.trim() || null }
}

/** The query back to the URL, defaults left off. The drawer's `?history=` is the page's, not kept here. */
export function storesToParams(query: HybrisStockStoresQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (query.flag !== 'any') p.set('flag', query.flag)
  if (query.health !== 'any') p.set('health', query.health)
  if (query.q) p.set('q', query.q)
  return p
}

/** What `GET HybrisStockWeb/Stores` is sent: `any` left off (it is the door's default). */
export function storesDoorParams(query: HybrisStockStoresQuery) {
  return { flag: query.flag === 'any' ? null : query.flag, health: query.health === 'any' ? null : query.health, q: query.q }
}

/** A cached store list with the store's row swapped where it stands (mark / unmark answer the row). */
export function replaceRow<T extends HybrisStockStoreRow[] | undefined>(rows: T, next: HybrisStockStoreRow): T {
  if (!rows || !rows.some((r) => r.storeCode === next.storeCode)) return rows
  return rows.map((r) => (r.storeCode === next.storeCode ? next : r)) as T
}
