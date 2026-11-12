import type { AnalyticsItem, AnalyticsLabel } from './analytics'

/**
 * A SQL item (BackOffice spec 3632 Q39–Q42, server ticket 3675; web 889). A view whose definition is a statement, not an
 * analytics query: `{ statement, question, chart }`. Saved Personal, never Certified.
 *
 * ```
 * POST Analytics/Item/Sql   (cookie; the view grant on the route; canSql in the store)
 * body  AnalyticsSqlItemCreate
 * 200   the item (AnalyticsItem): kind "view", engine "sql", tier "personal", revision 1, owner = the saver
 * 400   ANALYTICS-428 no SQL grant · ANALYTICS-401 no view grant
 *       ANALYTICS-406 data { field }: statement | question | chart.type | chart.axis | chart.series |
 *                     chart.values[i].column | chart.values[i].format
 *       ANALYTICS-425 / 408 / 409 data { reason, line, column }: the save's own run was refused
 * ```
 *
 * The server runs the statement once before it stores anything and checks the chart against the columns that came
 * back; it stays the authority. The fit table below exists only to choose what the save dialog offers.
 */

export const ANALYTICS_SQL_CHART_TYPES = ['kpi', 'line', 'area', 'bar', 'donut', 'table', 'heatmap', 'combo'] as const
export type AnalyticsSqlChartType = (typeof ANALYTICS_SQL_CHART_TYPES)[number]

export const ANALYTICS_SQL_FORMATS = ['number', 'money', 'percent'] as const
/** A value column's format; the server's default is `number`. */
export type AnalyticsSqlFormat = (typeof ANALYTICS_SQL_FORMATS)[number]

/** One value column: a result column holding numbers, with its label and format. */
export interface AnalyticsSqlValueColumn {
  column: string
  label: AnalyticsLabel
  format: AnalyticsSqlFormat
}

/** The chart of a SQL item (Q41). Every column named is a result column, the result's spelling. Absent: a table. */
export interface AnalyticsSqlChart {
  type: AnalyticsSqlChartType
  /** The category or date column (every type but `table` and `kpi`). */
  axis?: string
  /** The column whose values split one value into series; a heat map's second axis. */
  series?: string
  values: AnalyticsSqlValueColumn[]
}

/** `POST Analytics/Item/Sql`. */
export interface AnalyticsSqlItemCreate {
  /** The answer's statement, as shown. */
  statement: string
  /** The question that made it; at most `ANALYTICS_SQL_MAX_QUESTION` characters. */
  question: string
  title: AnalyticsLabel
  subtitle?: AnalyticsLabel
  chart?: AnalyticsSqlChart
}

/** `GET Analytics/Item/{id}` on a SQL item: its definition. */
export interface AnalyticsSqlDefinition {
  statement: string
  question: string
  chart: AnalyticsSqlChart
}

export const ANALYTICS_SQL_MAX_QUESTION = 2000
/** `AnalyticsItem.Widths.Title`: each of a title's two words. */
export const ANALYTICS_SQL_MAX_TITLE = 200

/** Why a type is not offered: each is a `<ns>:sqlSave.why.<reason>` key. */
export type AnalyticsSqlUnfitReason = 'noValue' | 'needsAxis' | 'heatmapShape' | 'comboShape'

export type AnalyticsSqlChartOffer =
  | { type: AnalyticsSqlChartType; offered: true }
  | { type: AnalyticsSqlChartType; offered: false; reason: AnalyticsSqlUnfitReason }

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

/**
 * Which result columns hold numbers: every cell that is not NULL is a number in the invariant text the run sends (the
 * server's test is the same over its typed cells, so a column of NULLs passes).
 */
export function numericColumns(columns: readonly string[], rows: readonly (readonly (string | null)[])[]): boolean[] {
  return columns.map((_, i) => rows.every((row) => row[i] === null || row[i] === undefined || NUMBER.test(row[i] as string)))
}

/**
 * The chart types a result's columns fit (Q41), in the wire's order: a type is offered when some choice of axis, series
 * and value columns among these columns fits it (a value column holds numbers; axis, series and values are each a
 * different column).
 */
export function sqlChartOffers(columns: readonly string[], rows: readonly (readonly (string | null)[])[]): AnalyticsSqlChartOffer[] {
  const numbers = numericColumns(columns, rows).filter(Boolean).length
  const all = columns.length
  return ANALYTICS_SQL_CHART_TYPES.map((type): AnalyticsSqlChartOffer => {
    const no = (reason: AnalyticsSqlUnfitReason): AnalyticsSqlChartOffer => ({ type, offered: false, reason })
    if (type === 'table') return { type, offered: true }
    if (numbers === 0) return no('noValue')
    switch (type) {
      case 'kpi':
        return { type, offered: true }
      case 'heatmap':
        return all >= 3 ? { type, offered: true } : no('heatmapShape')
      case 'combo':
        return numbers >= 2 && all >= 3 ? { type, offered: true } : no('comboShape')
      default:
        return all >= 2 ? { type, offered: true } : no('needsAxis')
    }
  })
}

// ── The SQL editor (ticket 890; BackOffice 3672 Run, 3675 SQL items, 3676 verified) ────────────────────────────────

/** `POST Analytics/Sql/Run` (3672): the editor's Run. No cause: the editor's run is always `editor`. */
export interface AnalyticsSqlRunRequest {
  statement: string
}

/**
 * The SQL door's answer (3672): the columns in the database's order, at most 1,000 rows keyed by column (SQL NULL is
 * `null`), `isCut` when there were more, and the statement as the server ran it (laid out, with its cap). `tables`: the
 * analytics tables read (3673). Also a SQL item's kept `sql.result`.
 *
 * ```
 * POST Analytics/Sql/Run   { statement }          (cookie; the view grant on the route)
 * 200  AnalyticsSqlResult
 * 400  ANALYTICS-428 no SQL grant beside the author grant (no data) · ANALYTICS-401 no view grant
 *      ANALYTICS-425 data { reason, line, column }: refused (line/column only for not-parsed)
 *      ANALYTICS-408 data { reason: "timed-out" } · ANALYTICS-409 data { reason: "not-available" }
 * ```
 */
export interface AnalyticsSqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  isCut: boolean
  durationMs: number
  statement: string
  tables: string[]
}

/**
 * A SQL door refusal as the editor shows it, and as a SQL item's read carries it (`sql.refusal`, 3675 Q49). `reason`
 * is one of 3672's (`not-parsed`, `not-one-select`, `table-not-allowed`, `column-not-allowed`, `join-not-on-list`,
 * `facts-not-grouped`, `function-not-allowed`, `too-long`, `busy`, `timed-out`, `not-available`) or the web's
 * `needs-sql-grant` for `ANALYTICS-428`; one not known is kept as sent and the screen shows the server's message.
 * Only `not-parsed` has a `line` and `column` (1-based).
 */
export interface AnalyticsSqlRefusal {
  code: string
  reason: string
  line: number | null
  column: number | null
  message: string
}

/** A SQL item's run on its read (3675 Q47-Q49): the result (kept 15 minutes per revision) or the refusal, or neither. */
export interface AnalyticsSqlItemRun {
  revision: number
  ranAt: string | null
  result: AnalyticsSqlResult | null
  refusal: AnalyticsSqlRefusal | null
}

/**
 * A SQL item (3675, 3676) as `GET Analytics/Item/{id}` answers it: kind `view`, `engine: 'sql'`, its definition
 * `{ statement, question, chart }`. `verified` is a curator's mark (Q44), removed by a save or restore that changes the
 * statement. `actions`: what the server says THIS caller may do (`edit`, `revisions`, `verify`, `unverify`, `copy`, …);
 * absent on an older server.
 *
 * ```
 * PUT  Analytics/Item/{id}            AnalyticsSqlItemUpdate -> the item at a new revision, run first
 *                                     (425/408/409 as Run; 403 not yours; 428 an owner without the SQL grant)
 * POST Analytics/Item/{id}/Revert     { revision } -> the kept snapshot run first, written as a new revision
 * GET  Analytics/Item/{id}/Revisions  [{ revision, savedAt, savedBy, action, revertedFrom }]
 * POST Analytics/Item/{id}/Verify     no body -> the item, verified true  (curators; ANALYTICS-402 otherwise)
 * POST Analytics/Item/{id}/Unverify   no body -> the item, verified false (ANALYTICS-432 not a SQL item;
 *                                     ANALYTICS-409 not-available: the database lacks Sql/011)
 * ```
 */
export type AnalyticsSqlItem = Omit<AnalyticsItem, 'definition' | 'engine' | 'verified'> & {
  engine: 'sql'
  verified: boolean
  definition: AnalyticsSqlDefinition
  sql: AnalyticsSqlItemRun | null
  actions?: string[]
}

/** `PUT Analytics/Item/{id}` on a SQL item (3675). A title left out keeps the current one. */
export interface AnalyticsSqlItemUpdate {
  definition: AnalyticsSqlDefinition
  baseRevision: number
  title?: AnalyticsLabel
  subtitle?: AnalyticsLabel
}

/** 3632 review, item 8: `POST Analytics/Item/{id}/Verify`'s body, the revision the curator is looking at (required). */
export interface AnalyticsSqlVerifyBody {
  baseRevision: number
}

/**
 * What another screen hands the editor when it opens it on a statement that is not yet an item (the copilot's SQL
 * answer): the router state of `NEW_SQL_PATH` (`@/core/analytics-routes`). In `core` because the copilot links there by route string and
 * may not import the analytics feature.
 */
export interface AnalyticsSqlEditorSeed {
  statement: string
  question?: string
  /**
   * Q46: on a SQL item's own editor (`sqlEditHref`), the revision the copilot opened the item at, so the Save's
   * `baseRevision` is that one, not the one loaded since (a save in between is then `ANALYTICS-405`).
   */
  baseRevision?: number
}

// ── A SQL item on a board and in a report (ticket 891; BackOffice 3677, spec 3632 Q43, Q47-Q49) ────────────────────

/**
 * A SQL panel's answer: `POST Analytics/Query { itemId, revision?, panelId, values }` (also `{ draft, panelId, values }`
 * and the print page's `Analytics/Render/Query`) on a board panel or report block naming a SQL item. The statement runs
 * through the SQL door as the reader, kept 15 minutes per revision (3675). Rides on `AnalyticsQueryResult` as `sql`,
 * beside `engine: 'sql'`, empty `columns`/`rows`, `fetchedAt` = `ranAt` (or `""`), and `notReached` listing every
 * parameter with reason `sqlPanel` (Q48: "filters do not apply to this SQL panel").
 *
 * ```
 * 200  { engine: "sql", columns: [], rows: [], total: 0, truncated: false, fetchedAt, dataAsOf: "",
 *        notReached: [{ param, reason: "sqlPanel" }, …every parameter], sql: AnalyticsSqlPanelAnswer }
 * 404  ANALYTICS-404 the reader may not see the SQL item (as a Cube view panel)
 * ```
 *
 * A statement that no longer runs (a column off the allow-list, a join off the join list) is a `refusal`, never an
 * error: the panel shows the reason in place of the chart (Q49), and the statement is never rewritten.
 */
export interface AnalyticsSqlPanelAnswer {
  itemId: string
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  /** 3675's shape; `{ type: "table" }` by default. */
  chart: AnalyticsSqlChart
  /** Always `false` in spec 3632. */
  filtersApply: boolean
  /** 3676: a curator's mark — "SQL, verified". */
  verified: boolean
  revision: number
  ranAt: string | null
  result: AnalyticsSqlResult | null
  refusal: AnalyticsSqlRefusal | null
}

/** The reason a parameter does not reach a SQL panel (`notReached[].reason`, BackOffice `AnalyticsBindReasons.SqlPanel`). */
export const ANALYTICS_SQL_PANEL_REASON = 'sqlPanel'
