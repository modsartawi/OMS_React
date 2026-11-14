/**
 * The expired approval picks report's week, filters and drill (BackOffice ticket 3874). Pure, pinned by `filters.test.ts`.
 *
 * Dates are local `yyyy-MM-dd` calendar days (`no-utc-time`). The week is the door's: Sunday to Saturday, local.
 */
import {
  EXPIRED_APPROVAL_PICK_OUTCOMES,
  type ExpiredApprovalPickOutcome,
  type ExpiredApprovalPickPharmacist,
  type ExpiredApprovalPickQuery,
  type ExpiredApprovalPickRow,
} from '@/core/models/expired-approval-pick'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

export const REPORT_TABS = ['pharmacists', 'picks'] as const
export type ReportTab = (typeof REPORT_TABS)[number]

/** The group filter on the Picks tab: `''` = both groups. */
export const OUTCOMES = ['', EXPIRED_APPROVAL_PICK_OUTCOMES.soldNotBilled, EXPIRED_APPROVAL_PICK_OUTCOMES.neverSold] as const
export type OutcomeFilter = '' | ExpiredApprovalPickOutcome

/** The one store and pharmacist the Picks tab is narrowed to. A blank `pharmacist` is the row nobody could be named as. */
export interface PharmacistDrill {
  store: string
  pharmacist: string
}

/** The screen's whole query, as its URL holds it. `week` is a Sunday, or `''` for the newest week filled. */
export interface ReportFilters {
  tab: ReportTab
  week: string
  stores: string
  outcome: OutcomeFilter
  drill: PharmacistDrill | null
}

export const DEFAULT_FILTERS: ReportFilters = { tab: 'pharmacists', week: '', stores: '', outcome: '', drill: null }

/** A strict `yyyy-MM-dd` that names a real day (`2026-02-30` does not). */
function realDay(value: string): Date | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value.trim() ? date : null
}

/** The Sunday of the week `day` falls in (the door's `WeekOf`), or `''` for a blank or impossible day. */
export function weekStartOf(day: string): string {
  const date = realDay(day)
  if (!date) return ''
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()))
}

/** The Sunday `by` weeks from `weekStart` (a Sunday). */
export function stepWeek(weekStart: string, by: number): string {
  const date = realDay(weekStart)
  if (!date) return ''
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * by))
}

/** True while `weekStart` is before the week `now` falls in: no fill is written past the current week. */
export function canStepForward(weekStart: string, now: Date): boolean {
  return weekStart !== '' && weekStart < weekStartOf(toIsoDate(now))
}

/** The stores box as the door reads it: codes split on commas or spaces, trimmed, upper-cased, de-duplicated. */
export function normalizeStores(value: string): string {
  const codes = value
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return [...new Set(codes)].join(',')
}

/**
 * The filters a URL describes. Anything unknown reads as its default; any day of a week reads as its Sunday. The drill
 * is on while `store` is present, so `pharmacist=` (blank) still names the unnamed row.
 */
export function filtersFromParams(params: URLSearchParams): ReportFilters {
  const tab = params.get('tab') as ReportTab | null
  const outcome = (params.get('outcome') ?? '').trim().toUpperCase()
  const store = (params.get('store') ?? '').trim().toUpperCase()
  return {
    tab: tab && (REPORT_TABS as readonly string[]).includes(tab) ? tab : 'pharmacists',
    week: weekStartOf(params.get('week') ?? ''),
    stores: normalizeStores(params.get('stores') ?? ''),
    outcome: (OUTCOMES as readonly string[]).includes(outcome) ? (outcome as OutcomeFilter) : '',
    drill: store ? { store, pharmacist: (params.get('pharmacist') ?? '').trim() } : null,
  }
}

/** The filters as their URL: `tab` (when not Pharmacists), then each non-blank filter, then the drill. */
export function filtersToParams(filters: ReportFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.tab !== 'pharmacists') qs.set('tab', filters.tab)
  if (filters.week) qs.set('week', filters.week)
  if (filters.stores) qs.set('stores', filters.stores)
  if (filters.outcome) qs.set('outcome', filters.outcome)
  if (filters.drill) {
    qs.set('store', filters.drill.store)
    qs.set('pharmacist', filters.drill.pharmacist)
  }
  return qs
}

/** What the report read sends: the week's Sunday (absent = the newest week filled) and the stores (absent = every store). */
export function reportQuery(filters: ReportFilters): ExpiredApprovalPickQuery {
  return {
    ...(filters.week ? { week: filters.week } : {}),
    ...(filters.stores ? { stores: filters.stores } : {}),
  }
}

/** The filters after a pharmacist row is opened: the Picks tab, narrowed to that store and pharmacist. */
export function drillInto(filters: ReportFilters, row: Pick<ExpiredApprovalPickPharmacist, 'storeCode' | 'pharmacist'>): ReportFilters {
  return { ...filters, tab: 'picks', drill: { store: row.storeCode, pharmacist: row.pharmacist } }
}

/**
 * The picks the Picks tab shows, in the door's order: the drill's store and pharmacist (both exact, so the unnamed row
 * keeps only the picks with no name), then the group.
 */
export function picksShown(rows: readonly ExpiredApprovalPickRow[], filters: ReportFilters): ExpiredApprovalPickRow[] {
  const { drill, outcome } = filters
  return rows.filter(
    (r) =>
      (!drill || (r.storeCode === drill.store && r.pharmacist === drill.pharmacist)) && (!outcome || r.outcome === outcome),
  )
}

export interface WeekTotals {
  picks: number
  soldNotBilled: number
  neverSold: number
  units: number
  stores: number
  /** Store-and-pharmacist rows: one person at two stores is two. */
  pharmacists: number
}

/** The week's tiles: the door's per-pharmacist counts added up, and the stores and pharmacist rows named. */
export function weekTotals(pharmacists: readonly ExpiredApprovalPickPharmacist[]): WeekTotals {
  const soldNotBilled = pharmacists.reduce((n, p) => n + p.soldNotBilled, 0)
  const neverSold = pharmacists.reduce((n, p) => n + p.neverSold, 0)
  return {
    picks: soldNotBilled + neverSold,
    soldNotBilled,
    neverSold,
    units: pharmacists.reduce((n, p) => n + p.units, 0),
    stores: new Set(pharmacists.map((p) => p.storeCode)).size,
    pharmacists: pharmacists.length,
  }
}
