import { formatValue } from '@/core/charts/format'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { IS_TOTAL_KEY } from '@/core/models/analytics-calculations'
import { saysIn } from '@/core/rules/sentence'
import { formatParts, fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { seriesColumnOf, seriesName, seriesOf } from './series'
import { viewMeasureOf } from './view-model'
import { dimensionOf, measureOf, valueLabel } from './wire'

/**
 * Unsplit totals on a cross-area panel (ticket 864, BackOffice spec 3543 decision 12; the owner's artifact *Unsplit
 * Total Rows*). Pure. A figure whose area cannot be split by an asked dimension is answered on "All" rows
 * (`isTotal: true`, the dimensions it totals over `null`), and the web keeps them APART:
 *
 * - {@link drawnResult} — what a chart draws: never an "All" row as a bar, a slice or a point (nor a KPI's figure);
 * - {@link splitThenTotals} — what a table and every export lists: the split rows in the answer's order, then the "All"
 *   rows, whatever order they came in;
 * - {@link areaNotes} — the panel note: each unsplit figure's `notSplit` sentence with its totals (not on a table, which
 *   lists them as its "All" rows), and each `notFiltered`
 *   figure marked "not filtered by …" (decision 18);
 * - {@link columnTooltip} — a cross-area column header's tooltip: its area's `dateBasis` (decision 14) and the
 *   "not filtered" mark.
 */

/** An "All" row of a cross-area result (decision 12). */
export const isTotalRow = (row: AnalyticsRow): boolean => row[IS_TOTAL_KEY] === true

/** The split rows in their order, then the "All" rows in theirs. The same array when there is no "All" row. */
export function splitThenTotals<R extends AnalyticsRow>(rows: readonly R[]): { split: R[]; totals: R[] } {
  const split: R[] = []
  const totals: R[] = []
  for (const r of rows) (isTotalRow(r) ? totals : split).push(r)
  return { split, totals }
}

const hasTotals = (rows: readonly AnalyticsRow[]) => rows.some(isTotalRow)

/**
 * `result` without its "All" rows (in `rows` and `previous`), for every chart form. The same object when it has none,
 * so a one-area panel draws exactly as before.
 */
export function drawnResult(result: AnalyticsQueryResult): AnalyticsQueryResult {
  if (!hasTotals(result.rows) && !hasTotals(result.previous)) return result
  return { ...result, rows: result.rows.filter((r) => !isTotalRow(r)), previous: result.previous.filter((r) => !isTotalRow(r)) }
}

// ── The panel note and the header tooltip ────────────────────────────────────────────────────────────────

/** The notes' words, from the locale (`boards:view.unsplit.*`); every name and number arrives isolated. */
export interface AreaNoteWords {
  /** "{{measure}} cannot be split by {{by}}." */
  notSplit: (v: { measure: string; by: string }) => string
  /** "{{measure}} is not filtered by {{by}}." */
  notFiltered: (v: { measure: string; by: string }) => string
  /** One parent's total: "In {{parent}}: {{value}}". */
  totalIn: (v: { parent: string; value: string }) => string
  /** The whole result's total, when no asked dimension is shared: "Total: {{value}}". */
  total: (v: { value: string }) => string
}

export interface UnsplitNote {
  measure: string
  sentence: string
  /** One line per "All" row holding this figure, in the answer's order. */
  totals: string[]
}

export interface AreaNotes {
  notSplit: UnsplitNote[]
  notFiltered: string[]
}

type Model = Pick<AnalyticsModel, 'measures' | 'dimensions'>

const measureName = (key: string, model: Model, lang: string) => saysIn(measureOf(model, key)?.label, lang) || key
const dimensionNames = (keys: readonly string[], model: Model, lang: string) => listText(keys.map((k) => saysIn(dimensionOf(model, k)?.label, lang) || k), lang)

/**
 * The panel note of a cross-area answer (decisions 12 and 18), in `lang`. `model` is the panel's drawing model (its
 * variant and calculated measures named). Empty lists on a one-area answer.
 *
 * A total names its parent by the dimension values the "All" row keeps (a fixed value's label, else the code; several
 * as one `·` line), led by its series' name on a view with named series; with none left, it is the whole result's.
 */
export function areaNotes(
  definition: AnalyticsViewDefinition,
  result: AnalyticsQueryResult | undefined,
  model: AnalyticsModel,
  lang: string,
  words: AreaNoteWords,
): AreaNotes {
  if (!result) return { notSplit: [], notFiltered: [] }
  const dims = definition.query.dimensions.length ? definition.query.dimensions : result.columns.filter((c) => c.role === 'dimension').map((c) => c.key)
  const named = seriesOf(definition)
  const seriesKey = seriesColumnOf(result.columns)
  const seriesNames = new Map(named.map((s) => [s.id, seriesName(s, lang)]))
  // A table lists the "All" rows itself (last, `splitThenTotals`), so its note is the sentence alone; a chart draws none.
  const totals = definition.chart.type === 'table' ? [] : result.rows.filter(isTotalRow)
  const notSplit = (result.notSplit ?? []).map((e): UnsplitNote => {
    const unit = viewMeasureOf(e.measure, model, result, lang).unit
    const lines = totals
      .filter((r) => typeof r[e.measure] === 'number')
      .map((r) => {
        const value = fsi(formatValue(r[e.measure] as number, unit, lang))
        const parts = [
          ...(named.length && r[seriesKey] != null ? [seriesNames.get(String(r[seriesKey])) ?? String(r[seriesKey])] : []),
          ...dims.filter((k) => !e.by.includes(k) && r[k] != null).map((k) => valueLabel(model, k, String(r[k]), lang)),
        ]
        return parts.length ? words.totalIn({ parent: fsi(formatParts(parts)), value }) : words.total({ value })
      })
    return { measure: e.measure, sentence: words.notSplit({ measure: fsi(measureName(e.measure, model, lang)), by: fsi(dimensionNames(e.by, model, lang)) }), totals: lines }
  })
  const notFiltered = (result.notFiltered ?? []).map((e) => notFilteredSentence(e.measure, e.by, model, lang, words))
  return { notSplit, notFiltered }
}

const notFilteredSentence = (measure: string, by: readonly string[], model: Model, lang: string, words: AreaNoteWords) =>
  words.notFiltered({ measure: fsi(measureName(measure, model, lang)), by: fsi(dimensionNames(by, model, lang)) })

/**
 * A column header's tooltip on a cross-area panel: the column's `dateBasis` in `lang` (decision 14), then its "not
 * filtered by …" mark (decision 18), one per line. `undefined` for a dimension, and for every column of a one-area answer.
 */
export function columnTooltip(key: string, result: AnalyticsQueryResult, model: AnalyticsModel, lang: string, words: AreaNoteWords): string | undefined {
  const column = result.columns.find((c) => c.key === key)
  if (!column || column.role !== 'measure') return undefined
  const unfiltered = result.notFiltered?.find((e) => e.measure === key)
  const lines = [saysIn(column.dateBasis ?? undefined, lang), unfiltered ? notFilteredSentence(key, unfiltered.by, model, lang, words) : ''].filter(Boolean)
  return lines.length ? lines.join('\n') : undefined
}
