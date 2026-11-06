/**
 * The statistics page's whole query (ticket 485): 484's period, plus the store and the two
 * leave-outs, as the URL holds them and as the door is asked. Pure, pinned by `query.test.ts`.
 *
 * - **Store:** `''` is all stores, the default, and sends no `StoreCode`.
 * - **Leave-outs** mean what they mean on the till — ticked = left out. Wasfaty churned refills are
 *   left out by default (`LeaveOutChurned`); the order types chosen are left out, sent comma-joined
 *   (`LeaveOutTypes`), and none chosen sends nothing.
 *
 * 🔑 The URL is the single source of truth (`useUrlQuery`). After the period's own params come
 * `store`, `leaveOutChurned=false` (only when unticked; ticked is the default and absent) and
 * `leaveOutTypes` (codes, comma-joined in code order, so one choice has one URL), then `courier` (813: one
 * courier type code, absent = all couriers, sent as `Courier`; see `courier-scope.ts`). The three period
 * tabs share them, as on the till. Last comes `track` (491): the per-store table's view; the scope's
 * default view (816: All with all couriers, Delivery under a courier) is absent, and anything unknown
 * reads as that default. It is the table's alone —
 * never asked of the door, so switching it makes no call.
 */
import type { StoreStatisticsQuery } from '@/core/models/delivery-statistics'
import { courierTrack } from './courier-scope'
import { defaultTableTrack, TABLE_TRACKS, type TableTrack } from './store-rows'
import { DEFAULT_PERIOD, periodFromParams, periodToParams, type PeriodQuery, type PeriodTab, type ResolvedPeriod } from './period'

export interface StatisticsQuery extends PeriodQuery {
  /** One store's code, or `''` for all stores. */
  store: string
  /** Ticked = Wasfaty churned refills are left out. */
  leaveOutChurned: boolean
  /** The order-type codes left out: trimmed, unique, in code order. */
  leaveOutTypes: string[]
  /** One courier type code (813), or `''` for all couriers. Sent as written; the server refuses an unknown one. */
  courier: string
  /** The per-store table's view (491): All, or one track. */
  track: TableTrack
}

export const DEFAULT_STATISTICS_QUERY: StatisticsQuery = { ...DEFAULT_PERIOD, store: '', leaveOutChurned: true, leaveOutTypes: [], courier: '', track: 'all' }

/** The table's view a URL names, as written (`all`, `delivery`, `pickUp`); anything else is the scope's default view. */
function readTrack(value: string | null, courier: string): TableTrack {
  return (TABLE_TRACKS as readonly (string | null)[]).includes(value) ? (value as TableTrack) : defaultTableTrack(courier)
}

/** Codes trimmed, blanks dropped, each once, in code order. */
function canonicalTypes(codes: readonly string[]): string[] {
  return [...new Set(codes.map((code) => code.trim()).filter(Boolean))].sort()
}

/** The query a URL describes. Anything unknown reads as its default. */
export function statisticsFromParams(params: URLSearchParams): StatisticsQuery {
  const courier = (params.get('courier') ?? '').trim()
  return {
    ...periodFromParams(params),
    store: (params.get('store') ?? '').trim(),
    leaveOutChurned: params.get('leaveOutChurned') !== 'false',
    leaveOutTypes: canonicalTypes((params.get('leaveOutTypes') ?? '').split(',')),
    courier,
    // Under a courier a pick-up cannot count: a link naming the Pick-up view reads as Delivery (813).
    track: courierTrack(readTrack(params.get('track'), courier), courier),
  }
}

/** The query as its URL: the period's params, then `store`, `leaveOutChurned`, `leaveOutTypes`, `courier` and `track`. */
export function statisticsToParams(query: StatisticsQuery): URLSearchParams {
  const qs = periodToParams(query)
  if (query.store) qs.set('store', query.store)
  if (!query.leaveOutChurned) qs.set('leaveOutChurned', 'false')
  const types = canonicalTypes(query.leaveOutTypes)
  if (types.length > 0) qs.set('leaveOutTypes', types.join(','))
  if (query.courier) qs.set('courier', query.courier)
  // The scope's default view is absent (816): All with all couriers, Delivery under a courier.
  if (query.track !== defaultTableTrack(query.courier)) qs.set('track', query.track)
  return qs
}

/**
 * The `GET SdDocumentWeb/StoreStatistics` parameters for a period that resolved, named as the door
 * names them. No store omits `StoreCode`; no types omits `LeaveOutTypes`; all couriers omits `Courier`.
 */
export function buildStatisticsQuery(period: Extract<ResolvedPeriod, { ok: true }>, query: StatisticsQuery): StoreStatisticsQuery {
  const built: StoreStatisticsQuery = { From: period.from, To: period.to, Granularity: period.granularity, LeaveOutChurned: query.leaveOutChurned }
  if (query.store) built.StoreCode = query.store
  const types = canonicalTypes(query.leaveOutTypes)
  if (types.length > 0) built.LeaveOutTypes = types.join(',')
  if (query.courier) built.Courier = query.courier
  return built
}

/**
 * A courier chosen (`''` = all couriers). A new scope re-opens the table on that scope's default view (816):
 * Delivery under a courier, All with all couriers. The same scope keeps the view, minus the Pick-up view a
 * courier cannot have.
 */
export function withCourier(query: StatisticsQuery, courier: string): StatisticsQuery {
  const track = courier === query.courier ? courierTrack(query.track, courier) : defaultTableTrack(courier)
  return { ...query, courier, track }
}

/** One order type ticked in (left out) or out (counted again). */
export function withLeaveOutType(query: StatisticsQuery, code: string, leftOut: boolean): StatisticsQuery {
  const rest = query.leaveOutTypes.filter((type) => type !== code)
  return { ...query, leaveOutTypes: canonicalTypes(leftOut ? [...rest, code] : rest) }
}

/** The statistics read's TanStack key: the tab rides along, so Today's answer is never Yesterday's for the same day. */
export type StatisticsKey = readonly ['delivery-statistics', PeriodTab, StoreStatisticsQuery | null]

export const statisticsKey = (tab: PeriodTab, params: StoreStatisticsQuery | null): StatisticsKey => ['delivery-statistics', tab, params]

/**
 * Whether the page keeps the previous answer on screen (dimmed, ticket 815) while the next key loads.
 * A refetch of the SAME key (the 5-minute Today refresh) always keeps its answer — TanStack's own
 * behaviour. Across keys, only Today rolling over midnight keeps it: the same tab and the same scope,
 * only the day moved on. A new tab, store or leave-out never shows the previous figures as if current.
 */
export function keepsPreviousAnswer(prev: readonly unknown[] | undefined, next: StatisticsKey): boolean {
  if (!prev || prev[1] !== 'today' || next[1] !== 'today') return false
  const a = prev[2] as StoreStatisticsQuery | null
  const b = next[2]
  if (!a || !b) return false
  return a.StoreCode === b.StoreCode && a.LeaveOutChurned === b.LeaveOutChurned && a.LeaveOutTypes === b.LeaveOutTypes && a.Courier === b.Courier && a.Granularity === b.Granularity
}
