/**
 * The Ended tab's search (ticket 547; BackOffice 3015): as the URL holds it, checked before it is
 * sent, and as the door is asked. Pure, pinned by `ended-filter.test.ts`.
 *
 * - `GET PrescriptionSessionWeb/Ended?from&to&store&state` — `from` and `to` are calendar days, both
 *   required; the store is the HOLDING store only; the state is one end state or all three.
 * - The server refuses a missing or reversed range, or one of `ENDED_RANGE_DAYS` days or more apart
 *   (`(to − from).Days >= 92`, i.e. more than 92 days counting both ends), with `PSES-00223`. This
 *   side checks the same before sending, so a bad range never costs a round trip.
 *
 * 🔑 The URL is the single source of truth (`useUrlQuery`). This tab is not the page's default, so
 * its address always carries `tab=ended` (`./tab`). An address without dates reads as the last 7
 * days, today included — counted from the reader's own day, so a pasted bare `tab=ended` always
 * means "this week".
 */
import { PRESCRIPTION_SESSION_STATES } from '@/core/prescription-session/words'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The states a session is ENDED in — this tab's (`PrescriptionSessionStates.Final`). */
export const ENDED_STATES = PRESCRIPTION_SESSION_STATES.slice(PRESCRIPTION_SESSION_STATES.indexOf('CLOSED'))

/** The widest range one read covers, both ends counted (`PrescriptionSessionHqLimits.EndedRangeDays`). */
export const ENDED_RANGE_DAYS = 92

/** The most rows one read returns (`PrescriptionSessionHqLimits.Rows`), earliest ended first; the answer carries no flag. */
export const ENDED_ROW_CAP = 2000

/** The default range: this many days, today included. */
const DEFAULT_DAYS = 7

const ENDED = 'PrescriptionSessionWeb/Ended'

export interface EndedFilter {
  /** `yyyy-MM-dd`, inclusive. */
  from: string
  /** `yyyy-MM-dd`, inclusive. */
  to: string
  /** A holding-store code, or `''` for every store. */
  store: string
  /** One of `ENDED_STATES`, or `''` for all three. */
  state: string
}

export type EndedRangeProblem = 'missing' | 'reversed' | 'tooWide'

/** The last 7 days, today included; every store, every end state. */
export function defaultEndedFilter(today: Date): EndedFilter {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DEFAULT_DAYS - 1))
  return { from: toIsoDate(from), to: toIsoDate(today), store: '', state: '' }
}

/** A `yyyy-MM-dd` that is a real calendar day, as written; else `null`. */
function day(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  const d = fromIsoDate(v)
  return d && toIsoDate(d) === v ? v : null
}

/** The search a URL describes. A date that is not a day, or a state that is not an end state, reads as the default. */
export function endedFilterFromParams(params: URLSearchParams, today: Date = new Date()): EndedFilter {
  const fallback = defaultEndedFilter(today)
  const state = (params.get('state') ?? '').trim()
  return {
    from: day(params.get('from')) ?? fallback.from,
    to: day(params.get('to')) ?? fallback.to,
    store: (params.get('store') ?? '').trim(),
    state: (ENDED_STATES as readonly string[]).includes(state) ? state : '',
  }
}

/** The search as its URL, in a fixed order, `tab=ended` first; an empty store or state is left out. */
export function endedFilterToParams(f: EndedFilter): URLSearchParams {
  const qs = new URLSearchParams({ tab: 'ended' })
  const put = (key: string, value: string) => {
    if (value.trim()) qs.set(key, value.trim())
  }
  put('from', f.from)
  put('to', f.to)
  put('store', f.store)
  put('state', f.state)
  return qs
}

/** Whole calendar days from `a` to `b` (local days; no clock in it). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000)
}

/** Why the server would refuse this range, or `null` when it would take it. */
export function endedRangeProblem(f: Pick<EndedFilter, 'from' | 'to'>): EndedRangeProblem | null {
  const from = day(f.from) && fromIsoDate(f.from)
  const to = day(f.to) && fromIsoDate(f.to)
  if (!from || !to) return 'missing'
  const apart = daysBetween(from, to)
  if (apart < 0) return 'reversed'
  if (apart >= ENDED_RANGE_DAYS) return 'tooWide'
  return null
}

export interface EndedRequest {
  path: typeof ENDED
  params: Record<string, string>
}

/** The door and its parameters, named as SIS.Api binds them. */
export function endedRequest(f: EndedFilter): EndedRequest {
  const params: Record<string, string> = { from: f.from.trim(), to: f.to.trim() }
  if (f.store.trim()) params.store = f.store.trim()
  if (f.state.trim()) params.state = f.state.trim()
  return { path: ENDED, params }
}
