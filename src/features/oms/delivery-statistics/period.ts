/**
 * The statistics page's period (ticket 484): its tab as the URL holds it, and the From/To/Granularity
 * the door is asked for. Pure, pinned by `period.test.ts`.
 *
 * - **Today** and **Yesterday** are one day each, by the hour.
 * - **Range** is by the day: a quick pick of 7, 14 or 31 days ENDING YESTERDAY (a whole day each,
 *   as on the till), or a custom From–To that may end today.
 * - 🚩 A range over 31 days inclusive, a reversed one, one ending after today or one missing an
 *   end is refused HERE, before any call — the till does the same. The server still refuses a long
 *   range with `SDD-02131`, and the page shows that refusal as the server words it.
 *
 * Dates are local `yyyy-MM-dd` calendar days: the estate is single-timezone local time, so there is
 * no UTC round trip (the way `deliveries/query-model` resolves its presets).
 *
 * 🔑 The URL is the single source of truth (`useUrlQuery`): `period` (`today` is the default and
 * absent), and for a range its `pick` (`7` | `14` | `31` | `custom`) and a custom range's `from`
 * and `to`. A custom range keeps its dates as typed, so a refused range stays on screen to be fixed.
 */
import type { StatisticsGranularity } from '@/core/models/delivery-statistics'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

export const PERIOD_TABS = ['today', 'yesterday', 'range'] as const
export type PeriodTab = (typeof PERIOD_TABS)[number]

/** The Range tab's quick picks, in days ending yesterday. */
export const QUICK_PICKS = [7, 14, 31] as const
export type QuickPick = (typeof QUICK_PICKS)[number]
export type RangePick = QuickPick | 'custom'

/** The longest range the door answers, inclusive of both ends (the till's cap). */
export const MAX_RANGE_DAYS = 31

export interface PeriodQuery {
  tab: PeriodTab
  /**
   * The Range tab's pick. While another tab is shown the URL drops it (and a custom range's dates),
   * so it survives a tab change within the visit but not a reload or a shared link.
   */
  pick: RangePick
  /** A custom range's ends as typed (`yyyy-MM-dd`, `''` = blank). Kept, like `pick`, for the visit. */
  from: string
  to: string
}

export const DEFAULT_PERIOD: PeriodQuery = { tab: 'today', pick: 7, from: '', to: '' }

/** Why a period makes no call. */
export type PeriodProblem = 'incomplete' | 'reversed' | 'tooLong' | 'future'

export type ResolvedPeriod =
  | { ok: true; from: string; to: string; granularity: StatisticsGranularity }
  | { ok: false; problem: PeriodProblem }

/** Local midnight, `days` before `now`'s own day. */
function dayBefore(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

/** Whole calendar days from `a` to `b`, counted on the dates alone (no clock, no zone). */
function daysBetween(a: Date, b: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** A strict `yyyy-MM-dd` that names a real day (`2026-02-30` does not). */
function realDay(value: string): Date | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value.trim() ? date : null
}

/** The period as the door's From, To and Granularity against `now`, or why it makes no call. */
export function resolvePeriod(query: PeriodQuery, now: Date): ResolvedPeriod {
  const today = dayBefore(now, 0)
  if (query.tab === 'today') return { ok: true, from: toIsoDate(today), to: toIsoDate(today), granularity: 'hour' }
  if (query.tab === 'yesterday') {
    const yesterday = toIsoDate(dayBefore(now, 1))
    return { ok: true, from: yesterday, to: yesterday, granularity: 'hour' }
  }
  if (query.pick !== 'custom')
    return { ok: true, from: toIsoDate(dayBefore(now, query.pick)), to: toIsoDate(dayBefore(now, 1)), granularity: 'day' }

  const from = realDay(query.from)
  const to = realDay(query.to)
  if (!from || !to) return { ok: false, problem: 'incomplete' }
  if (to < from) return { ok: false, problem: 'reversed' }
  if (to > today) return { ok: false, problem: 'future' }
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) return { ok: false, problem: 'tooLong' }
  return { ok: true, from: toIsoDate(from), to: toIsoDate(to), granularity: 'day' }
}

const isTab = (value: string | null): value is PeriodTab => (PERIOD_TABS as readonly string[]).includes(value ?? '')

function pickOf(value: string | null): RangePick {
  if (value === 'custom') return 'custom'
  const days = Number(value)
  return (QUICK_PICKS as readonly number[]).includes(days) ? (days as QuickPick) : DEFAULT_PERIOD.pick
}

/** The period a URL describes. Anything unknown reads as its default. */
export function periodFromParams(params: URLSearchParams): PeriodQuery {
  const period = params.get('period')
  const tab = isTab(period) ? period : DEFAULT_PERIOD.tab
  if (tab !== 'range') return { ...DEFAULT_PERIOD, tab }
  return { tab, pick: pickOf(params.get('pick')), from: (params.get('from') ?? '').trim(), to: (params.get('to') ?? '').trim() }
}

/** The period as its URL: `period`, then a range's `pick`, then a custom range's `from` and `to`. */
export function periodToParams(query: PeriodQuery): URLSearchParams {
  const qs = new URLSearchParams()
  if (query.tab === 'today') return qs
  qs.set('period', query.tab)
  if (query.tab !== 'range') return qs
  qs.set('pick', String(query.pick))
  if (query.pick === 'custom') {
    if (query.from) qs.set('from', query.from)
    if (query.to) qs.set('to', query.to)
  }
  return qs
}

/** Another tab. The range's pick and dates are kept, so coming back to Range within the visit finds them. */
export function withTab<Q extends PeriodQuery>(query: Q, tab: PeriodTab): Q {
  return { ...query, tab }
}

/**
 * Another pick on the Range tab. Custom with no dates of its own starts from the range on screen,
 * so the reader edits a real range rather than two blank boxes. Generic so the page's whole query
 * (485's store and leave-outs beside the period) passes through untouched.
 */
export function withPick<Q extends PeriodQuery>(query: Q, pick: RangePick, now: Date): Q {
  const next: Q = { ...query, tab: 'range', pick }
  if (pick !== 'custom' || query.from || query.to) return next
  const seed = resolvePeriod({ ...query, tab: 'range', pick: query.pick === 'custom' ? DEFAULT_PERIOD.pick : query.pick }, now)
  return seed.ok ? { ...next, from: seed.from, to: seed.to } : next
}
