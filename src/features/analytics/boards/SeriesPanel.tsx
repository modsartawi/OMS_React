import { useTranslation } from 'react-i18next'
import KpiTile from '@/core/charts/KpiTile'
import SeriesChart from '@/core/charts/SeriesChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { hasSeries } from './series'
import { toKpiView, toKpiViews, toSeriesView, unitPanes } from './series-view'
import { slotColour } from '@/core/charts/slots'

/**
 * The 768 forms on the view page: KPI, line, stacked area, and every bar but 767's single-series
 * vertical one (which stays on `VerticalBarChart`). A thin renderer over `series-view.ts`.
 */
export function drawsAsSeries(def: AnalyticsViewDefinition): boolean {
  const { type, orientation } = def.chart
  if (type === 'kpi' || type === 'line' || type === 'area') return true
  // 825: a bar with named series is a series chart, whatever its shape (767's bar draws one series).
  // Spec 3519 item 11: a bar compared with the previous period draws its previous series beside it; 877: last year's too.
  return (
    type === 'bar' &&
    (orientation === 'horizontal' ||
      def.query.measures.length > 1 ||
      def.query.dimensions.length > 1 ||
      hasSeries(def) ||
      def.query.compareToPrevious === true ||
      def.query.compareToLastYear === true)
  )
}

export default function SeriesPanel({
  result,
  definition,
  model,
  lang,
  onPoint,
}: {
  result: AnalyticsQueryResult
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  /** 772: a click on a bar reports its category dimension and member (bars only). */
  onPoint?: (dimension: string, member: string) => void
}) {
  const { t } = useTranslation('boards')
  const { t: tc } = useTranslation('common')

  if (definition.chart.type === 'kpi' && hasSeries(definition)) {
    // 825: one figure per named series, side by side, in slot order — never a total of them.
    const tiles = toKpiViews(result, definition, model, lang)
    if (tiles.every((k) => k.empty)) return <Empty />
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(tiles.length, 4)}, minmax(0, 1fr))` }} data-kpi-series={tiles.length}>
        {tiles.map((k) => (
          <div key={k.series.id} className="min-w-0" data-kpi-series-id={k.series.id} data-slot={k.series.slot}>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: slotColour(k.series.slot) }} data-kpi-swatch aria-hidden />
              <bdi>{k.series.label}</bdi>
            </p>
            <KpiTile
              measureLabel={t('view.seriesKpiLabel', { measure: fsi(k.measure.label), series: fsi(k.series.label) })}
              value={k.value}
              previous={k.previous}
              lastYear={k.lastYear}
              delta={k.delta}
              spark={k.spark}
              unit={k.measure.unit}
              format={k.format}
              locale={lang}
              slot={k.series.slot}
            />
          </div>
        ))}
      </div>
    )
  }

  if (definition.chart.type === 'kpi') {
    const kpi = toKpiView(result, definition, model, lang)
    if (kpi.empty) return <Empty />
    return (
      <KpiTile
        measureLabel={kpi.measure.label}
        value={kpi.value}
        previous={kpi.previous}
        lastYear={kpi.lastYear}
        delta={kpi.delta}
        spark={kpi.spark}
        unit={kpi.measure.unit}
        format={kpi.format}
        locale={lang}
      />
    )
  }

  // 877: the last-year series is named with last year's dates, so it reads apart from the previous period's.
  const view = toSeriesView(result, definition, model, lang, { lastYear: (range) => t('view.lastYearSeries', { range: fsi(range) }) })
  if (view.kind === 'refused') {
    return (
      <p className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground" role="alert" data-analytics-refused={view.reason}>
        {t('view.rateStacked', { measure: fsi(view.measure) })}
      </p>
    )
  }
  if (view.empty) return <Empty />
  const form = view.form === 'bar' ? `bar.${view.stacking === 'none' ? view.orientation : view.stacking}` : view.form
  // Spec 3543 review: measures of different units (an average in SAR beside a percent) each get their own pane and axis.
  const panes = unitPanes(view)
  return (
    <>
    {panes.map((pane) => (
      <div key={pane.unit} className="flex flex-col" data-analytics-pane={pane.unit}>
      {/* One series per pane draws no legend: with two panes or more, each names its measures and its unit. */}
      {panes.length > 1 && (
        <p className="px-2 text-xs font-medium text-muted-foreground" data-analytics-pane-title={pane.unit}>
          {UNIT_WORDS.has(pane.unit)
            ? t('view.paneTitleUnit', { measures: fsi(listText(pane.labels ?? [], lang)), unit: t(`view.paneUnit.${pane.unit}`) })
            : t('view.paneTitle', { measures: fsi(listText(pane.labels ?? [], lang)) })}
        </p>
      )}
      <SeriesChart
        form={pane.form}
        orientation={pane.orientation}
        stacking={pane.stacking}
        series={pane.series}
        rows={pane.rows}
        colourBy={pane.colourBy}
        unit={pane.unit}
        format={pane.format}
        locale={lang}
        otherCount={pane.folded}
        // 825: clicking a named series highlights it and never cross-filters.
        onPoint={onPoint && pane.form === 'bar' && !hasSeries(definition) ? (x) => onPoint(pane.x.key, x) : undefined}
        legend={definition.chart.legend}
        // two panes share the one chart's height, as the combo's do
        height={panes.length > 1 ? 180 : undefined}
        ariaLabel={tc(`charts.formLabel.${form}`, { measure: fsi(pane.measureLabel), dimension: fsi(pane.x.label) })}
      />
      </div>
    ))}
    {/* A rate's members past five are drawn nowhere (no "Other" can sum a rate): say how many (766 §E amendment 2). */}
    {view.notShown > 0 && (
      <p className="text-xs text-muted-foreground" data-analytics-not-shown={view.notShown}>
        {t('view.notShown', { count: view.notShown, n: fsi(view.notShown), measure: fsi(view.measureLabel) })}
      </p>
    )}
    </>
  )
}

/** The units a pane title names; a percent or count axis already reads as itself. */
const UNIT_WORDS: ReadonlySet<string> = new Set(['SAR', 'minutes', 'seconds', 'km'])

function Empty() {
  const { t } = useTranslation('boards')
  return (
    <p className="flex h-72 items-center justify-center text-sm text-muted-foreground" data-analytics-empty>
      {t('view.empty')}
    </p>
  )
}
