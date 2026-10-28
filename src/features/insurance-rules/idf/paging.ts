import { clampToLastPageWhenCurrentPageEmpties } from '@/core/ui/pager'

/**
 * The IDF screens' paging, pure (3185 review, findings 1 and 10). Every paged IDF door answers `{ page, pageSize,
 * total, rows }`; every IDF address carries `?page=` (1-based, page 1 left out).
 */

/** A paged door's answer. */
export interface IdfPage<R> {
  page: number
  pageSize: number
  total: number
  rows: R[]
}

/** A `?page=` value: a whole page of 1 or more, else page 1. */
export function readPage(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** A page body as read, every field a null (or partial) body leaves out filled: an empty page at the page asked for. */
export function pageOrEmpty<R>(p: Partial<IdfPage<R>> | null | undefined, page: number): IdfPage<R> {
  return { page: p?.page ?? page, pageSize: p?.pageSize ?? 0, total: p?.total ?? 0, rows: p?.rows ?? [] }
}

/**
 * Where a table should go when its page came back empty (the last row of the last page removed or cleared): core's
 * clamp to the new last page — or null to stay. A page read for another page than the address asks for (a held
 * placeholder) and a page whose size the door did not say are never acted on.
 */
export function emptiedPageTarget(p: Pick<IdfPage<unknown>, 'page' | 'pageSize' | 'total' | 'rows'>, asked: number): number | null {
  if (p.page !== asked || p.pageSize <= 0) return null
  const to = clampToLastPageWhenCurrentPageEmpties({ page: asked, rowCount: p.rows.length, totalMatches: p.total, pageSize: p.pageSize })
  return to === asked ? null : to
}
