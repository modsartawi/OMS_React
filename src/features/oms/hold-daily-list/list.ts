/**
 * HQ's daily list of holds that should have ended (BackOffice ticket 3872): its filters, URL, totals, store matrix and
 * ages. Pure, pinned by `list.test.ts`.
 *
 * Times are local wall-clock (`no-utc-time`): `"yyyy-MM-ddTHH:mm:ss"` read as local, never through UTC.
 */
import { isBlankDate } from '@/core/util/date-format'
import {
  HOLD_DAILY_LIST_KINDS,
  type HoldDailyListCount,
  type HoldDailyListKind,
  type HoldDailyListQuery,
  type HoldDailyListRow,
} from '@/core/models/hold-daily-list'

export const LIST_TABS = ['rows', 'stores'] as const
export type ListTab = (typeof LIST_TABS)[number]

/** The screen's whole query, as its URL holds it. Blank = no narrowing. `store` is the one store a Stores row opened. */
export interface ListFilters {
  tab: ListTab
  kind: string
  cause: string
  stores: string
  store: string
}

export const DEFAULT_FILTERS: ListFilters = { tab: 'rows', kind: '', cause: '', stores: '', store: '' }

const upper = (value: string | null) => (value ?? '').trim().toUpperCase()
const oneOf = (value: string, known: readonly string[]) => (known.includes(value) ? value : '')

/** The stores box as the door reads it: codes split on commas, semicolons or spaces, upper-cased, de-duplicated. */
export function normalizeStores(value: string): string {
  const codes = value
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  return [...new Set(codes)].join(',')
}

/** The causes a kind's rows name (`HoldDailyListCauses`), in the door's order; none for a kind with one reason. */
const CAUSES_BY_KIND: Readonly<Record<string, readonly string[]>> = {
  DONOR_WAITS_GI: ['SOLD_NOT_TRANSFERRED', 'TRANSFER_FAILED'],
  WAITING_OVER_1H: ['UNTRACED'],
  DELIVERED_NO_SALE: ['STANDING', 'ENDED_BY_SWEEP'],
}

/** The causes the cause filter offers for `kind` (blank = every kind: none, the filter is hidden). */
export function causesOf(kind: string): string[] {
  return [...(CAUSES_BY_KIND[kind] ?? [])]
}

/** The filters after the kind is changed: the held units open, and a cause the new kind does not name is dropped. */
export function withKind(filters: ListFilters, kind: string): ListFilters {
  return { ...filters, tab: 'rows', kind, cause: causesOf(kind).includes(filters.cause) ? filters.cause : '' }
}

/** The filters a URL describes. Anything unknown reads as its default, and a cause its kind does not name as none. */
export function filtersFromParams(params: URLSearchParams): ListFilters {
  const tab = params.get('tab') ?? ''
  const kind = oneOf(upper(params.get('kind')), HOLD_DAILY_LIST_KINDS)
  return {
    tab: (LIST_TABS as readonly string[]).includes(tab) ? (tab as ListTab) : 'rows',
    kind,
    cause: oneOf(upper(params.get('cause')), causesOf(kind)),
    stores: normalizeStores(params.get('stores') ?? ''),
    store: upper(params.get('store')),
  }
}

/** The filters as their URL: `tab` (when not the held units), then each non-blank filter. */
export function filtersToParams(filters: ListFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.tab !== 'rows') qs.set('tab', filters.tab)
  if (filters.kind) qs.set('kind', filters.kind)
  if (filters.cause) qs.set('cause', filters.cause)
  if (filters.stores) qs.set('stores', filters.stores)
  if (filters.store) qs.set('store', filters.store)
  return qs
}

/**
 * What the list read sends: the stores only (absent = the fleet). The kind narrows on the screen, so the six tiles keep
 * their counts whichever kind is open.
 */
export function listQuery(filters: ListFilters): HoldDailyListQuery {
  return filters.stores ? { stores: filters.stores } : {}
}

/** The held units the Held units tab shows, in the door's order: the kind, the cause and the drilled store, each exact. */
export function rowsShown(rows: readonly HoldDailyListRow[], filters: ListFilters): HoldDailyListRow[] {
  const { kind, cause, store } = filters
  return rows.filter(
    (r) => (!kind || r.kind === kind) && (!cause || r.cause === cause) && (!store || r.storeCode === store),
  )
}

export interface KindTotal {
  rows: number
  heldQuantity: number
}

/** The six tiles: the door's per-store counts added up per kind, every kind present (zero when none was sent). */
export function kindTotals(counts: readonly HoldDailyListCount[]): Record<HoldDailyListKind, KindTotal> {
  const totals = Object.fromEntries(HOLD_DAILY_LIST_KINDS.map((k) => [k, { rows: 0, heldQuantity: 0 }])) as Record<
    HoldDailyListKind,
    KindTotal
  >
  for (const c of counts) {
    const total = totals[c.kind as HoldDailyListKind]
    if (!total) continue
    total.rows += c.rows
    total.heldQuantity += c.heldQuantity
  }
  return totals
}

/** One store of the Stores tab: its rows and held quantity, and its rows per kind (the Return POs read per store here). */
export type StoreLine = { storeCode: string; rows: number; heldQuantity: number } & Record<HoldDailyListKind, number>

/** The door's counts as one line per store, a column per kind, ordered by store code. */
export function storeMatrix(counts: readonly HoldDailyListCount[]): StoreLine[] {
  const lines = new Map<string, StoreLine>()
  for (const c of counts) {
    let line = lines.get(c.storeCode)
    if (!line) {
      line = {
        storeCode: c.storeCode,
        rows: 0,
        heldQuantity: 0,
        ...(Object.fromEntries(HOLD_DAILY_LIST_KINDS.map((k) => [k, 0])) as Record<HoldDailyListKind, number>),
      }
      lines.set(c.storeCode, line)
    }
    line.rows += c.rows
    line.heldQuantity += c.heldQuantity
    if ((HOLD_DAILY_LIST_KINDS as readonly string[]).includes(c.kind)) line[c.kind as HoldDailyListKind] += c.rows
  }
  return [...lines.values()].sort((a, b) => (a.storeCode < b.storeCode ? -1 : a.storeCode > b.storeCode ? 1 : 0))
}

/** A local wall-clock stamp as a Date, or null for a blank, unreadable or `0001-01-01` one. */
function localTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return isBlankDate(date) ? null : date
}

export interface AgeParts {
  days: number
  hours: number
  minutes: number
}

/** How long a hold has stood: from `since` to the answer's `asOf`, whole minutes. Null when either is unreadable or `since` is later. */
export function ageParts(since: string, asOf: string): AgeParts | null {
  const from = localTime(since)
  const to = localTime(asOf)
  if (!from || !to || from > to) return null
  const minutes = Math.floor((to.getTime() - from.getTime()) / 60_000)
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 }
}

/** A daily fill this old has been missed (a day, and two hours for the hourly tick and the fill's own run). */
export const STALE_AFTER_MS = 26 * 3_600_000

/**
 * True when the list is not today's: never filled, or filled more than {@link STALE_AFTER_MS} before `asOf`. A failed Stock
 * Visibility read leaves yesterday's list standing, and this is how the screen says so.
 */
export function isStale(filledAt: string | null, asOf: string): boolean {
  const filled = localTime(filledAt)
  const now = localTime(asOf)
  if (!filled) return true
  return !!now && now.getTime() - filled.getTime() > STALE_AFTER_MS
}
