import { assignSlots } from '@/core/charts/slots'
import { measureKeysOf } from './calculations'
import { previousKey, previousMatcher, previousMeasures } from './previous-rows'
import { sequentialFill, sequentialWeight } from '@/core/charts/sequential'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { mergeSeries, seriesColumnOf, seriesName, seriesOf, type NamedSeries } from './series'
import { viewMeasureOf, slotRuleFor, type ViewMeasure } from './view-model'
import { dimensionOf, measureOf } from './wire'
import { drawnResult, isTotalRow, splitThenTotals } from './unsplit'
import type { TableWords } from './panel-table'

/**
 * The result → view model for the donut, the table with cell bars, the heatmap and the combo
 * (spec 766 §E, ticket 769). Pure, beside `view-model.ts`'s bar view and reusing its `saysIn`,
 * `viewMeasureOf` and `slotRuleFor`; proven in `view-model-forms.test.ts`.
 *
 * Kept in its own module so 768's top-N + "Other" fold (the time and bar forms) and this one merge
 * cleanly; the donut's fold below is its own (the cap is 6 slices, not 768's 5 series).
 */

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The first measure and dimension a form reads: the definition's, else the answer's own columns. */
const firstKey = (keys: readonly string[], result: AnalyticsQueryResult, role: 'measure' | 'dimension', at = 0): string =>
  keys[at] ?? result.columns.filter((c) => c.role === role)[at]?.key ?? ''

/** A dimension's members as the screen names them: the model's label for an inline value, else the key. */
function memberLabeller(dimension: string, model: AnalyticsModel, lang: string) {
  const dim = dimensionOf(model, dimension)
  const labels = new Map(dim?.values.map((v) => [v.key, saysIn(v.label, lang)]) ?? [])
  return {
    category: { key: dimension, label: saysIn(dim?.label, lang) || dimension, kind: dim?.kind ?? 'category' },
    label: (member: string) => labels.get(member) || member,
    /** The catalogue order of an inline-valued dimension, `null` for an open one. */
    order: dim && dim.values.length > 0 ? dim.values.map((v) => v.key) : null,
  }
}

// ── Donut ────────────────────────────────────────────────────────────────────────────────────────────

/** 755's table: a donut shows at most 6 named slices, then "Other". */
export const DONUT_MAX_SLICES = 6

export interface DonutSlice {
  member: string
  label: string
  value: number
  slot: number
}

export type DonutView =
  | {
      kind: 'donut'
      measure: ViewMeasure
      category: { key: string; label: string }
      slices: DonutSlice[]
      /** Everything folded: the slices past the sixth, and any slice the palette has no hue left for. */
      other: { value: number; count: number } | null
      total: number
      empty: boolean
    }
  /** A rate or percentile measure is never in a donut (766 §E): a share of a rate means nothing. */
  | { kind: 'refused'; reason: 'shape'; measure: ViewMeasure }

export function toDonutView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
): DonutView {
  // 864 (spec 3543 decision 12): an "All" row of a cross-area answer is never drawn (`./unsplit`).
  result = drawnResult(result)
  const measureKey = firstKey(definition.query.measures, result, 'measure')
  const dimensionKey = firstKey(definition.query.dimensions, result, 'dimension')
  // The model's shape decides when the column is silent: the refusal must not depend on the answer.
  const declared = measureOf(model, measureKey)?.shape
  const measure = viewMeasureOf(measureKey, model, result, lang)
  if (measure.shape !== 'additive' || (declared && declared !== 'additive')) return { kind: 'refused', reason: 'shape', measure }

  const names = memberLabeller(dimensionKey, model, lang)
  const ranked = result.rows
    .map((r) => ({ member: String(r[dimensionKey] ?? ''), value: num(r[measureKey]) ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  // Colour by entity: the fixed catalogue slot, or the saved map; an open breakdown with no map hands the
  // free slots out largest first. A slice left without a hue folds into "Other" — never a sixth colour.
  const slots = assignSlots(
    ranked.map((r) => r.member),
    slotRuleFor(dimensionKey, model, definition) ?? { kind: 'saved', map: {} },
  )
  const slices: DonutSlice[] = []
  let otherValue = 0
  let otherCount = 0
  for (const r of ranked) {
    const slot = slots.get(r.member) ?? null
    if (slot !== null && slices.length < DONUT_MAX_SLICES) slices.push({ member: r.member, label: names.label(r.member), value: r.value, slot })
    else {
      otherValue += r.value
      otherCount += 1
    }
  }
  return {
    kind: 'donut',
    measure,
    category: names.category,
    slices,
    other: otherCount ? { value: otherValue, count: otherCount } : null,
    total: ranked.reduce((s, r) => s + r.value, 0),
    empty: ranked.length === 0,
  }
}

// ── Heatmap ──────────────────────────────────────────────────────────────────────────────────────────

export interface HeatmapMember {
  member: string
  label: string
}

export interface HeatmapCell {
  x: string
  y: string
  value: number | null
  /** The cell's share of the hue in percent, `null` when it has no value. */
  weight: number | null
  /** Its paint (`@/core/charts/sequential`), `null` for an unpainted cell. */
  fill: string | null
}

export interface HeatmapView {
  kind: 'heatmap'
  measure: ViewMeasure
  x: { key: string; label: string }
  y: { key: string; label: string }
  xs: HeatmapMember[]
  ys: HeatmapMember[]
  /** Every x × y, x-major, the gaps included. */
  cells: HeatmapCell[]
  min: number | null
  max: number | null
  empty: boolean
}

/** A dimension's members in order: the catalogue's for an inline-valued one, else as the answer gives them. */
function membersOf(seen: readonly string[], order: readonly string[] | null): string[] {
  const unique = [...new Set(seen)]
  if (!order) return unique
  const present = new Set(unique)
  return [...order.filter((m) => present.has(m)), ...unique.filter((m) => !order.includes(m))]
}

/** 1 measure × 2 dimensions (755's table): the first dimension across, the second down. */
export function toHeatmapView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
): HeatmapView {
  // 864 (spec 3543 decision 12): an "All" row of a cross-area answer is never drawn (`./unsplit`).
  result = drawnResult(result)
  const measureKey = firstKey(definition.query.measures, result, 'measure')
  const xKey = firstKey(definition.query.dimensions, result, 'dimension', 0)
  const yKey = firstKey(definition.query.dimensions, result, 'dimension', 1)
  const xn = memberLabeller(xKey, model, lang)
  const yn = memberLabeller(yKey, model, lang)

  const values = new Map<string, number | null>()
  const at = (x: string, y: string) => `${x}\u0000${y}`
  for (const r of result.rows) values.set(at(String(r[xKey] ?? ''), String(r[yKey] ?? '')), num(r[measureKey]))
  const xs = membersOf(result.rows.map((r) => String(r[xKey] ?? '')), xn.order)
  const ys = membersOf(result.rows.map((r) => String(r[yKey] ?? '')), yn.order)

  const present = [...values.values()].filter((v): v is number => v !== null)
  const min = present.length ? Math.min(...present) : null
  const max = present.length ? Math.max(...present) : null

  const cells: HeatmapCell[] = []
  for (const x of xs)
    for (const y of ys) {
      const value = values.get(at(x, y)) ?? null
      const weight = value === null || min === null || max === null ? null : sequentialWeight(value, min, max)
      cells.push({ x, y, value, weight, fill: weight === null ? null : sequentialFill(weight) })
    }

  return {
    kind: 'heatmap',
    measure: viewMeasureOf(measureKey, model, result, lang),
    x: xn.category,
    y: yn.category,
    xs: xs.map((member) => ({ member, label: xn.label(member) })),
    ys: ys.map((member) => ({ member, label: yn.label(member) })),
    cells,
    min,
    max,
    empty: present.length === 0,
  }
}

// ── Table with cell bars ─────────────────────────────────────────────────────────────────────────────

export interface TableColumn {
  key: string
  role: 'dimension' | 'measure'
  label: string
  /** A measure's unit, for its format. */
  unit?: ViewMeasure['unit']
  /** A measure column's largest absolute value: the cell bars' full width. */
  max?: number
  /** 864 (spec 3543 decision 14): the header's tooltip on a cross-area panel (its date basis, "not filtered by ..."). */
  tooltip?: string
}

export interface TableView {
  kind: 'table'
  columns: TableColumn[]
  /** The rows after the sort and the top N; a dimension's member is replaced by its label. */
  rows: Record<string, string | number | null>[]
  /** Each row's first-dimension member key, by row (772: a row click cross-filters on it). */
  members: string[]
  sort: { key: string; direction: 'asc' | 'desc' } | null
  /** True when the top N cut rows off. */
  cut: boolean
  empty: boolean
}

/**
 * How a table form is drawn, beyond its answer: the screen's words (`./panel-table` {@link TableWords}, the same the
 * downloads take — `series` 825, `previous` spec 3519 item 11, `all` and `tooltip` 864) and whether it keeps the rows
 * as sent. Absent words read as the keys ('series', the previous key) and an empty "All".
 */
export interface TableViewOptions extends Partial<TableWords> {
  /**
   * 868 (BackOffice spec 3558 D5): the copilot's answer table is drawn AS SENT — the result's own row order (its
   * `order`, or a running share's), no sort arrow and no top N; a header click still re-sorts in the grid.
   */
  asSent?: boolean
}

/** Any measures × 1–3 dimensions (755's table): sort, top N, cell bars on the numeric columns. */
export function toTableView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
  options: TableViewOptions = {},
): TableView {
  const { series: seriesHeader = 'series', previous: previousHeader = previousKey, all: allWord = '', tooltip: tooltipOf, asSent = false } = options
  const dimKeys = definition.query.dimensions.length
    ? definition.query.dimensions
    : result.columns.filter((c) => c.role === 'dimension').map((c) => c.key)
  // 861: the query's measures, then the calculated columns the server returned.
  const measureKeys = measureKeysOf(definition, result)
  const namers = new Map(dimKeys.map((k) => [k, memberLabeller(k, model, lang)]))
  // 825: named series — a series column first, each row named by its series; a series the view lacks is dropped.
  const named = seriesOf(definition)
  const seriesKey = seriesColumnOf(result.columns)
  const seriesNames = new Map(named.map((s) => [s.id, seriesName(s, lang)]))
  const inSeries = named.length ? result.rows.filter((r) => seriesNames.has(String(r[seriesKey] ?? ''))) : result.rows
  // 864 (decision 12): the "All" rows are kept out of the sort and the top N, and listed after them (`./unsplit`).
  const { split: source, totals } = splitThenTotals(inSeries)
  // Compared with the previous period: a previous column after each of the query's measures (`./previous-rows`).
  const withPrevious = new Set(previousMeasures(definition, result))
  const previousOf = previousMatcher(result, dimKeys, model, named.length ? [seriesKey] : [])

  const sort = definition.chart.sort ?? (measureKeys[0] ? { key: measureKeys[0], direction: 'desc' as const } : null)
  // Spec 3543 decision 3: a running share within a parent comes back grouped by parent, each parent already cut to the
  // top N by the server ("top N in each {parent}"), so it is drawn as it comes — a sort or a cut here would mix parents.
  const perParent = (definition.query.calculations ?? []).some((c) => c.kind === 'cumulativeShare' && (c.within?.length ?? 0) > 0)
  const keepOrder = perParent || asSent
  const sorted = [...source]
  if (sort && !keepOrder) {
    const sign = sort.direction === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1 // gaps last, either way
      return sign * (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv)))
    })
  }
  const topN = definition.chart.topN
  const kept = topN && topN > 0 && !keepOrder ? sorted.slice(0, topN) : sorted

  const rows = [...kept, ...totals].map((r) => {
    const out: Record<string, string | number | null> = {}
    if (named.length) out[seriesKey] = seriesNames.get(String(r[seriesKey] ?? '')) ?? ''
    for (const k of dimKeys) out[k] = r[k] == null && isTotalRow(r) ? allWord : namers.get(k)!.label(String(r[k] ?? ''))
    const before = withPrevious.size ? previousOf(r) : undefined
    for (const k of measureKeys) {
      out[k] = num(r[k])
      if (withPrevious.has(k)) out[previousKey(k)] = num(before?.[k])
    }
    return out
  })
  const columns: TableColumn[] = [
    ...(named.length ? [{ key: seriesKey, role: 'dimension' as const, label: seriesHeader }] : []),
    ...dimKeys.map((k) => ({ key: k, role: 'dimension' as const, label: namers.get(k)!.category.label })),
    ...measureKeys.flatMap((k) => {
      const m = viewMeasureOf(k, model, result, lang)
      const tooltip = tooltipOf?.(k)
      const column = (key: string, label: string) => ({
        key,
        role: 'measure' as const,
        label,
        unit: m.unit,
        max: Math.max(0, ...rows.map((r) => Math.abs(num(r[key]) ?? 0))),
        ...(tooltip ? { tooltip } : {}),
      })
      return withPrevious.has(k) ? [column(k, m.label), column(previousKey(k), previousHeader(m.label))] : [column(k, m.label)]
    }),
  ]
  const members = kept.map((r) => String(r[dimKeys[0]] ?? ''))
  // The grid applies the sort it is handed, so a per-parent table hands it none (it would interleave the parents again).
  return { kind: 'table', columns, rows, members, sort: keepOrder ? null : sort, cut: kept.length < sorted.length, empty: result.rows.length === 0 }
}

// ── Combo ────────────────────────────────────────────────────────────────────────────────────────────

export interface ComboPoint {
  member: string
  label: string
  volume: number | null
  rate: number | null
  /** 825: with named series, each series' volume and rate here, by series id (`volume`/`rate` stay null). */
  bySeries?: Record<string, { volume: number | null; rate: number | null }>
}

export interface ComboView {
  kind: 'combo'
  category: { key: string; label: string; kind: 'time' | 'category' }
  /** Drawn as bars, in the upper pane. */
  volume: ViewMeasure
  /** Drawn as a line, in the lower pane. */
  rate: ViewMeasure
  points: ComboPoint[]
  /** 825: the named series, in slot order — each drawn in both panes in its own colour. Empty without. */
  series: NamedSeries[]
  empty: boolean
}

/**
 * 1 volume measure + 1 rate measure × time or category (755's table). Two panes on one shared x-axis,
 * each with its own single y-axis (766 §E amendment 1) — never one chart with two y-axes.
 * The additive measure is the volume and the other the rate, whatever order the definition names them.
 */
export function toComboView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
): ComboView {
  // 864 (spec 3543 decision 12): an "All" row of a cross-area answer is never drawn (`./unsplit`).
  result = drawnResult(result)
  // 861: a calculated share is a rate measure, so it is the combo's line.
  const keys = measureKeysOf(definition, result)
  const measures = keys.map((k) => viewMeasureOf(k, model, result, lang))
  const volume = measures.find((m) => m.shape === 'additive') ?? measures[0]
  const rate = measures.find((m) => m !== volume) ?? volume
  const dimensionKey = firstKey(definition.query.dimensions, result, 'dimension')
  const names = memberLabeller(dimensionKey, model, lang)

  if (seriesOf(definition).length) {
    const merged = mergeSeries(result, definition, lang)
    const points = [...merged.points]
    if (names.category.kind === 'time') points.sort((a, b) => (a.at[dimensionKey] ?? '').localeCompare(b.at[dimensionKey] ?? ''))
    return {
      kind: 'combo',
      category: names.category,
      volume,
      rate,
      series: merged.series,
      points: points.map((p) => {
        const member = p.at[dimensionKey] ?? ''
        const bySeries = Object.fromEntries(
          merged.series.map((s) => [s.id, { volume: num(p.values[s.id]?.[volume?.key ?? '']), rate: num(p.values[s.id]?.[rate?.key ?? '']) }]),
        )
        return { member, label: names.label(member), volume: null, rate: null, bySeries }
      }),
      empty: points.length === 0,
    }
  }

  const rows = [...result.rows]
  // A time axis reads in time order (`yyyy-MM-dd` sorts as text); a category axis as the answer ranks it.
  if (names.category.kind === 'time') rows.sort((a, b) => String(a[dimensionKey] ?? '').localeCompare(String(b[dimensionKey] ?? '')))
  return {
    kind: 'combo',
    category: names.category,
    volume,
    rate,
    series: [],
    points: rows.map((r) => {
      const member = String(r[dimensionKey] ?? '')
      return { member, label: names.label(member), volume: num(r[volume?.key ?? '']), rate: num(r[rate?.key ?? '']) }
    }),
    empty: rows.length === 0,
  }
}
