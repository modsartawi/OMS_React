/**
 * The dispatch scorecard's range, filters and refusals (ticket 543; ruling 2948 D8). Pure, pinned by
 * `range.test.ts`.
 *
 * - **The range** is whole local days, both ends inclusive: the last 30 days ending today by default
 *   (the door's own default, `DispatchScorecardQuery.DefaultDays`), or any picked range up to 92 days.
 *   A longer, reversed or half-typed range is refused HERE, before any call; the door still refuses
 *   one with `CALLOUT-301` / `302`, and each refusal reads as its own sentence.
 * - 🔑 **The URL is the single source of truth** (`useUrlQuery`): `tab`, `from`, `to`, `type`,
 *   `channel`, `city`, `region`, `store`. A default writes nothing.
 *
 * Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`).
 */
import { apiErrorCode } from '@/core/api'
import { DISPATCH_SCORECARD_REFUSALS, type DispatchScorecardQuery } from '@/core/models/dispatch-scorecard'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The default window, in days ending today (inclusive). */
export const DEFAULT_DAYS = 30
/** The longest range the door answers, inclusive of both ends. */
export const MAX_DAYS = 92

export const SCORECARD_TABS = ['stores', 'staff'] as const
export type ScorecardTab = (typeof SCORECARD_TABS)[number]

/** The screen's whole query, as its URL holds it. `''` = blank (the default range, or no filter). */
export interface ScorecardFilters {
  tab: ScorecardTab
  from: string
  to: string
  type: string
  channel: string
  city: string
  region: string
  store: string
}

export const DEFAULT_FILTERS: ScorecardFilters = { tab: 'stores', from: '', to: '', type: '', channel: '', city: '', region: '', store: '' }

/** Why a range makes no call. */
export type RangeProblem = 'incomplete' | 'reversed' | 'tooLong'

export type ResolvedRange = { ok: true; from: string; to: string } | { ok: false; problem: RangeProblem }

const dayBefore = (now: Date, days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

/** A strict `yyyy-MM-dd` that names a real day (`2026-02-30` does not). */
function realDay(value: string): Date | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value.trim() ? date : null
}

/** Whole calendar days from `a` to `b`, counted on the dates alone. */
function daysBetween(a: Date, b: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** The range the door is asked for, or why it is not asked. Both ends blank = the default 30 days. */
export function resolveRange(filters: Pick<ScorecardFilters, 'from' | 'to'>, now: Date): ResolvedRange {
  if (!filters.from && !filters.to)
    return { ok: true, from: toIsoDate(dayBefore(now, DEFAULT_DAYS - 1)), to: toIsoDate(dayBefore(now, 0)) }
  const from = realDay(filters.from)
  const to = realDay(filters.to)
  if (!from || !to) return { ok: false, problem: 'incomplete' }
  if (to < from) return { ok: false, problem: 'reversed' }
  if (daysBetween(from, to) + 1 > MAX_DAYS) return { ok: false, problem: 'tooLong' }
  return { ok: true, from: toIsoDate(from), to: toIsoDate(to) }
}

const FILTER_KEYS = ['from', 'to', 'type', 'channel', 'city', 'region', 'store'] as const

/** The filters a URL describes. Anything unknown reads as its default. */
export function filtersFromParams(params: URLSearchParams): ScorecardFilters {
  const tab = params.get('tab')
  const filters: ScorecardFilters = { ...DEFAULT_FILTERS, tab: tab === 'staff' ? 'staff' : 'stores' }
  for (const key of FILTER_KEYS) filters[key] = (params.get(key) ?? '').trim()
  return filters
}

/** The filters as their URL: `tab` (Staff only), then each non-blank filter. */
export function filtersToParams(filters: ScorecardFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.tab !== 'stores') qs.set('tab', filters.tab)
  for (const key of FILTER_KEYS) if (filters[key]) qs.set(key, filters[key])
  return qs
}

/** What every read sends: the resolved range and the filters (`buildQuery` drops the blanks). */
export function wireQuery(filters: ScorecardFilters, range: { from: string; to: string }): Required<DispatchScorecardQuery> {
  return {
    from: range.from,
    to: range.to,
    type: filters.type,
    channel: filters.channel,
    city: filters.city,
    region: filters.region,
    store: filters.store,
  }
}

const REFUSAL_KEYS: Record<string, string> = {
  [DISPATCH_SCORECARD_REFUSALS.rangeTooLong]: 'refusal.rangeTooLong',
  [DISPATCH_SCORECARD_REFUSALS.rangeReversed]: 'refusal.rangeReversed',
  [DISPATCH_SCORECARD_REFUSALS.unknownFigure]: 'refusal.unknownFigure',
  [DISPATCH_SCORECARD_REFUSALS.storeRequired]: 'refusal.storeRequired',
}

/** A `CALLOUT-30x` refusal's own sentence key, or null for any other failure (shown in the server's words). */
export function refusalKey(err: unknown): string | null {
  const code = apiErrorCode(err)
  return code ? (REFUSAL_KEYS[code] ?? null) : null
}
