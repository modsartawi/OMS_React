/**
 * The serial refusal report's range, filters, drill and refusals (ticket 573). Pure, pinned by `filters.test.ts`.
 *
 * - **The range** is whole local days, both ends inclusive: the last 30 days ending today by default (the door's own
 *   default, `SerialRefusalReportQuery.DefaultDays`), or any picked range up to 92 days. A longer, reversed or
 *   half-typed range is refused HERE, before any call; the door still refuses one with `PICK-00301` / `302`.
 * - **The drill** narrows the Refusals tab to the refusals behind a row of another tab: a staff member (or the
 *   "unknown" row, `noStaff`), a serial, an article or a holding store. Picking one switches to that tab.
 * - 🔑 **The URL is the single source of truth** (`useUrlQuery`): `tab`, `from`, `to`, `stores`, `status` and the
 *   drill. A default writes nothing.
 *
 * Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`).
 */
import { apiErrorCode } from '@/core/api'
import { SERIAL_REFUSAL_REFUSALS, type SerialRefusalRowsQuery } from '@/core/models/serial-refusal'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The default window, in days ending today (inclusive). */
export const DEFAULT_DAYS = 30
/** The longest range the door answers, inclusive of both ends. */
export const MAX_DAYS = 92

export const REPORT_TABS = ['staff', 'offenders', 'serials', 'stores', 'articles', 'heldBy', 'days', 'refusals'] as const
export type ReportTab = (typeof REPORT_TABS)[number]

export const STATUSES = ['', 'SOLD', 'HELD'] as const
export type StatusFilter = (typeof STATUSES)[number]

/** What the Refusals tab is narrowed to. Every field blank (and `noStaff` false) = every refusal in scope. */
export interface Drill {
  staff: string
  noStaff: boolean
  gtin: string
  serial: string
  item: string
  heldStore: string
}

export const NO_DRILL: Drill = { staff: '', noStaff: false, gtin: '', serial: '', item: '', heldStore: '' }

/** The screen's whole query, as its URL holds it. `''` = blank (the default range, or no filter). */
export interface ReportFilters {
  tab: ReportTab
  from: string
  to: string
  stores: string
  status: StatusFilter
  drill: Drill
}

export const DEFAULT_FILTERS: ReportFilters = { tab: 'staff', from: '', to: '', stores: '', status: '', drill: NO_DRILL }

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
export function resolveRange(filters: Pick<ReportFilters, 'from' | 'to'>, now: Date): ResolvedRange {
  if (!filters.from && !filters.to)
    return { ok: true, from: toIsoDate(dayBefore(now, DEFAULT_DAYS - 1)), to: toIsoDate(dayBefore(now, 0)) }
  const from = realDay(filters.from)
  const to = realDay(filters.to)
  if (!from || !to) return { ok: false, problem: 'incomplete' }
  if (to < from) return { ok: false, problem: 'reversed' }
  if (daysBetween(from, to) + 1 > MAX_DAYS) return { ok: false, problem: 'tooLong' }
  return { ok: true, from: toIsoDate(from), to: toIsoDate(to) }
}

/** The stores box as the door reads it: codes split on commas or spaces, trimmed, upper-cased, de-duplicated. */
export function normalizeStores(value: string): string {
  const codes = value
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return [...new Set(codes)].join(',')
}

const DRILL_TEXT = ['staff', 'gtin', 'serial', 'item', 'heldStore'] as const

/** The filters a URL describes. Anything unknown reads as its default. */
export function filtersFromParams(params: URLSearchParams): ReportFilters {
  const tab = params.get('tab') as ReportTab | null
  const status = (params.get('status') ?? '').trim().toUpperCase() as StatusFilter
  const drill: Drill = { ...NO_DRILL, noStaff: params.get('noStaff') === '1' }
  for (const key of DRILL_TEXT) drill[key] = (params.get(key) ?? '').trim()
  if (drill.noStaff) drill.staff = ''
  return {
    tab: tab && (REPORT_TABS as readonly string[]).includes(tab) ? tab : 'staff',
    from: (params.get('from') ?? '').trim(),
    to: (params.get('to') ?? '').trim(),
    stores: normalizeStores(params.get('stores') ?? ''),
    status: (STATUSES as readonly string[]).includes(status) ? status : '',
    drill,
  }
}

/** The filters as their URL: `tab` (when not Staff), then each non-blank filter and drill field. */
export function filtersToParams(filters: ReportFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.tab !== 'staff') qs.set('tab', filters.tab)
  if (filters.from) qs.set('from', filters.from)
  if (filters.to) qs.set('to', filters.to)
  if (filters.stores) qs.set('stores', filters.stores)
  if (filters.status) qs.set('status', filters.status)
  if (filters.drill.noStaff) qs.set('noStaff', '1')
  for (const key of DRILL_TEXT) if (filters.drill[key]) qs.set(key, filters.drill[key])
  return qs
}

/** True when the Refusals tab is narrowed at all. */
export const isDrilled = (drill: Drill): boolean =>
  drill.noStaff || DRILL_TEXT.some((key) => drill[key] !== '')

/** What the report read sends: the resolved range, the stores and the answer (`buildQuery` drops the blanks). */
export function reportQuery(filters: ReportFilters, range: { from: string; to: string }) {
  return { from: range.from, to: range.to, stores: filters.stores, status: filters.status }
}

/** What the list read sends: the report's query and the drill. */
export function rowsQuery(filters: ReportFilters, range: { from: string; to: string }): SerialRefusalRowsQuery {
  const { drill } = filters
  return {
    ...reportQuery(filters, range),
    staff: drill.noStaff ? '' : drill.staff,
    noStaff: drill.noStaff,
    gtin: drill.gtin,
    serial: drill.serial,
    item: drill.item,
    heldStore: drill.heldStore,
  }
}

/** The filters after a row of another tab is opened: the drill replaced, the Refusals tab shown. */
export function drillInto(filters: ReportFilters, drill: Partial<Drill>): ReportFilters {
  return { ...filters, tab: 'refusals', drill: { ...NO_DRILL, ...drill } }
}

const REFUSAL_KEYS: Record<string, string> = {
  [SERIAL_REFUSAL_REFUSALS.rangeTooLong]: 'refusal.rangeTooLong',
  [SERIAL_REFUSAL_REFUSALS.rangeReversed]: 'refusal.rangeReversed',
  [SERIAL_REFUSAL_REFUSALS.unknownStatus]: 'refusal.unknownStatus',
}

/** A `PICK-0030x` refusal's own sentence key, or null for any other failure (shown in the server's words). */
export function refusalKey(err: unknown): string | null {
  const code = apiErrorCode(err)
  return code ? (REFUSAL_KEYS[code] ?? null) : null
}
