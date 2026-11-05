import { useTranslation } from 'react-i18next'
import KpiTile from '@/core/charts/KpiTile'
import SeriesChart from '@/core/charts/SeriesChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { toKpiView, toSeriesView } from './series-view'

/**
 * The 768 forms on the view page: KPI, line, stacked area, and every bar but 767's single-series
 * vertical one (which stays on `VerticalBarChart`). A thin renderer over `series-view.ts`.
 */
export function drawsAsSeries(def: AnalyticsViewDefinition): boolean {
  const { type, orientation } = def.chart
  if (type === 'kpi' || type === 'line' || type === 'area') return true
  return type === 'bar' && (orientation === 'horizontal' || def.query.measures.length > 1 || def.query.dimensions.length > 1)
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
      onPoint={onPoint && view.form === 'bar' ? (x) => onPoint(view.x.key, x) : undefined}
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
