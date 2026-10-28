/**
 * A ranking's items, pure (BackOffice spec 3185, door 3187; oms ticket 643). `GET IdfPriority/masters/{masterId}/
 * versions/{versionId}/entries?search=&idf=&page=&pageSize=` answers one page of a version's items; 647's
 * `GET IdfPriority/general/items` answers the same row shape for the general master.
 *
 * The items address (`?q&idf&page`) is shared by every items table (`ItemsTable.tsx`): the master page adds
 * `?version` (absent = the live one), 647's General page its own `tab`. `q` is an item number or description, `idf`
 * one IDF group number. A new search or group goes back to page 1.
 */
import { readPage } from './paging'

/** A row of the entries (and general items) door. */
export interface IdfEntryRow {
  itemNumber: string
  descriptionEn?: string | null
  descriptionAr?: string | null
  idfNumber: string
  priority: number
}

/** `{ page, pageSize, total, rows }`. */
export interface IdfEntriesPage {
  page: number
  pageSize: number
  total: number
  rows: IdfEntryRow[]
}

/** The item's description in the reader's language; the other one when it is blank. */
export function itemDescription(row: Pick<IdfEntryRow, 'descriptionEn' | 'descriptionAr'>, lang: string): string {
  const en = row.descriptionEn ?? ''
  const ar = row.descriptionAr ?? ''
  return lang.startsWith('ar') && ar ? ar : en || ar
}

/** What an items table asks: a search, a group, a page. */
export interface IdfItemsQuery {
  /** Item number or description; '' = every item. */
  q: string
  /** One IDF group number; '' = every group. */
  idf: string
  /** 1-based. */
  page: number
}

/** The master page's items address: which version, then the items query. */
export interface IdfMasterItemsQuery extends IdfItemsQuery {
  /** A version id; '' = the master's live version. */
  version: string
}

export function readItemsQuery(params: URLSearchParams): IdfItemsQuery {
  return { q: params.get('q')?.trim() ?? '', idf: params.get('idf')?.trim() ?? '', page: readPage(params.get('page')) }
}

/** Writes the items query onto `out` (a page's own params first), defaults omitted. */
export function writeItemsQuery(q: IdfItemsQuery, out = new URLSearchParams()): URLSearchParams {
  if (q.q) out.set('q', q.q)
  if (q.idf) out.set('idf', q.idf)
  if (q.page !== 1) out.set('page', String(q.page))
  return out
}

export function readMasterItemsQuery(params: URLSearchParams): IdfMasterItemsQuery {
  return { version: params.get('version')?.trim() ?? '', ...readItemsQuery(params) }
}

export function writeMasterItemsQuery(q: IdfMasterItemsQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.version) out.set('version', q.version)
  return writeItemsQuery(q, out)
}

/** Stable, module-level readers for `useUrlQuery` on the master page. */
export const masterItemsFromParams = (p: URLSearchParams) => readMasterItemsQuery(p)
export const masterItemsToParams = (q: IdfMasterItemsQuery) => writeMasterItemsQuery(q)

/** A new search or group starts again at page 1; everything else the query holds (the version) is kept. */
export function withItemsFilter<Q extends IdfItemsQuery>(q: Q, patch: Partial<Pick<IdfItemsQuery, 'q' | 'idf'>>): Q {
  return { ...q, ...patch, page: 1 }
}

/**
 * A typed search or group, as the box is left (or Enter pressed): the patch to apply, or null when the trimmed value
 * is what the address already holds — so leaving an untouched box never sends the reader back to page 1.
 */
export function typedItemsFilter(q: IdfItemsQuery, field: 'q' | 'idf', typed: string): Partial<Pick<IdfItemsQuery, 'q' | 'idf'>> | null {
  const value = typed.trim()
  return value === q[field] ? null : { [field]: value }
}

/** The door's params. A blank field is handed on as '' and dropped by core `buildQuery` (the api-envelope rule). */
export function itemsDoorParams(q: IdfItemsQuery): Record<string, string> {
  return { search: q.q, idf: q.idf, page: String(q.page) }
}

/** The version whose items show: the one the address names, else the live one, else none (a master never published). */
export function entriesVersionId(q: Pick<IdfMasterItemsQuery, 'version'>, liveVersionId: string | null | undefined): string | null {
  return q.version || liveVersionId || null
}

/** Picking a version keeps the search and group and goes to page 1; the live one is the default, so it leaves the address. */
export function pickVersion(q: IdfMasterItemsQuery, versionId: string, liveVersionId: string | null | undefined): IdfMasterItemsQuery {
  return { ...q, version: versionId === liveVersionId ? '' : versionId, page: 1 }
}
