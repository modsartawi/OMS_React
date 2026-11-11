import type { AnalyticsLabel } from '@/core/models/analytics'
import {
  ANALYTICS_SQL_MAX_QUESTION,
  ANALYTICS_SQL_MAX_TITLE,
  numericColumns,
  type AnalyticsSqlChart,
  type AnalyticsSqlChartType,
  type AnalyticsSqlItemCreate,
  type AnalyticsSqlValueColumn,
} from '@/core/models/analytics-sql'
import type { AnswerSql } from './answer'

/**
 * The SQL answer's save dialog (ticket 889, BackOffice spec 3632 Q39, Q41; the door is BackOffice 3675's
 * `POST Analytics/Item/Sql`): the title, the chart type, which column is the axis, the series and the values, and each
 * value's label and format. Default: a table. Pure: the dialog in `AnswerParts` only draws this.
 */
export interface SqlSaveForm {
  title: AnalyticsLabel
  type: AnalyticsSqlChartType
  axis: string | null
  series: string | null
  values: AnalyticsSqlValueColumn[]
}

/** What stops the save, each a `copilot:sqlSave.problem.<key>`; `null` when it can be sent. */
export type SqlSaveProblem = 'title' | 'axis' | 'series' | 'values' | 'sameColumn' | 'notNumber'

interface TypeShape {
  axis: 'none' | 'required'
  series: 'none' | 'optional' | 'required'
  /** Values without a series. */
  min: number
  max: number
  /** Values with a series (when one is optional). */
  withSeries?: number
}

/** BackOffice 3675's fit table, by type. */
const SHAPES: Record<AnalyticsSqlChartType, TypeShape> = {
  table: { axis: 'none', series: 'none', min: 0, max: Number.POSITIVE_INFINITY },
  kpi: { axis: 'none', series: 'none', min: 1, max: 1 },
  line: { axis: 'required', series: 'optional', min: 1, max: 4, withSeries: 1 },
  area: { axis: 'required', series: 'optional', min: 1, max: 1, withSeries: 1 },
  bar: { axis: 'required', series: 'optional', min: 1, max: 3, withSeries: 1 },
  donut: { axis: 'required', series: 'none', min: 1, max: 1 },
  heatmap: { axis: 'required', series: 'required', min: 1, max: 1 },
  combo: { axis: 'required', series: 'none', min: 2, max: 2 },
}

/** Whether the type takes an axis / a series, and how many values it takes with this form's series. */
export function sqlTypeShape(type: AnalyticsSqlChartType, series: string | null): { axis: boolean; series: boolean; min: number; max: number } {
  const s = SHAPES[type]
  const split = series !== null && s.series !== 'none'
  return { axis: s.axis !== 'none', series: s.series !== 'none', min: s.min, max: split && s.withSeries ? s.withSeries : s.max }
}

const ARABIC = /[؀-ۿ]/

/** The dialog as it opens: a table, no values, the question as the title in its own script. */
export function sqlSaveForm(_sql: AnswerSql, question: string): SqlSaveForm {
  const words = question.trim().slice(0, ANALYTICS_SQL_MAX_TITLE)
  return {
    title: ARABIC.test(words) ? { en: '', ar: words } : { en: words, ar: '' },
    type: 'table',
    axis: null,
    series: null,
    values: [],
  }
}

const value = (column: string, kept: readonly AnalyticsSqlValueColumn[]): AnalyticsSqlValueColumn =>
  kept.find((v) => v.column === column) ?? { column, label: { en: '', ar: '' }, format: 'number' }

/**
 * The form with another type picked: the axis kept when it still fits, else the first column that is not a number (the
 * first column otherwise); a heat map's series the next such column; the values the number columns left, as many as the
 * type takes, keeping each one's label and format.
 */
export function withChartType(form: SqlSaveForm, type: AnalyticsSqlChartType, sql: AnswerSql): SqlSaveForm {
  const shape = SHAPES[type]
  const numeric = numericColumns(sql.columns, sql.rows)
  const isNumber = (c: string) => numeric[sql.columns.indexOf(c)] === true
  const pick = (taken: (string | null)[]) => {
    const free = sql.columns.filter((c) => !taken.includes(c))
    return free.find((c) => !isNumber(c)) ?? free[0] ?? null
  }
  const axis = shape.axis === 'none' ? null : form.axis !== null && sql.columns.includes(form.axis) ? form.axis : pick([])
  const series =
    shape.series === 'required'
      ? form.series !== null && form.series !== axis && sql.columns.includes(form.series)
        ? form.series
        : pick([axis])
      : shape.series === 'optional' && form.series !== null && form.series !== axis
        ? form.series
        : null
  const max = sqlTypeShape(type, series).max
  const free = sql.columns.filter((c) => isNumber(c) && c !== axis && c !== series)
  const values = type === 'table' ? form.values : free.slice(0, max).map((c) => value(c, form.values))
  return { ...form, type, axis, series, values }
}

/** One value's column, label or format changed. */
export function withValue(form: SqlSaveForm, i: number, change: Partial<AnalyticsSqlValueColumn>): SqlSaveForm {
  return { ...form, values: form.values.map((v, j) => (j === i ? { ...v, ...change } : v)) }
}

/** Why the form cannot be sent yet, or `null`. The server checks the same again and stays the authority. */
export function sqlSaveProblem(form: SqlSaveForm, sql: AnswerSql): SqlSaveProblem | null {
  if (form.title.en.trim() === '' && form.title.ar.trim() === '') return 'title'
  const shape = SHAPES[form.type]
  const axis = shape.axis === 'none' ? null : form.axis
  const series = shape.series === 'none' ? null : form.series
  if (shape.axis === 'required' && (axis === null || !sql.columns.includes(axis))) return 'axis'
  if (series !== null && !sql.columns.includes(series)) return 'series'
  if (shape.series === 'required' && series === null) return 'series'
  const { min, max } = sqlTypeShape(form.type, series)
  if (form.values.length < min || form.values.length > max) return 'values'
  const named = [axis, series, ...form.values.map((v) => v.column)].filter((c): c is string => c !== null)
  if (new Set(named).size !== named.length) return 'sameColumn'
  const numeric = numericColumns(sql.columns, sql.rows)
  if (form.values.some((v) => numeric[sql.columns.indexOf(v.column)] !== true)) return 'notNumber'
  return null
}

const words = (l: AnalyticsLabel): AnalyticsLabel => ({
  en: l.en.trim().slice(0, ANALYTICS_SQL_MAX_TITLE),
  ar: l.ar.trim().slice(0, ANALYTICS_SQL_MAX_TITLE),
})

/** `POST Analytics/Item/Sql`'s body: the answer's statement as shown, its question, the title and the chart. */
export function sqlSaveBody(sql: AnswerSql, question: string, form: SqlSaveForm): AnalyticsSqlItemCreate {
  const shape = SHAPES[form.type]
  const chart: AnalyticsSqlChart = { type: form.type, values: form.values.map((v) => ({ column: v.column, label: words(v.label), format: v.format })) }
  if (shape.axis !== 'none' && form.axis !== null) chart.axis = form.axis
  if (shape.series !== 'none' && form.series !== null) chart.series = form.series
  return {
    statement: sql.statement,
    question: question.slice(0, ANALYTICS_SQL_MAX_QUESTION),
    title: words(form.title),
    chart,
  }
}
