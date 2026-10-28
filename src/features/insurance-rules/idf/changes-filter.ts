import { windowProblem, type LocalDate, type WindowProblem } from '@/core/util/date-window'

/**
 * The General page's Change log filter, pure (BackOffice spec 3185, door 3194; oms ticket 650). Shaped on 626's
 * `events-filter.ts`. The address, under `?tab=changes` (`general.ts` owns `tab`): `?item&idf&user&from&to&page`.
 *
 * The window is local days, both ends counted, and BOTH ENDS ARE OPTIONAL (3194 names no default): a bare address
 * reads the whole log, newest first. Settled here (overrulable): no default window and no length cap — the log is
 * paged, and "why did this item change?" is usually asked about an item, not a week.
 */
export interface IdfChangesQuery {
  /** An item number; '' = every item. */
  item: string
  /** An IDF group number; '' = every group. */
  idf: string
  /** Who made the change (a user id); '' = anyone. */
  user: string
  /** Local days, both counted; '' = open at that end. */
  from: LocalDate | ''
  to: LocalDate | ''
  /** 1-based. */
  page: number
}

export const NO_CHANGES_FILTER: IdfChangesQuery = { item: '', idf: '', user: '', from: '', to: '', page: 1 }

/** The typed boxes (applied on leaving the box). */
export type IdfChangesTypedField = 'item' | 'idf' | 'user'

function readPage(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function readChangesQuery(params: URLSearchParams): IdfChangesQuery {
  const get = (key: string) => params.get(key)?.trim() ?? ''
  return { item: get('item'), idf: get('idf'), user: get('user'), from: get('from'), to: get('to'), page: readPage(params.get('page')) }
}

/** Writes the log's keys onto `out` (the page's own params first), blanks and page 1 left out. */
export function writeChangesQuery(q: IdfChangesQuery, out = new URLSearchParams()): URLSearchParams {
  for (const key of ['item', 'idf', 'user', 'from', 'to'] as const) if (q[key]) out.set(key, q[key])
  if (q.page !== 1) out.set('page', String(q.page))
  return out
}

/** A filter change: any change of what is asked starts again at page 1. */
export function withChangesFilter(q: IdfChangesQuery, patch: Partial<Omit<IdfChangesQuery, 'page'>>): IdfChangesQuery {
  return { ...q, ...patch, page: 1 }
}

/** A typed item, group or user as the box is left: the patch, or null when the trimmed value is what the address holds. */
export function typedChangesFilter(q: IdfChangesQuery, field: IdfChangesTypedField, typed: string): Partial<Pick<IdfChangesQuery, IdfChangesTypedField>> | null {
  const value = typed.trim()
  return value === q[field] ? null : { [field]: value }
}

/**
 * Why the window may not be read, or null when it may: an end that is not a real day is `invalid`, `to` before
 * `from` is `reversed`. One end alone (or none) is a window open at the other end.
 */
export function changesWindowProblem(q: Pick<IdfChangesQuery, 'from' | 'to'>): Extract<WindowProblem, 'invalid' | 'reversed'> | null {
  const rule = { maxDays: Number.POSITIVE_INFINITY }
  if (q.from && q.to) return windowProblem(q.from, q.to, rule) as 'invalid' | 'reversed' | null
  const end = q.from || q.to
  return end ? (windowProblem(end, end, rule) as 'invalid' | null) : null
}

/** The export's params: the filter, every field named (a blank one '' is dropped by core `buildQuery`). */
export function changesExportParams(q: IdfChangesQuery): Record<string, string> {
  return { item: q.item, idf: q.idf, user: q.user, from: q.from, to: q.to }
}

/** `GET IdfPriority/general/changes`'s params: the filter and the page. */
export function changesDoorParams(q: IdfChangesQuery): Record<string, string> {
  return { ...changesExportParams(q), page: String(q.page) }
}
