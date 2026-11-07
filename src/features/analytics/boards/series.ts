import type {
  AnalyticsColumn,
  AnalyticsModel,
  AnalyticsQueryResult,
  AnalyticsRow,
  AnalyticsSeries,
  AnalyticsViewDefinition,
  BindReason,
} from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { dimensionOf, measureOf } from './wire'

/**
 * Named series (spec 819 §C, 799; ticket 825) — pure. A view holds up to {@link MAX_SERIES} series, each its
 * own query (the view's query plus the series' filters), so a rate is computed from its own rows and never
 * averaged across series. The answer carries a `series` column (⚠ the column whose `role` is `series`, its
 * value the series id); `mergeSeries` lays the series side by side on the shared axis.
 *
 * Rulings (the server stays the authority, and validates the same at save with `ANALYTICS-411`):
 * - **Slot = position.** The series take the colour role in the definition's order (0..3), whatever order
 *   the answer lists them in — a series keeps its colour when another is filtered to nothing.
 * - **No total across series**, anywhere: series may overlap (an order can be HungerStation AND QC), so a
 *   sum would double-count. Nothing here, in the chart or in the export, adds them up.
 * - A series' filters must be on the view's own category dimensions: one every measure of the view may be
 *   broken down by (the same test the board uses to let a filter reach a panel).
 */

export const MAX_SERIES = 4

/** The definition's named series; absent reads as none. */
export const seriesOf = (definition: AnalyticsViewDefinition): AnalyticsSeries[] => definition.series ?? []

export const hasSeries = (definition: AnalyticsViewDefinition): boolean => seriesOf(definition).length > 0

/** The answer's series column key: the column whose role is `series`, else `series`. */
export const seriesColumnOf = (columns: readonly AnalyticsColumn[]): string => columns.find((c) => c.role === 'series')?.key ?? 'series'

/** One series' own rows of an answer (its KPI figure, its previous period). */
export const seriesRows = (rows: readonly AnalyticsRow[], columns: readonly AnalyticsColumn[], id: string): AnalyticsRow[] => {
  const col = seriesColumnOf(columns)
  return rows.filter((r) => String(r[col] ?? '') === id)
}

/** A series as the screen names it: its label in `lang`, else the other language, else its id. */
export const seriesName = (s: AnalyticsSeries, lang: string): string => saysIn(s.label, lang) || s.label.en || s.label.ar || s.id

export interface NamedSeries {
  id: string
  label: string
  /** Its colour slot: its position in the definition. */
  slot: number
}

export interface MergedPoint {
  /** The shared axis point: each axis dimension's member. */
  at: Record<string, string>
  /** Each series' row at this point, by series id; absent where the series has none (a gap, never a zero). */
  values: Record<string, AnalyticsRow>
}

export interface MergedSeries {
  column: string
  series: NamedSeries[]
  /** One per axis point, in the order the answer first gives them. */
  points: MergedPoint[]
}

/**
 * The per-series rows merged on the shared axis (the view's dimensions). Rows of a series the view does
 * not hold are dropped, never drawn.
 */
export function mergeSeries(result: AnalyticsQueryResult, definition: AnalyticsViewDefinition, lang: string): MergedSeries {
  const own = seriesOf(definition)
  const column = seriesColumnOf(result.columns)
  const ids = new Set(own.map((s) => s.id))
  const axis = definition.query.dimensions.length
    ? definition.query.dimensions
    : result.columns.filter((c) => c.role === 'dimension').map((c) => c.key)
  const points = new Map<string, MergedPoint>()
  for (const r of result.rows) {
    const id = String(r[column] ?? '')
    if (!ids.has(id)) continue
    const at = Object.fromEntries(axis.map((k) => [k, String(r[k] ?? '')]))
    const key = JSON.stringify(axis.map((k) => at[k]))
    let point = points.get(key)
    if (!point) points.set(key, (point = { at, values: {} }))
    point.values[id] = r
  }
  // Each point's series in the definition's order, so a reader of `values` meets them in slot order.
  for (const p of points.values()) p.values = Object.fromEntries(own.filter((s) => p.values[s.id]).map((s) => [s.id, p.values[s.id]]))
  return { column, series: own.map((s, slot) => ({ id: s.id, label: seriesName(s, lang), slot })), points: [...points.values()] }
}

/** The dimensions the view's series filter on. */
export const seriesDimensions = (definition: AnalyticsViewDefinition): Set<string> =>
  new Set(seriesOf(definition).flatMap((s) => s.filters.map((f) => f.dimension)))

/**
 * 824's `canBind` for a members parameter, the series half: it cannot bind to a dimension a series of
 * this panel filters on (the series already decide it). `null` when the series leave it free.
 */
export const seriesBindReason = (dimension: string, definition: AnalyticsViewDefinition): Extract<BindReason, 'seriesFilters'> | null =>
  seriesDimensions(definition).has(dimension) ? 'seriesFilters' : null

/** A series problem at save, as `ANALYTICS-411` lists it (⚠ the web's shape for the refusal's `data.problems`). */
export type SeriesProblem =
  | { why: 'tooMany' }
  | { why: 'duplicate'; series: string }
  | { why: 'foreignDimension'; series: string; dimension: string }

const norm = (s: string) => s.trim().toLocaleLowerCase()

/** The view's own category dimensions: category dimensions every measure may be broken down by. */
export function ownCategoryDimensions(definition: AnalyticsViewDefinition, model: AnalyticsModel): Set<string> {
  const measures = definition.query.measures.map((k) => measureOf(model, k))
  return new Set(
    model.dimensions
      .filter((d) => d.kind === 'category' && measures.length > 0 && measures.every((m) => m?.dimensions.includes(d.key)))
      .map((d) => d.key),
  )
}

/** The save-time series checks (the server's 411 is the authority): more than 4, a duplicate label, a foreign dimension. */
export function seriesProblems(definition: AnalyticsViewDefinition, model: AnalyticsModel): SeriesProblem[] {
  const own = seriesOf(definition)
  if (own.length > MAX_SERIES) return [{ why: 'tooMany' }]
  const out: SeriesProblem[] = []
  const seen = { en: new Set<string>(), ar: new Set<string>() }
  const allowed = ownCategoryDimensions(definition, model)
  for (const s of own) {
    const en = norm(s.label.en)
    const ar = norm(s.label.ar)
    if ((en && seen.en.has(en)) || (ar && seen.ar.has(ar))) out.push({ why: 'duplicate', series: s.id })
    if (en) seen.en.add(en)
    if (ar) seen.ar.add(ar)
    const foreign = s.filters.find((f) => !allowed.has(f.dimension) || !dimensionOf(model, f.dimension))
    if (foreign) out.push({ why: 'foreignDimension', series: s.id, dimension: foreign.dimension })
  }
  return out
}

/** A fresh series id: `s1`, `s2`, … the first one not taken. */
export function nextSeriesId(series: readonly AnalyticsSeries[]): string {
  for (let i = 1; ; i++) if (!series.some((s) => s.id === `s${i}`)) return `s${i}`
}
