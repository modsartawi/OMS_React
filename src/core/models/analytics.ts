/**
 * The analytics doors' wire (spec 766 §C — PROPOSED, owned by BackOffice 3378 once filed).
 *
 * ⚠ Drift rule: a `400` on the first live call is a drift report. Correct the BackOffice spec first,
 * then this transcription — never the transcription alone.
 *
 * Where §C names a field but not its exact shape, the choice made here is marked ⚠ (ticket 767).
 * Every array is read through `features/analytics/boards/wire.ts`, which turns an absent array into an
 * empty one, so nothing downstream checks for `undefined`.
 */

/** A model label or title in both languages (766 §B: labels live with the member, in en and ar). */
export interface AnalyticsLabel {
  en: string
  ar: string
}

/** `GET Analytics/Access`. Absent or unreachable means denied (the OMS probe pattern). */
export interface AnalyticsAccess {
  canView: boolean
  canCurate: boolean
}

export type MeasureShape = 'additive' | 'rate' | 'percentile'
export type MeasureUnit = 'count' | 'SAR' | 'minutes' | 'seconds' | 'km' | 'share'

export interface AnalyticsArea {
  key: string
  available: boolean
  /** ⚠ A server sentence; §C does not say whether it is bilingual. */
  unavailableReason?: string | null
}

export interface AnalyticsMeasure {
  key: string
  area: string
  shape: MeasureShape
  unit: MeasureUnit
  maxWindowDays?: number | null
  label: AnalyticsLabel
  description: AnalyticsLabel
  /** The dimension keys this measure may be broken down by. ⚠ Field name not fixed by §C. */
  dimensions: string[]
}

/** A small, fixed dimension's value, served inline (channel group, country). */
export interface AnalyticsDimensionValue {
  key: string
  /** ⚠ Bilingual like every model label (§C gives `{ key, label }` only for `DimensionValues`). */
  label: AnalyticsLabel
}

export interface AnalyticsDimension {
  key: string
  kind: 'time' | 'category'
  label: AnalyticsLabel
  /**
   * Inline when the list is small and fixed. Its ORDER is the catalogue's, and a dimension served
   * with values gets a fixed colour slot per value (766 §F: channel groups and countries).
   */
  values: AnalyticsDimensionValue[]
}

/** `GET Analytics/Model` — the catalogue the screens and the AI share. */
export interface AnalyticsModel {
  areas: AnalyticsArea[]
  measures: AnalyticsMeasure[]
  dimensions: AnalyticsDimension[]
}

/** The eight chart types (766 §E). Slice 0 (767) draws `bar` vertical; 768/769 add the rest. */
export type AnalyticsChartType = 'kpi' | 'line' | 'area' | 'bar' | 'donut' | 'table' | 'heatmap' | 'combo'

/** ⚠ 766 §C does not fix a definition shape; this is the web's proposal, mirroring `semantic_query`. */
export interface AnalyticsFilter {
  dimension: string
  values: string[]
}

export interface AnalyticsSemanticQuery {
  measures: string[]
  dimensions: string[]
  filters: AnalyticsFilter[]
  /** A relative period token ("last-30-days"), resolved by the server in Riyadh time. */
  period?: string | null
  grain?: string | null
  limit?: number | null
  compareToPrevious?: boolean
}

/** The editor's number formats (755 item 4). `auto` follows the measure's unit. */
export type AnalyticsNumberFormat = 'auto' | 'integer' | 'decimal' | 'percent' | 'SAR' | 'minutes'

export interface AnalyticsChart {
  type: AnalyticsChartType
  /** Bars only: vertical (the default) or horizontal. */
  orientation?: 'vertical' | 'horizontal'
  /**
   * Bars with two or more series (768): stacked or grouped (the default). ⚠ Field name not fixed by §C.
   * A stacked area is always stacked. A rate or percentile measure is never stacked (766 §E).
   */
  stack?: 'stacked' | 'grouped'
  /** ⚠ The definition's number format (766 story 43); absent means `auto`. */
  format?: AnalyticsNumberFormat
  /** ⚠ Table only (769): the column a table is sorted by, and how. Default: the first measure, largest first. */
  sort?: { key: string; direction: 'asc' | 'desc' } | null
  /** ⚠ Table only (769): keep the first N rows after the sort. Absent → every row. */
  topN?: number | null
  /** ⚠ The legend's place (755 item 4, ticket 775): hidden, top, bottom or end. Absent → the form's default. */
  legend?: AnalyticsLegendPosition
}

export type AnalyticsLegendPosition = 'hidden' | 'top' | 'bottom' | 'end'

/** An analytics view's definition. */
export interface AnalyticsViewDefinition {
  chart: AnalyticsChart
  query: AnalyticsSemanticQuery
  /**
   * The saved member → colour slot map, per breakdown dimension (766 §F: written when the view is
   * saved). Ignored for a dimension with inline values, whose slots are fixed.
   */
  slots?: Record<string, Record<string, number>>
}

export type AnalyticsTier = 'personal' | 'shared' | 'certified'

/** `GET Analytics/Item/{id}` — a view or a board in the analytics store. */
export interface AnalyticsItem {
  id: string
  kind: 'view' | 'board'
  /** Empty by default for an AI view: the screen then generates one from the model labels. */
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  owner: string
  tier: AnalyticsTier
  certifiedFrom?: string | null
  copiedFrom?: string | null
  sourceChangedSinceCopy: boolean
  revision: number
  updatedAt: string
  updatedBy: string
  definition: AnalyticsViewDefinition
}

/**
 * `POST Analytics/Item` — the body of a new item (ticket 775). ⚠ §C names the door, not its body: the
 * server makes it Personal to the caller and answers the whole item. An empty title is generated on screen.
 */
export interface AnalyticsItemCreate {
  kind: 'view' | 'board'
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  definition: AnalyticsViewDefinition
}

/** `POST Analytics/Query` — a saved view by id, or an inline definition while editing. */
export type AnalyticsQueryInput = (
  | { viewId: string; revision?: number }
  | { definition: AnalyticsViewDefinition }
) & {
  /** The board filters that reach this panel (771), canonical: sorted by dimension, values sorted. */
  filters?: AnalyticsFilter[]
  /**
   * ⚠ The board's period, overriding the view's own (771). A relative token ("last-30-days") the server
   * resolves, or a fixed range written `from..to` (ISO days). Absent: the view's own period.
   */
  period?: string
  /**
   * ⚠ The cross-filter (772): the one member clicked on another panel, `{ dimension, values: [member] }`.
   * Absent when it does not reach this panel (its source, opted out, or a dimension its measures lack).
   */
  crossFilter?: AnalyticsFilter | null
  compareToPrevious?: boolean
}

export interface AnalyticsColumn {
  key: string
  role: 'dimension' | 'measure'
  shape?: MeasureShape | null
  unit?: MeasureUnit | null
}

/** ⚠ A row is an object keyed by column key (Cube's own shape); §C says `rows[]` only. */
export type AnalyticsRow = Record<string, string | number | null>

export interface AnalyticsQueryResult {
  columns: AnalyticsColumn[]
  rows: AnalyticsRow[]
  total: number
  truncated: boolean
  period: { from: string; to: string } | null
  /** Present when `compareToPrevious` was asked. */
  previous: AnalyticsRow[]
  fetchedAt: string
  /** The newest source event time of the last good run, from `mart_load_log`. */
  dataAsOf: string
}

// ── Boards (ticket 771) ──────────────────────────────────────────────────────────────────────────────
// ⚠ 766 §C names the board as an item kind but fixes no definition shape: this is the web's proposal.

/** The board filters a panel can opt out of (766 §F), and the cross-filter (772). */
export type BoardFilterKey = 'period' | 'city' | 'region' | 'store' | 'channel' | 'country' | 'crossFilter'

/** The relative period tokens (766 story 21), resolved by the server in Riyadh time with Sunday weeks. */
export type PeriodToken =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'last-7-days'
  | 'last-28-days'
  | 'last-30-days'
  | 'this-month'
  | 'last-month'
  | 'year-to-date'

/** A relative period (stays relative in the permalink and on the wire), or a fixed range of ISO days. */
export type BoardPeriod = { kind: 'relative'; token: PeriodToken } | { kind: 'fixed'; from: string; to: string }

/** The filter strip's state: the period plus the member lists of the five category filters. */
export interface BoardFilters {
  period: BoardPeriod
  city: string[]
  region: string[]
  store: string[]
  channel: string[]
  country: string[]
}

/** A panel's place on the 12-column grid, in logical (writing-mode) columns and fixed row units. */
export interface BoardLayout {
  x: number
  y: number
  w: number
  h: number
}

/** A board panel: a view linked by reference, a text panel, or a section header. */
export type AnalyticsBoardPanel =
  | { id: string; kind: 'view'; viewId: string; layout: BoardLayout; optOut: BoardFilterKey[] }
  | { id: string; kind: 'text'; text: AnalyticsLabel; layout: BoardLayout }
  | { id: string; kind: 'section'; title: AnalyticsLabel; layout: BoardLayout }

export interface AnalyticsBoardDefinition {
  panels: AnalyticsBoardPanel[]
  /** The board's saved filters, which the strip opens on when the URL names none. */
  filters?: Partial<BoardFilters>
  /** ⚠ (780) The board's saved auto-refresh default; a viewer's change lasts for their session only. */
  refresh?: RefreshInterval
}

/** A board's auto-refresh interval (spec 766 §F): the picker's choices and the permalink's `refresh=`. */
export type RefreshInterval = 'off' | '30s' | '1m' | '5m' | '15m'

/** A board in the analytics store: an item whose definition is a board's. */
export type AnalyticsBoard = Omit<AnalyticsItem, 'definition' | 'kind'> & { kind: 'board'; definition: AnalyticsBoardDefinition }

/** `GET Analytics/DimensionValues` — one member for the store, city and region pickers. */
export interface AnalyticsMember {
  key: string
  /** ⚠ §C gives `label` without its shape: a plain string is read as both languages. */
  label: AnalyticsLabel
}
