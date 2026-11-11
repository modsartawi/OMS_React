import { formatAxisDay } from '@/core/charts/format'
import { measureKeysOf } from './calculations'
import { lastYearMatcher, lastYearMeasures, lastYearOf, lastYearRange } from './last-year'
import { previousMatcher } from './previous-rows'
import { assignSlots, CHART_SLOT_COUNT } from '@/core/charts/slots'
import type {
  AnalyticsModel,
  AnalyticsNumberFormat,
  AnalyticsQueryResult,
  AnalyticsRow,
  AnalyticsViewDefinition,
  MeasureUnit,
} from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { hasSeries, mergeSeries, seriesOf, seriesName, seriesRows, type NamedSeries } from './series'
import { viewMeasureOf, slotRuleFor, type ViewMeasure } from './view-model'
import { dimensionOf } from './wire'
import { drawnResult } from './unsplit'

/**
 * The KPI and series view models (spec 766 §E/§F, ticket 768): one `Analytics/Query` answer turned into
 * what a KPI tile, a line, a stacked area or a bar variant draws. Pure — proven in `series-view.test.ts`.
 *
 * Kept beside `view-model.ts` (767's bar view and the shared helpers) rather than inside it, so the other
 * forms (769) extend that file without touching these.
 *
 * Rulings made here (768; the server stays the authority on what a definition may be):
 * - **Rates are never summed** (766 §B: Σ numerator ÷ Σ denominator, never an average). A KPI over days
 *   of a rate or percentile has no headline the web can compute; it shows its sparkline only. A rate
 *   breakdown past five members DROPS the rest instead of drawing an "Other" it cannot compute.
 * - **A rate is never stacked** (766 §E): a stacked area or a stacked bar over one is refused here, as a
 *   guard behind the editor, which never offers it.
 * - **The top 5 plus "Other"** (766 §E amendment 2): the five largest members by their total are named,
 *   in rank order; their COLOURS still come from the entity rule (`slots`), never the rank. A member
 *   that finds no free slot folds too. "Other" is last and has no slot: ink grey.
 */

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The definition's number format; absent means `auto`. */
const formatOf = (definition: AnalyticsViewDefinition): AnalyticsNumberFormat => definition.chart.format ?? 'auto'

function timeKeyOf(dimensions: readonly string[], model: AnalyticsModel): string | undefined {
  return dimensions.find((d) => dimensionOf(model, d)?.kind === 'time')
}

// ── KPI ────────────────────────────────────────────────────────────────────────────────────────────

export interface KpiDelta {
  /** Current − previous, in the measure's unit. */
  abs: number
  /** The change as a fraction of the previous (0.2 = +20 %); `null` when the previous was zero. */
  pct: number | null
  direction: 'up' | 'down' | 'flat'
}

export interface KpiView {
  kind: 'kpi'
  measure: ViewMeasure
  format: AnalyticsNumberFormat
  /** The headline; `null` when it cannot be stated (a rate over several rows, or no rows). */
  value: number | null
  previous: number | null
  /** `null` when there is no previous figure to compare with. */
  delta: KpiDelta | null
  spark: { x: string; label: string; value: number | null }[]
  empty: boolean
  /**
   * 877: the figure of the same weeks last year, by the headline's own rule ({@link figureOf}), with last year's dates.
   * Absent when the answer has none. No change is computed against it: the tile's ▲▼ stays the previous period's.
   */
  lastYear?: { value: number; range: string }
}

/** One figure for a set of rows: the row itself, or the sum of an additive measure; never a rate's sum. */
function figureOf(rows: readonly AnalyticsRow[], key: string, additive: boolean): number | null {
  if (rows.length === 0) return null
  if (rows.length === 1) return num(rows[0][key])
  if (!additive) return null
  const values = rows.map((r) => num(r[key])).filter((v): v is number => v !== null)
  return values.length ? values.reduce((a, b) => a + b, 0) : null
}

export function deltaOf(current: number | null, previous: number | null): KpiDelta | null {
  if (current === null || previous === null) return null
  const abs = current - previous
  return { abs, pct: previous === 0 ? null : abs / Math.abs(previous), direction: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat' }
}

export function toKpiView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
): KpiView {
  // 864 (spec 3543 decision 12): an "All" row of a cross-area answer is never drawn (`./unsplit`).
  result = drawnResult(result)
  const key = definition.query.measures[0] ?? result.columns.find((c) => c.role === 'measure')?.key ?? ''
  const measure = viewMeasureOf(key, model, result, lang)
  const additive = measure.shape === 'additive'
  const timeKey = timeKeyOf(definition.query.dimensions, model)
  const value = figureOf(result.rows, key, additive)
  const previous = result.previous.length ? figureOf(result.previous, key, additive) : null

  const spark = timeKey
    ? [...result.rows]
        .map((r) => ({ x: String(r[timeKey] ?? ''), value: num(r[key]) }))
        .sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0))
        .map((p) => ({ ...p, label: formatAxisDay(p.x, lang) }))
    : []

  const lastYear = lastYearMeasures(definition, result).includes(key) ? figureOf(lastYearOf(result)?.rows ?? [], key, additive) : null

  return {
    kind: 'kpi',
    measure,
    format: formatOf(definition),
    value,
    previous,
    delta: deltaOf(value, previous),
    spark,
    empty: result.rows.length === 0,
    ...(lastYear !== null ? { lastYear: { value: lastYear, range: lastYearRange(result, lang) } } : {}),
  }
}

/** A KPI tile of one named series (825). */
export type SeriesKpiView = KpiView & { series: NamedSeries }

/**
 * 825: a KPI over named series is one figure per series, side by side, in slot order — each from that
 * series' own rows (and its own previous rows), so a rate is that series' own, never an average of them.
 */
export function toKpiViews(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
): SeriesKpiView[] {
  const columns = result.columns
  return seriesOf(definition).map((s, slot) => ({
    ...toKpiView(
      {
        ...result,
        rows: seriesRows(result.rows, columns, s.id),
        previous: seriesRows(result.previous, columns, s.id),
        ...(result.lastYear ? { lastYear: seriesRows(result.lastYear, columns, s.id) } : {}),
      },
      definition,
      model,
      lang,
    ),
    series: { id: s.id, label: seriesName(s, lang), slot },
  }))
}

// ── Line, stacked area, bars ───────────────────────────────────────────────────────────────────────

export interface SeriesDef {
  /** The data key every row holds this series' value under (`s0`, `s1`, …). */
  key: string
  /** The breakdown member (or the measure key, for a series per measure); `''` for "Other". */
  member: string
  /** The model's label; `''` for "Other", which the chart names through `t()`. */
  label: string
  /** Its colour slot; `null` for "Other" (ink grey). */
  slot: number | null
  other: boolean
  unit: MeasureUnit
  /** The previous period beside a line over time (766 story 23): ink grey, dashed, named by the chart. */
  previous?: boolean
  /**
   * 877: the same weeks last year beside a line over time or a bar — ink, never a palette slot, and its own dash on a
   * line. Unlike the previous period it is named HERE (`label`), with last year's dates ({@link SeriesWords}).
   */
  lastYear?: boolean
}

/** The words a series chart takes, in the screen's language (`./SeriesPanel`). */
export interface SeriesWords {
  /** 877: the last-year series' name; `range` is last year's dates (`./last-year` `lastYearRange`). Absent: the dates alone. */
  lastYear?: (range: string) => string
}

export interface SeriesRow {
  /** The x member as the server sent it. */
  x: string
  /** What the axis and tooltip say. */
  label: string
  values: Record<string, number | null>
  /** A single-series bar coloured by member: this row's slot. */
  slot: number | null
}

export interface SeriesView {
  kind: 'series'
  form: 'line' | 'area' | 'bar'
  orientation: 'vertical' | 'horizontal'
  stacking: 'none' | 'stacked' | 'grouped'
  x: { key: string; label: string; isTime: boolean }
  series: SeriesDef[]
  rows: SeriesRow[]
  /** The first measure's label, for the chart's accessible name. */
  measureLabel: string
  /** The value axis' unit: the first measure's. */
  unit: MeasureUnit
  /** `unitPanes`: the measures this pane draws, by label — a pane's title, since one series draws no legend. */
  labels?: string[]
  format: AnalyticsNumberFormat
  /** A single series coloured per x member (a fixed dimension, or a saved slot map). */
  colourBy: 'member' | 'single'
  /** Members not drawn on their own: folded into "Other", or dropped for a rate. */
  folded: number
  /** Of those, the members drawn nowhere — a rate's rest past five, which no "Other" can hold. The screen says so. */
  notShown: number
  empty: boolean
  truncated: boolean
}

export interface RefusedView {
  kind: 'refused'
  reason: 'rateStacked'
  /** The measure's label, for the sentence. */
  measure: string
}

const TOP = CHART_SLOT_COUNT

/**
 * Spec 3543 review (owner): one value axis per unit. An average in SAR and a percent are both shape `rate`, so they
 * may meet in one series chart — never on one axis. Each unit is its own pane with its own value axis, in the order
 * its first series comes (the combo's two panes: 766 §E amendment 1, never two y-axes on one chart). A series keeps
 * its key and colour slot; the previous-period series stays with its measure's unit. One unit: the view as it is.
 */
export function unitPanes(view: SeriesView): SeriesView[] {
  const units = [...new Set(view.series.map((s) => s.unit))]
  if (units.length < 2) return [view]
  return units.map((unit) => {
    const series = view.series.filter((s) => s.unit === unit)
    const keys = new Set(series.map((s) => s.key))
    return {
      ...view,
      series,
      unit,
      measureLabel: series.find((s) => !s.previous && !s.lastYear && !s.other)?.label ?? view.measureLabel,
      labels: series.filter((s) => !s.previous && !s.lastYear && !s.other).map((s) => s.label),
      rows: view.rows.map((r) => ({ ...r, values: Object.fromEntries(Object.entries(r.values).filter(([k]) => keys.has(k))) })),
    }
  })
}

export function toSeriesView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
  words: SeriesWords = {},
): SeriesView | RefusedView {
  // 864 (spec 3543 decision 12): an "All" row of a cross-area answer is never drawn (`./unsplit`).
  result = drawnResult(result)
  const form = definition.chart.type === 'area' ? 'area' : definition.chart.type === 'bar' ? 'bar' : 'line'
  // 861: the query's measures, then the calculated columns the server returned.
  const measureKeys = measureKeysOf(definition, result)
  const measures = measureKeys.map((k) => viewMeasureOf(k, model, result, lang))
  if (hasSeries(definition)) return namedSeriesView(result, definition, model, lang, form, measures)

  // A rate is never stacked (766 §E): refused before anything is drawn.
  const wantsStack = form === 'area' || (form === 'bar' && definition.chart.stack === 'stacked')
  const rate = measures.find((m) => m.shape !== 'additive')
  if (wantsStack && rate) return { kind: 'refused', reason: 'rateStacked', measure: rate.label }

  const dims = definition.query.dimensions.length
    ? definition.query.dimensions
    : result.columns.filter((c) => c.role === 'dimension').map((c) => c.key)
  const xKey = (form === 'bar' ? dims[0] : (timeKeyOf(dims, model) ?? dims[0])) ?? ''
  const xDim = dimensionOf(model, xKey)
  const isTime = xDim?.kind === 'time'
  const breakdown = measures.length === 1 ? dims.find((d) => d !== xKey) : undefined
  const valueLabels = (dim: string) =>
    new Map(dimensionOf(model, dim)?.values.map((v) => [v.key, saysIn(v.label, lang)]) ?? [])
  const xLabels = valueLabels(xKey)

  const xs: string[] = []
  for (const r of result.rows) {
    const x = String(r[xKey] ?? '')
    if (!xs.includes(x)) xs.push(x)
  }
  if (isTime) xs.sort()
  const rowsAt = new Map(xs.map((x) => [x, result.rows.filter((r) => String(r[xKey] ?? '') === x)]))

  let series: SeriesDef[]
  let folded = 0
  let notShown = 0
  const values: Map<string, Record<string, number | null>> = new Map(xs.map((x) => [x, {}]))

  if (breakdown) {
    const m = measures[0]
    const members: string[] = []
    const totals = new Map<string, number>()
    for (const r of result.rows) {
      const member = String(r[breakdown] ?? '')
      if (!members.includes(member)) members.push(member)
      totals.set(member, (totals.get(member) ?? 0) + (num(r[m.key]) ?? 0))
    }
    // Stable: equal totals keep the order the server sent them in.
    const ranked = [...members].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
    const top = ranked.slice(0, TOP)
    const slots = assignSlots(top, slotRuleFor(breakdown, model, definition) ?? { kind: 'saved', map: {} })
    const named = top.filter((member) => slots.get(member) !== null)
    const rest = members.filter((member) => !named.includes(member))
    folded = rest.length
    const labels = valueLabels(breakdown)
    series = named.map((member, i) => ({
      key: `s${i}`,
      member,
      label: labels.get(member) || member,
      slot: slots.get(member) ?? null,
      other: false,
      unit: m.unit,
    }))
    // "Other" is a sum, so only an additive measure has one; a rate's rest is dropped (see the header).
    const withOther = rest.length > 0 && m.shape === 'additive'
    if (!withOther) notShown = rest.length
    if (withOther) series.push({ key: `s${series.length}`, member: '', label: '', slot: null, other: true, unit: m.unit })
    for (const x of xs) {
      const at = rowsAt.get(x) ?? []
      const v = values.get(x)!
      for (const s of series) {
        const own = s.other ? at.filter((r) => rest.includes(String(r[breakdown] ?? ''))) : at.filter((r) => String(r[breakdown] ?? '') === s.member)
        const nums = own.map((r) => num(r[m.key])).filter((n): n is number => n !== null)
        v[s.key] = nums.length ? nums.reduce((a, b) => a + b, 0) : null
      }
    }
  } else {
    // A series per measure, in the measure's position: fixed slots, never ranked.
    series = measures.map((m, i) => ({ key: `s${i}`, member: m.key, label: m.label, slot: i < TOP ? i : null, other: false, unit: m.unit }))
    for (const x of xs) {
      const row = rowsAt.get(x)?.[0]
      const v = values.get(x)!
      for (const s of series) v[s.key] = row ? num(row[s.member]) : null
    }
    // A line of one measure over time, compared with the previous period: its days lie beside the current
    // ones by position (the previous period is as long, and earlier), so day i sits under day i.
    if (form === 'line' && isTime && measures.length === 1 && result.previous.length > 0) {
      const m = measures[0]
      const earlier = [...result.previous].sort((a, b) => (String(a[xKey] ?? '') < String(b[xKey] ?? '') ? -1 : 1))
      series.push({ key: 'prev', member: '', label: '', slot: null, other: false, unit: m.unit, previous: true })
      xs.forEach((x, i) => (values.get(x)!.prev = earlier[i] ? num(earlier[i][m.key]) : null))
    }
    // Spec 3519 item 11: a bar compared with the previous period — the query's first measure over the previous
    // period, matched to each bar by its member (a time bucket by its place), drawn beside it, never stacked on it.
    const firstMeasure = definition.query.measures[0]
    if (form === 'bar' && firstMeasure && definition.query.compareToPrevious === true && result.previous.length > 0) {
      const m = measures.find((x) => x.key === firstMeasure) ?? measures[0]
      const before = previousMatcher(result, [xKey], model)
      series.push({ key: 'prev', member: '', label: '', slot: null, other: false, unit: m.unit, previous: true })
      for (const x of xs) {
        const row = rowsAt.get(x)?.[0]
        values.get(x)!.prev = row ? num(before(row)?.[m.key]) : null
      }
    }
    // 877: the same weeks last year, drawn where the previous period is and the same way — beside a line of one
    // measure over time by position, beside a bar by its member — after it, named with last year's dates.
    const range = lastYearRange(result, lang)
    const lastYearSeries = (unit: MeasureUnit): SeriesDef => ({ key: 'ly', member: '', label: words.lastYear?.(range) ?? range, slot: null, other: false, unit, lastYear: true })
    const withLastYear = lastYearMeasures(definition, result)
    if (form === 'line' && isTime && measures.length === 1 && withLastYear.includes(measures[0].key)) {
      const m = measures[0]
      const yearAgo = [...(lastYearOf(result)?.rows ?? [])].sort((a, b) => (String(a[xKey] ?? '') < String(b[xKey] ?? '') ? -1 : 1))
      series.push(lastYearSeries(m.unit))
      xs.forEach((x, i) => (values.get(x)!.ly = yearAgo[i] ? num(yearAgo[i][m.key]) : null))
    }
    if (form === 'bar' && firstMeasure && definition.query.compareToLastYear === true && withLastYear.includes(firstMeasure)) {
      const m = measures.find((x) => x.key === firstMeasure) ?? measures[0]
      const yearAgo = lastYearMatcher(result, [xKey], model)
      series.push(lastYearSeries(m.unit))
      for (const x of xs) {
        const row = rowsAt.get(x)?.[0]
        values.get(x)!.ly = row ? num(yearAgo(row)?.[m.key]) : null
      }
    }
  }

  // A single series coloured by its x member, as 767's bar is (a fixed dimension, or a saved map).
  const xRule = series.length === 1 && !isTime ? slotRuleFor(xKey, model, definition) : null
  const xSlots = xRule ? assignSlots(xs, xRule) : null

  const withPrevious = series.some((s) => s.previous || s.lastYear)
  const stacking: SeriesView['stacking'] =
    form === 'area'
      ? 'stacked'
      : form === 'bar' && series.length > 1
        ? withPrevious
          ? 'grouped'
          : (definition.chart.stack ?? 'grouped')
        : 'none'

  return {
    kind: 'series',
    form,
    orientation: form === 'bar' ? (definition.chart.orientation ?? 'vertical') : 'vertical',
    stacking,
    x: { key: xKey, label: saysIn(xDim?.label, lang) || xKey, isTime },
    series,
    rows: xs.map((x) => ({
      x,
      label: isTime ? formatAxisDay(x, lang) : xLabels.get(x) || x,
      values: values.get(x)!,
      slot: xSlots ? (xSlots.get(x) ?? null) : 0,
    })),
    measureLabel: measures[0]?.label ?? '',
    unit: measures[0]?.unit ?? 'count',
    format: formatOf(definition),
    colourBy: xSlots ? 'member' : 'single',
    folded,
    notShown,
    empty: result.rows.length === 0,
    truncated: result.truncated,
  }
}

/**
 * 825: named series as the series source — one series per named series, in slot order (its position), no
 * "Other" and no total. Never stacked: a stack's height IS a total, and series may overlap, so a bar is
 * grouped and an area overlaps. One measure (the shape rules offer no more with series).
 */
function namedSeriesView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
  form: SeriesView['form'],
  measures: ViewMeasure[],
): SeriesView {
  const m = measures[0]
  const merged = mergeSeries(result, definition, lang)
  const dims = definition.query.dimensions.length
    ? definition.query.dimensions
    : result.columns.filter((c) => c.role === 'dimension').map((c) => c.key)
  const xKey = (form === 'bar' ? dims[0] : (timeKeyOf(dims, model) ?? dims[0])) ?? ''
  const xDim = dimensionOf(model, xKey)
  const isTime = xDim?.kind === 'time'
  const xLabels = new Map(xDim?.values.map((v) => [v.key, saysIn(v.label, lang)]) ?? [])

  const xs: string[] = []
  for (const p of merged.points) if (!xs.includes(p.at[xKey] ?? '')) xs.push(p.at[xKey] ?? '')
  if (isTime) xs.sort()
  const series: SeriesDef[] = merged.series.map((s, i) => ({ key: `s${i}`, member: s.id, label: s.label, slot: s.slot, other: false, unit: m?.unit ?? 'count' }))
  const rows: SeriesRow[] = xs.map((x) => {
    const at = merged.points.find((p) => (p.at[xKey] ?? '') === x)
    const values = Object.fromEntries(series.map((s) => [s.key, at?.values[s.member] ? num(at.values[s.member][m?.key ?? '']) : null]))
    return { x, label: isTime ? formatAxisDay(x, lang) : xLabels.get(x) || x, values, slot: 0 }
  })
  return {
    kind: 'series',
    form,
    orientation: form === 'bar' ? (definition.chart.orientation ?? 'vertical') : 'vertical',
    stacking: form === 'bar' && series.length > 1 ? 'grouped' : 'none',
    x: { key: xKey, label: saysIn(xDim?.label, lang) || xKey, isTime },
    series,
    rows,
    measureLabel: m?.label ?? '',
    unit: m?.unit ?? 'count',
    format: formatOf(definition),
    colourBy: 'single',
    folded: 0,
    notShown: 0,
    empty: merged.points.length === 0,
    truncated: result.truncated,
  }
}
