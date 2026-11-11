import type { AnalyticsLabel } from './analytics'

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
