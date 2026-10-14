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
 * `leaveOutTypes` (codes, comma-joined in code order, so one choice has one URL). The three period
 * tabs share them, as on the till. Last comes `track` (491): the per-store table's view, `delivery` or
 * `pickUp`; All is the default and absent, and anything unknown reads as All. It is the table's alone —
 * never asked of the door, so switching it makes no call.
 */
import type { StoreStatisticsQuery } from '@/core/models/delivery-statistics'
import { TABLE_TRACKS, type TableTrack } from './store-rows'
import { DEFAULT_PERIOD, periodFromParams, periodToParams, type PeriodQuery, type ResolvedPeriod } from './period'

export interface StatisticsQuery extends PeriodQuery {
  /** One store's code, or `''` for all stores. */
  store: string
  /** Ticked = Wasfaty churned refills are left out. */
  leaveOutChurned: boolean
  /** The order-type codes left out: trimmed, unique, in code order. */
  leaveOutTypes: string[]
  /** The per-store table's view (491): All, or one track. */
  track: TableTrack
}

export const DEFAULT_STATISTICS_QUERY: StatisticsQuery = { ...DEFAULT_PERIOD, store: '', leaveOutChurned: true, leaveOutTypes: [], track: 'all' }

/** The table's view a URL names, as written (`delivery`, `pickUp`); anything else is All. */
function readTrack(value: string | null): TableTrack {
  return (TABLE_TRACKS as readonly (string | null)[]).includes(value) ? (value as TableTrack) : 'all'
}

/** Codes trimmed, blanks dropped, each once, in code order. */
function canonicalTypes(codes: readonly string[]): string[] {
  return [...new Set(codes.map((code) => code.trim()).filter(Boolean))].sort()
}

/** The query a URL describes. Anything unknown reads as its default. */
export function statisticsFromParams(params: URLSearchParams): StatisticsQuery {
  return {
    ...periodFromParams(params),
    store: (params.get('store') ?? '').trim(),
    leaveOutChurned: params.get('leaveOutChurned') !== 'false',
    leaveOutTypes: canonicalTypes((params.get('leaveOutTypes') ?? '').split(',')),
    track: readTrack(params.get('track')),
  }
}

/** The query as its URL: the period's params, then `store`, `leaveOutChurned`, `leaveOutTypes` and `track`. */
export function statisticsToParams(query: StatisticsQuery): URLSearchParams {
  const qs = periodToParams(query)
  if (query.store) qs.set('store', query.store)
  if (!query.leaveOutChurned) qs.set('leaveOutChurned', 'false')
  const types = canonicalTypes(query.leaveOutTypes)
  if (types.length > 0) qs.set('leaveOutTypes', types.join(','))
  if (query.track !== 'all') qs.set('track', query.track)
  return qs
}

/**
 * The `GET SdDocumentWeb/StoreStatistics` parameters for a period that resolved, named as the door
 * names them. No store omits `StoreCode`; no types omits `LeaveOutTypes`.
 */
export function buildStatisticsQuery(period: Extract<ResolvedPeriod, { ok: true }>, query: StatisticsQuery): StoreStatisticsQuery {
  const built: StoreStatisticsQuery = { From: period.from, To: period.to, Granularity: period.granularity, LeaveOutChurned: query.leaveOutChurned }
  if (query.store) built.StoreCode = query.store
  const types = canonicalTypes(query.leaveOutTypes)
  if (types.length > 0) built.LeaveOutTypes = types.join(',')
  return built
}

/** One order type ticked in (left out) or out (counted again). */
export function withLeaveOutType(query: StatisticsQuery, code: string, leftOut: boolean): StatisticsQuery {
  const rest = query.leaveOutTypes.filter((type) => type !== code)
  return { ...query, leaveOutTypes: canonicalTypes(leftOut ? [...rest, code] : rest) }
}
