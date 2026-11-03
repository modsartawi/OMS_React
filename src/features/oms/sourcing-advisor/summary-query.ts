/**
 * The 30-day simulation's range and filters (ticket 739, spec 734 D15/D20). Pure, pinned by
 * `summary-query.test.ts`. The shape of the dispatch scorecard's `range.ts`.
 *
 * - **The range** is whole local days, both ends inclusive: by default the last 30 days ENDING
 *   YESTERDAY — the nightly job scores the day before (D19), so today is never scored yet. Any picked
 *   range up to 92 days is asked as picked. A longer, reversed or half-typed range is refused HERE,
 *   before any call; the door still refuses one with `SOURCING-402`.
 * - 🔑 **The URL is the single source of truth** (`useUrlQuery`): `from`, `to`, `city`, `channel`,
 *   `deliveryType`. A default writes nothing.
 *
 * Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`).
 */
import type { SourcingSummaryQuery } from '@/core/models/sourcing-advisor'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The default window, in days ending yesterday (inclusive). */
export const DEFAULT_DAYS = 30
/** The longest range the door answers, inclusive of both ends (D15). */
export const MAX_DAYS = 92

/** The screen's whole query, as its URL holds it. `''` = blank (the default range, or no filter). */
export type SummaryFilters = SourcingSummaryQuery

export const DEFAULT_SUMMARY_FILTERS: SummaryFilters = { from: '', to: '', city: '', channel: '', deliveryType: '' }

export type RangeProblem = 'incomplete' | 'reversed' | 'tooLong'
export type ResolvedRange = { ok: true; from: string; to: string } | { ok: false; problem: RangeProblem }

const dayBefore = (now: Date, days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

/** A strict `yyyy-MM-dd` that names a real day (`2026-02-30` does not). */
function realDay(value: string): Date | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value.trim() ? date : null
}

function daysBetween(a: Date, b: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** The range the door is asked for, or why it is not asked. Both ends blank = the default 30 days. */
export function resolveSummaryRange(filters: Pick<SummaryFilters, 'from' | 'to'>, now: Date): ResolvedRange {
  if (!filters.from && !filters.to) return { ok: true, from: toIsoDate(dayBefore(now, DEFAULT_DAYS)), to: toIsoDate(dayBefore(now, 1)) }
  const from = realDay(filters.from)
  const to = realDay(filters.to)
  if (!from || !to) return { ok: false, problem: 'incomplete' }
  if (to < from) return { ok: false, problem: 'reversed' }
  if (daysBetween(from, to) + 1 > MAX_DAYS) return { ok: false, problem: 'tooLong' }
  return { ok: true, from: toIsoDate(from), to: toIsoDate(to) }
}

const KEYS = ['from', 'to', 'city', 'channel', 'deliveryType'] as const

/** The filters a URL describes. Anything absent reads as its default. */
export function summaryFiltersFromParams(params: URLSearchParams): SummaryFilters {
  const f = { ...DEFAULT_SUMMARY_FILTERS }
  for (const key of KEYS) f[key] = (params.get(key) ?? '').trim()
  return f
}

/** The filters as their URL: each non-blank one. */
export function summaryFiltersToParams(filters: SummaryFilters): URLSearchParams {
  const qs = new URLSearchParams()
  for (const key of KEYS) if (filters[key]) qs.set(key, filters[key])
  return qs
}

/** What the read sends: the resolved range and the filters (`buildQuery` drops the blanks). */
export function summaryWireQuery(filters: SummaryFilters, range: { from: string; to: string }): SourcingSummaryQuery {
  return { from: range.from, to: range.to, city: filters.city, channel: filters.channel, deliveryType: filters.deliveryType }
}
