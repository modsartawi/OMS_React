/**
 * The Bupa line outcomes screen's filters (oms 899). Pure, pinned by `filters.test.ts`.
 *
 * - **The range** is the orders' placed days, both ends inclusive: the last 30 days ending today by default, or any
 *   picked range of at most 3 calendar months (`to` no later than `from` + 3 months). A half-typed, reversed or longer
 *   range is caught HERE, before any call; the door still refuses one with its own code (minted by BackOffice 3890),
 *   which the screen shows inline.
 * - **Store** is one store code, **kind** one of the six kinds; blank = every one.
 * - 🔑 **The URL is the single source of truth** (`useUrlQuery`): `from`, `to`, `store`, `kind`. A default writes
 *   nothing. A shared link opens the same view.
 * - The report and the export are asked with ONE query (`outcomeQuery`), so the file holds the rows on screen.
 *
 * Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`).
 */
import { BUPA_OUTCOME_KINDS, type BupaOutcomeKind, type BupaOutcomeQuery } from '@/core/models/bupa-line-outcome'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The default window, in days ending today (inclusive). */
export const DEFAULT_DAYS = 30
/** The longest range the door answers, in calendar months. */
export const MAX_MONTHS = 3

/** The screen's whole query, as its URL holds it. `''` = blank (the default range, or no filter). */
export interface OutcomeFilters {
  from: string
  to: string
  store: string
  kind: BupaOutcomeKind | ''
}

export const DEFAULT_FILTERS: OutcomeFilters = { from: '', to: '', store: '', kind: '' }

/** Why a range makes no call. */
export type RangeProblem = 'incomplete' | 'reversed' | 'tooLong'

export type ResolvedRange = { ok: true; from: string; to: string } | { ok: false; problem: RangeProblem }

const dayBefore = (now: Date, days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

/** A strict `yyyy-MM-dd` that names a real day (`2026-02-30` does not). */
function realDay(value: string): Date | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value.trim() ? date : null
}

/** `from` + `months` calendar months, clamped to the month's last day (Nov 30 + 3 months = Feb 28). */
function addMonths(from: Date, months: number): Date {
  const last = new Date(from.getFullYear(), from.getMonth() + months + 1, 0).getDate()
  return new Date(from.getFullYear(), from.getMonth() + months, Math.min(from.getDate(), last))
}

/** The range the door is asked for, or why it is not asked. Both ends blank = the last 30 days. */
export function resolveRange(filters: Pick<OutcomeFilters, 'from' | 'to'>, now: Date): ResolvedRange {
  if (!filters.from && !filters.to)
    return { ok: true, from: toIsoDate(dayBefore(now, DEFAULT_DAYS - 1)), to: toIsoDate(dayBefore(now, 0)) }
  const from = realDay(filters.from)
  const to = realDay(filters.to)
  if (!from || !to) return { ok: false, problem: 'incomplete' }
  if (to < from) return { ok: false, problem: 'reversed' }
  if (to > addMonths(from, MAX_MONTHS)) return { ok: false, problem: 'tooLong' }
  return { ok: true, from: toIsoDate(from), to: toIsoDate(to) }
}

/** A store code as the door reads it: trimmed and upper-cased. */
export const normalizeStore = (value: string): string => value.trim().toUpperCase()

const isKind = (value: string): value is BupaOutcomeKind => (BUPA_OUTCOME_KINDS as readonly string[]).includes(value)

/** The filters a URL describes. Anything unknown reads as its default. */
export function filtersFromParams(params: URLSearchParams): OutcomeFilters {
  const kind = (params.get('kind') ?? '').trim()
  return {
    from: (params.get('from') ?? '').trim(),
    to: (params.get('to') ?? '').trim(),
    store: normalizeStore(params.get('store') ?? ''),
    kind: isKind(kind) ? kind : '',
  }
}

/** The filters as their URL: each non-blank filter. */
export function filtersToParams(filters: OutcomeFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.from) qs.set('from', filters.from)
  if (filters.to) qs.set('to', filters.to)
  if (filters.store) qs.set('store', filters.store)
  if (filters.kind) qs.set('kind', filters.kind)
  return qs
}

/** The ONE query the report and the export are both asked with: the resolved range, the store and the kind. */
export function outcomeQuery(filters: OutcomeFilters, range: { from: string; to: string }): BupaOutcomeQuery {
  return { from: range.from, to: range.to, store: filters.store, kind: filters.kind }
}
