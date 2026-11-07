import { apiErrorCode } from '@/core/api'
import type { AnalyticsAccess, AnalyticsCatalogMart, AnalyticsRawPreview, AnalyticsRawPreviewRequest, AnalyticsRawValue } from '@/core/models/analytics'
import { canCurateAnalytics } from './access'
import { analyticsRefusal, type AnalyticsRefusal } from './wire'

/**
 * A curator's raw preview of a mart / fact / dim (BackOffice spec 3437 §G, BO 3442; ticket 844). Pure: no React.
 *
 * Curator-only twice over: the server nulls `columns/rows/sizeMb` for everyone else and refuses the Raw door with
 * `ANALYTICS-402`, and the web hides the action, the hidden-column note, the row count and the size unless the probe
 * says `canCurate` (ruling 7: non-curators see none of these — the built door gives them no count).
 */
export interface RawOffer {
  /** The mart's row count (`sys.partitions`); null for a view. */
  rows: number | null
  /** Reserved MB; null for a view. */
  sizeMb: number | null
  /** The table's columns not on the allow-list — the "N columns hidden" note. */
  hiddenColumns: number
  /** The allow-listed columns, table order: the only ones the order-by picker offers (and the server selects). */
  orderBy: string[]
}

/** What a curator gets on this mart node; `null` = nothing (not a curator, no mart, or its columns unread). */
export function rawOffer(mart: AnalyticsCatalogMart | null, probe: AnalyticsAccess | null | undefined): RawOffer | null {
  if (!mart || !mart.columns || !canCurateAnalytics(probe)) return null
  return {
    rows: mart.rows,
    sizeMb: mart.sizeMb,
    hiddenColumns: mart.columns.filter((c) => !c.previewable).length,
    orderBy: mart.columns.filter((c) => c.previewable).map((c) => c.name),
  }
}

/** The reader's order choice; `null` = not chosen yet (the server's defaults). */
export interface RawOrder {
  orderBy: string
  descending: boolean
}

/**
 * The Raw door's body. Only a listed column is ever sent as `orderBy` (a hidden one would be `ANALYTICS-406`); a
 * choice off the list, or none, is the first listed column. With no listed column `orderBy` is left out, so the
 * server answers `ANALYTICS-417` (not previewable). Descending unless the reader chose ascending.
 */
export function rawRequest(mart: string, offer: RawOffer, order: RawOrder | null): AnalyticsRawPreviewRequest {
  const orderBy = order && offer.orderBy.includes(order.orderBy) ? order.orderBy : offer.orderBy[0]
  const descending = order ? order.descending : true
  return orderBy ? { mart, orderBy, descending } : { mart, descending }
}

/**
 * ── 844's refusal words (ruling 13) ──
 * The raw preview's own wording of a refusal: its timeout is 10 s (`catalog.raw.timedOut`), not the panel's 30 s.
 * Everything else as every analytics door (`analyticsRefusal`), which words 402 (needs curator) and 417 (not
 * previewable) itself; an unknown code keeps the server's message.
 */
const RAW_REFUSAL_KEYS: Record<string, string> = {
  'ANALYTICS-408': 'catalog.raw.timedOut',
}

export function rawRefusal(err: unknown, fallback: string): AnalyticsRefusal {
  const code = apiErrorCode(err)
  const key = code ? RAW_REFUSAL_KEYS[code] : undefined
  return key ? { code, key } : analyticsRefusal(err, fallback)
}

const rawValue = (v: unknown): AnalyticsRawValue =>
  typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) ? v : v == null ? null : JSON.stringify(v)

/**
 * The Raw door's answer, tolerantly: the listed columns (blank names dropped), each row keyed by them (a value of
 * another shape reads as its JSON text, a missing one as null), and the hidden count (0 when absent).
 */
export function readRaw(raw: unknown): AnalyticsRawPreview {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const columns = (Array.isArray(r.columns) ? r.columns : []).filter((c): c is string => typeof c === 'string' && c !== '')
  const rows = (Array.isArray(r.rows) ? r.rows : []).map((x) => {
    const row = x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
    return Object.fromEntries(columns.map((c) => [c, rawValue(row[c])]))
  })
  const hidden = typeof r.hiddenColumnCount === 'number' && Number.isFinite(r.hiddenColumnCount) ? r.hiddenColumnCount : 0
  return { columns, rows, hiddenColumnCount: hidden }
}
