import { CHART_SLOT_COUNT } from '@/core/charts/slots'
import type { AnalyticsChart, AnalyticsModel } from '@/core/models/analytics'
import { dimensionOf, measureOf } from './wire'

/**
 * The shape rules (spec 766 §E: 755 Q3's table, with amendment 1 — combo is two panes, one volume and
 * one rate — and amendment 2 — five colours, then "Other"), ticket 775. Given what the editor has
 * chosen and the model, which chart types are offered, and why each other one is not.
 *
 * The web's copy of the table exists ONLY to choose what to offer: the server validates the same rules
 * and refuses the rest with `ANALYTICS-406`, and it stays the authority. Pure: no React.
 *
 * Bars are four choices (vertical, horizontal, stacked, grouped) because a stacked bar obeys a rule the
 * others do not: a rate or percentile is never stacked.
 */
export const CHART_CHOICES = [
  'kpi',
  'line',
  'area',
  'bar-vertical',
  'bar-horizontal',
  'bar-stacked',
  'bar-grouped',
  'donut',
  'table',
  'heatmap',
  'combo',
] as const
export type ChartChoice = (typeof CHART_CHOICES)[number]

/** Why a choice is not offered: each is a `boards:editor.why.<reason>` key. */
export type UnavailableReason =
  | 'noMeasure'
  | 'kpiShape'
  | 'needsTime'
  | 'lineShape'
  | 'areaShape'
  | 'rateStacked'
  | 'barShape'
  | 'needsSeries'
  | 'donutShape'
  | 'donutAdditive'
  | 'tableShape'
  | 'heatmapShape'
  | 'comboShape'

export type ChartOffer =
  /** `folds` — the breakdown drawn as colours may hold more than the palette's five: the rest is "Other". */
  | { choice: ChartChoice; offered: true; folds: boolean }
  | { choice: ChartChoice; offered: false; reason: UnavailableReason }

export interface ShapeSelection {
  measures: readonly string[]
  dimensions: readonly string[]
}

export function chartOffers(sel: ShapeSelection, model: AnalyticsModel): ChartOffer[] {
  const measures = sel.measures.map((k) => measureOf(model, k))
  const additive = measures.map((m) => (m?.shape ?? 'additive') === 'additive')
  const allAdditive = additive.every(Boolean)
  const dims = sel.dimensions.map((k) => dimensionOf(model, k))
  const isTime = (i: number) => dims[i]?.kind === 'time'
  const nM = measures.length
  const nD = dims.length
  const timeAt = dims.findIndex((_, i) => isTime(i))
  const categories = dims.map((_, i) => i).filter((i) => !isTime(i))

  /** More members than the palette's five could be drawn: an open list, or more inline values than slots. */
  const mayFold = (i: number | undefined): boolean => {
    if (i === undefined || i < 0) return false
    const d = dims[i]
    return !d || d.values.length === 0 || d.values.length > CHART_SLOT_COUNT
  }

  const rule = (choice: ChartChoice): ChartOffer => {
    const no = (reason: UnavailableReason): ChartOffer => ({ choice, offered: false, reason })
    const yes = (folds = false): ChartOffer => ({ choice, offered: true, folds })
    if (nM === 0) return no('noMeasure')

    switch (choice) {
      case 'kpi':
        return nM === 1 && (nD === 0 || (nD === 1 && isTime(0))) ? yes() : no('kpiShape')
      case 'line': {
        if (timeAt < 0) return no('needsTime')
        if (nD === 1 && nM <= 4) return yes()
        if (nD === 2 && nM === 1 && categories.length === 1) return yes(mayFold(categories[0]))
        return no('lineShape')
      }
      case 'area': {
        if (!(nM === 1 && nD === 2 && timeAt >= 0 && categories.length === 1)) return no('areaShape')
        return allAdditive ? yes(mayFold(categories[0])) : no('rateStacked')
      }
      case 'bar-vertical':
      case 'bar-horizontal':
      case 'bar-stacked':
      case 'bar-grouped': {
        const fits = (nD === 1 && nM <= 3) || (nD === 2 && nM === 1)
        if (!fits) return no('barShape')
        const twoSeries = nM > 1 || nD === 2
        if (choice === 'bar-vertical' || choice === 'bar-horizontal') return yes()
        if (!twoSeries) return no('needsSeries')
        if (choice === 'bar-stacked' && !allAdditive) return no('rateStacked')
        // The second dimension is the series (the first is the axis, as 768's bar draws it).
        return yes(nD === 2 && mayFold(1))
      }
      case 'donut': {
        if (!(nM === 1 && nD === 1 && !isTime(0))) return no('donutShape')
        return allAdditive ? yes(mayFold(0)) : no('donutAdditive')
      }
      case 'table':
        return nD >= 1 && nD <= 3 ? yes() : no('tableShape')
      case 'heatmap':
        return nM === 1 && nD === 2 ? yes() : no('heatmapShape')
      case 'combo':
        return nM === 2 && nD === 1 && additive.filter(Boolean).length === 1 ? yes() : no('comboShape')
    }
  }

  return CHART_CHOICES.map(rule)
}

/** The choice a saved chart is. */
export function choiceOf(chart: AnalyticsChart): ChartChoice {
  if (chart.type !== 'bar') return chart.type
  if (chart.orientation === 'horizontal') return 'bar-horizontal'
  if (chart.stack === 'stacked') return 'bar-stacked'
  if (chart.stack === 'grouped') return 'bar-grouped'
  return 'bar-vertical'
}

/** The chart a choice saves as, keeping the chart's own settings (format, sort, top N, legend). */
export function chartFor(choice: ChartChoice, chart: AnalyticsChart): AnalyticsChart {
  const { orientation: _o, stack: _s, ...rest } = chart
  void _o
  void _s
  switch (choice) {
    case 'bar-vertical':
      return { ...rest, type: 'bar', orientation: 'vertical' }
    case 'bar-horizontal':
      return { ...rest, type: 'bar', orientation: 'horizontal' }
    case 'bar-stacked':
      return { ...rest, type: 'bar', orientation: 'vertical', stack: 'stacked' }
    case 'bar-grouped':
      return { ...rest, type: 'bar', orientation: 'vertical', stack: 'grouped' }
    default:
      return { ...rest, type: choice }
  }
}

/**
 * The type the builder picks for you when you have not picked one, or yours no longer fits (CTO demo builder pass):
 * a single figure → KPI; over time → line; one category → bars (horizontal for an open list such as stores, whose
 * names are long); two breakdowns → grouped bars, else a heat map; otherwise a table. Always one that is offered.
 */
export function suggestChoice(offers: readonly ChartOffer[], sel: ShapeSelection, model: AnalyticsModel): ChartChoice | null {
  const ok = new Set(offers.filter((o) => o.offered).map((o) => o.choice))
  if (ok.size === 0) return null
  const dims = sel.dimensions.map((k) => dimensionOf(model, k))
  const hasTime = dims.some((d) => d?.kind === 'time')
  const open = dims[0] ? dims[0].kind !== 'time' && dims[0].values.length === 0 : false
  const order: ChartChoice[] =
    dims.length === 0
      ? ['kpi', 'table']
      : hasTime
        ? ['line', 'area', 'table']
        : dims.length === 1
          ? open
            ? ['bar-horizontal', 'bar-vertical', 'table']
            : sel.measures.length === 1 && (dims[0]?.values.length ?? 0) <= 5
              ? ['donut', 'bar-vertical', 'table']
              : ['bar-vertical', 'combo', 'table']
          : ['bar-grouped', 'heatmap', 'table']
  return order.find((c) => ok.has(c)) ?? CHART_CHOICES.find((c) => ok.has(c)) ?? null
}
