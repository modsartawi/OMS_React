import { useTranslation } from 'react-i18next'
import KpiTile from '@/core/charts/KpiTile'
import SeriesChart from '@/core/charts/SeriesChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { hasSeries } from './series'
import { toKpiView, toKpiViews, toSeriesView } from './series-view'
import { slotColour } from '@/core/charts/slots'

/**
 * The 768 forms on the view page: KPI, line, stacked area, and every bar but 767's single-series
 * vertical one (which stays on `VerticalBarChart`). A thin renderer over `series-view.ts`.
 */
export function drawsAsSeries(def: AnalyticsViewDefinition): boolean {
  const { type, orientation } = def.chart
  if (type === 'kpi' || type === 'line' || type === 'area') return true
  // 825: a bar with named series is a series chart, whatever its shape (767's bar draws one series).
  // Spec 3519 item 11: a bar compared with the previous period draws its previous series beside it.
  return (
    type === 'bar' &&
    (orientation === 'horizontal' || def.query.measures.length > 1 || def.query.dimensions.length > 1 || hasSeries(def) || def.query.compareToPrevious === true)
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
        delta={kpi.delta}
        spark={kpi.spark}
        unit={kpi.measure.unit}
        format={kpi.format}
        locale={lang}
      />
    )
  }

  const view = toSeriesView(result, definition, model, lang)
  if (view.kind === 'refused') {
    return (
      <p className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground" role="alert" data-analytics-refused={view.reason}>
        {t('view.rateStacked', { measure: fsi(view.measure) })}
      </p>
    )
  }
  if (view.empty) return <Empty />
  const form = view.form === 'bar' ? `bar.${view.stacking === 'none' ? view.orientation : view.stacking}` : view.form
  return (
    <>
    <SeriesChart
      form={view.form}
      orientation={view.orientation}
      stacking={view.stacking}
      series={view.series}
      rows={view.rows}
      colourBy={view.colourBy}
      unit={view.unit}
      format={view.format}
      locale={lang}
      otherCount={view.folded}
      // 825: clicking a named series highlights it and never cross-filters.
      onPoint={onPoint && view.form === 'bar' && !hasSeries(definition) ? (x) => onPoint(view.x.key, x) : undefined}
      legend={definition.chart.legend}
      ariaLabel={tc(`charts.formLabel.${form}`, { measure: fsi(view.measureLabel), dimension: fsi(view.x.label) })}
    />
    {/* A rate's members past five are drawn nowhere (no "Other" can sum a rate): say how many (766 §E amendment 2). */}
    {view.notShown > 0 && (
      <p className="text-xs text-muted-foreground" data-analytics-not-shown={view.notShown}>
        {t('view.notShown', { count: view.notShown, n: fsi(view.notShown), measure: fsi(view.measureLabel) })}
      </p>
    )}
    </>
  )
}

function Empty() {
  const { t } = useTranslation('boards')
  return (
    <p className="flex h-72 items-center justify-center text-sm text-muted-foreground" data-analytics-empty>
      {t('view.empty')}
    </p>
  )
}
