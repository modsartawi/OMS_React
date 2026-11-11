import type {
  AnalyticsChart,
  AnalyticsItem,
  AnalyticsLabel,
  AnalyticsModel,
  AnalyticsReportBlock,
  AnalyticsSeries,
  AnalyticsViewDefinition,
} from '@/core/models/analytics'
import { settleCalculations } from './calculations-edit'
import { allowedDimensions, comparesToPrevious, DEFAULT_PERIOD, GRAINS, grainFor, MAX_DIMENSIONS, pickableMeasures, withCompare, withLastYear, type Grain } from './editor'
import { seriesOf } from './series'
import { chartFor, chartOffers, choiceOf, suggestChoice, type ChartChoice, type ChartOffer } from './shape-rules'
import { baseMeasureKey, settleVariants } from './variants'
import { measureOf } from './wire'

/**
 * The report designer's panel edits (spec 819 §E, ticket 829) — pure functions of a panel's inline view
 * definition. The view editor (775) keeps its pieces in React state and builds the definition at the end; a
 * report panel's definition IS the draft, so each edit here is one whole new definition, one history step.
 *
 * After every change of what is measured or broken down, the chart is **re-fitted** (v1's shape table, 766 §E):
 * the chosen type stays while it is still offered; otherwise the builder's suggestion takes its place, so the
 * panel always draws a type that fits. Compare-with-previous stays only where the type shows it; a grain only
 * with a date breakdown; filters only on dimensions the measures still allow.
 */

/** A Cube panel block (891: a SQL block, held by reference, is not edited here). */
export type PanelBlock = Exclude<Extract<AnalyticsReportBlock, { kind: 'panel' }>, { engine: 'sql' }>

/** The chart types for this definition's selection: each offered, or why not. */
export const panelOffers = (def: AnalyticsViewDefinition, model: AnalyticsModel): ChartOffer[] =>
  chartOffers(
    {
      measures: def.query.measures,
      dimensions: def.query.dimensions,
      series: seriesOf(def).length,
      calculations: def.query.calculations?.length ?? 0,
    },
    model,
  )

/**
 * The area a panel measures in: its first measure's (a variant key read as its measure — 863's gap, a panel of variants
 * only). `null` with no measure. 864: a cross-area panel reads more; this is the one the area picker shows.
 */
export const panelArea = (def: AnalyticsViewDefinition, model: AnalyticsModel): string | null =>
  measureOf(model, def.query.measures[0])?.area ?? measureOf(model, baseMeasureKey(def, def.query.measures[0]))?.area ?? null

/** The definition with its chart fitted to its selection, and the query tidied to it. */
export function fitted(raw: AnalyticsViewDefinition, model: AnalyticsModel): AnalyticsViewDefinition {
  // Spec 3543 (863): first a variant unticked, or now filtered on a breakdown, goes with its key…
  // Spec 3519 (862): …then the calculations the query no longer allows (`droppedBy` names them for the note).
  const def = settleCalculations(settleVariants(raw, model).definition, model).definition
  const offers = panelOffers(def, model)
  const was = choiceOf(def.chart)
  const fits = offers.find((o) => o.choice === was)?.offered === true
  const choice: ChartChoice | null = fits
    ? was
    : suggestChoice(
        offers,
        {
          measures: def.query.measures,
          dimensions: def.query.dimensions,
          series: seriesOf(def).length,
          calculations: def.query.calculations?.length ?? 0,
        },
        model,
      )
  const chart: AnalyticsChart = choice && choice !== was ? chartFor(choice, def.chart) : def.chart
  const allowed = new Set(allowedDimensions(def.query.measures, model).map((d) => d.key))
  const { grain, ...rest } = def.query
  const kept = grainFor(def.query.dimensions, model, (GRAINS as readonly string[]).includes(grain ?? '') ? (grain as Grain) : 'day')
  // 876: last year stays where the previous period does — only where the type shows a comparison.
  const query = withLastYear(
    withCompare(
      {
        ...rest,
        filters: def.query.filters.filter((f) => allowed.has(f.dimension)),
        ...(kept ? { grain: kept } : {}),
      },
      choice ?? was,
      def.query.compareToPrevious === true,
    ),
    choice ?? was,
    def.query.compareToLastYear === true,
  )
  // …and again once compare is settled: a change goes with it (decision 8).
  return settleCalculations({ ...def, chart, query }, model).definition
}

/** New measures: the breakdowns they no longer allow go, and the chart is re-fitted. */
export function withMeasures(def: AnalyticsViewDefinition, measures: string[], model: AnalyticsModel): AnalyticsViewDefinition {
  const allowed = new Set(allowedDimensions(measures, model).map((d) => d.key))
  return fitted(
    {
      ...def,
      query: {
        ...def.query,
        measures,
        dimensions: def.query.dimensions.filter((d) => allowed.has(d)),
      },
    },
    model,
  )
}

/** New breakdowns (the first is the axis), at most {@link MAX_DIMENSIONS}; the chart is re-fitted. */
export const withDimensions = (def: AnalyticsViewDefinition, dimensions: string[], model: AnalyticsModel): AnalyticsViewDefinition =>
  fitted(
    {
      ...def,
      query: { ...def.query, dimensions: dimensions.slice(0, MAX_DIMENSIONS) },
    },
    model,
  )

/** A filter's members (none removes the filter). */
export const withFilter = (def: AnalyticsViewDefinition, dimension: string, values: string[]): AnalyticsViewDefinition => ({
  ...def,
  query: {
    ...def.query,
    filters: [...def.query.filters.filter((f) => f.dimension !== dimension), ...(values.length ? [{ dimension, values }] : [])],
  },
})

/** The panel's own period (a period parameter bound to the panel overrides it on a run). */
export const withPeriod = (def: AnalyticsViewDefinition, period: string): AnalyticsViewDefinition => ({ ...def, query: { ...def.query, period } })

/** The date breakdown's grain (`day` is the server's default, left out). */
export const withGrain = (def: AnalyticsViewDefinition, grain: Grain, model: AnalyticsModel): AnalyticsViewDefinition =>
  fitted({ ...def, query: { ...def.query, grain } }, model)

/** A chosen chart type — only an offered one takes. */
export function withChoice(def: AnalyticsViewDefinition, choice: ChartChoice, model: AnalyticsModel): AnalyticsViewDefinition {
  if (!panelOffers(def, model).find((o) => o.choice === choice)?.offered) return def
  return fitted({ ...def, chart: chartFor(choice, def.chart) }, model)
}

/** Compare with the previous period, where the type shows it (KPI, line). */
export const withComparing = (def: AnalyticsViewDefinition, on: boolean, model: AnalyticsModel): AnalyticsViewDefinition =>
  settleCalculations({ ...def, query: withCompare(def.query, choiceOf(def.chart), on) }, model).definition

/** 876: compare with the same weeks last year, where the type shows a comparison; independent of the previous period's. */
export const withComparingLastYear = (def: AnalyticsViewDefinition, on: boolean, model: AnalyticsModel): AnalyticsViewDefinition =>
  settleCalculations({ ...def, query: withLastYear(def.query, choiceOf(def.chart), on) }, model).definition

/** The chart's own settings (format, legend, sort, top N), its type kept. */
export const withSettings = (def: AnalyticsViewDefinition, f: (chart: AnalyticsChart) => AnalyticsChart, model: AnalyticsModel): AnalyticsViewDefinition => {
  const next = f(def.chart)
  // A running share keeps the order on its measure (spec 3519 D7): the settle puts it back.
  return settleCalculations({
    ...def,
    chart: {
      ...next,
      type: def.chart.type,
      orientation: def.chart.orientation,
      stack: def.chart.stack,
    },
  }, model).definition
}

/** The named series (825): none leaves no `series` at all; the chart is re-fitted (a donut takes none). */
export function withSeries(def: AnalyticsViewDefinition, series: AnalyticsSeries[], model: AnalyticsModel): AnalyticsViewDefinition {
  const { series: _old, ...rest } = def
  void _old
  return fitted(series.length ? { ...rest, series } : rest, model)
}

/** Whether the panel's chart compares with the previous period where it may. */
export const comparing = (def: AnalyticsViewDefinition): boolean => comparesToPrevious(choiceOf(def.chart)) && def.query.compareToPrevious === true

/** 876: whether the panel's chart compares with the same weeks last year where it may. */
export const comparingLastYear = (def: AnalyticsViewDefinition): boolean => comparesToPrevious(choiceOf(def.chart)) && def.query.compareToLastYear === true

/**
 * A new chart or table: the first measure of the first area available, as one figure (a KPI), over the default
 * period — a panel that draws at once, for the author to reshape.
 */
export function blankPanelDefinition(model: AnalyticsModel): AnalyticsViewDefinition {
  const first = pickableMeasures(model)[0]
  return fitted(
    {
      chart: { type: 'kpi' },
      query: {
        measures: first ? [first.key] : [],
        dimensions: [],
        filters: [],
        period: DEFAULT_PERIOD,
      },
    },
    model,
  )
}

/** A new panel block. */
export const panelBlock = (id: string, definition: AnalyticsViewDefinition, title: AnalyticsLabel = { en: '', ar: '' }): PanelBlock => ({
  id,
  kind: 'panel',
  title,
  definition,
})

/**
 * "Copy a saved view" (801 §2): the view's definition copied inline (the report's own from now on), its title,
 * and where it came from — the view and the revision copied.
 */
export const copiedPanel = (id: string, view: Pick<AnalyticsItem, 'id' | 'revision' | 'title' | 'definition'>): PanelBlock => ({
  id,
  kind: 'panel',
  title: view.title,
  definition: view.definition,
  from: { viewId: view.id, revision: view.revision },
})

/**
 * Whether the original changed since the copy (801 §2): the server's `sourceChangedSinceCopy`, or the source
 * view as read now holds a later revision than the one copied. A source not read (or gone) leaves the server's word.
 */
export function sourceChanged(block: PanelBlock, source: Pick<AnalyticsItem, 'revision'> | null | undefined): boolean {
  if (!block.from) return false
  return block.sourceChangedSinceCopy === true || (!!source && source.revision > block.from.revision)
}
