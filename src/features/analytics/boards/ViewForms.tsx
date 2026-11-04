import { useTranslation } from 'react-i18next'
import ComboChart from '@/core/charts/ComboChart'
import DonutChart from '@/core/charts/DonutChart'
import { formatDay } from '@/core/charts/format'
import HeatmapChart from '@/core/charts/HeatmapChart'
import TableChart from '@/core/charts/TableChart'
import type { AnalyticsChartType, AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { toComboView, toDonutView, toHeatmapView, toTableView } from './view-model-forms'

/**
 * The donut, the table with cell bars, the heatmap and the combo (ticket 769) — the forms the view
 * page switches to beside its bar. Each turns the answer into its view model (`./view-model-forms`) and
 * hands the plain result to its `core/charts` form. The page's `ChartFrame` and empty state wrap it.
 */
export const VIEW_FORMS = ['donut', 'table', 'heatmap', 'combo'] as const satisfies readonly AnalyticsChartType[]
export type ViewFormType = (typeof VIEW_FORMS)[number]

export const isViewForm = (type: AnalyticsChartType): type is ViewFormType => (VIEW_FORMS as readonly string[]).includes(type)

/** The member key "Other" draws under; never a real member (the view model folds into it). */
const OTHER = '\u0000other'

export default function ViewForm({
  type,
  result,
  definition,
  model,
  lang,
}: {
  type: ViewFormType
  result: AnalyticsQueryResult
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
}) {
  const { t } = useTranslation('boards')
  const { t: tc } = useTranslation('common')

  if (type === 'donut') {
    const view = toDonutView(result, definition, model, lang)
    if (view.kind === 'refused') {
      return (
        <p className="flex h-40 items-center justify-center text-sm text-muted-foreground" role="alert" data-analytics-refused="donut-shape">
          {t('view.donutRefused', { measure: fsi(view.measure.label) })}
        </p>
      )
    }
    const slices = [
      ...view.slices,
      ...(view.other ? [{ member: OTHER, label: tc('charts.other', { count: view.other.count, n: fsi(view.other.count) }), value: view.other.value, slot: null }] : []),
    ]
    return (
      <DonutChart
        slices={slices}
        total={view.total}
        unit={view.measure.unit}
        locale={lang}
        ariaLabel={tc('charts.donutLabel', { measure: fsi(view.measure.label), dimension: fsi(view.category.label) })}
      />
    )
  }

  if (type === 'table') {
    const view = toTableView(result, definition, model, lang)
    const dims = view.columns.filter((c) => c.role === 'dimension').map((c) => c.label)
    const measures = view.columns.filter((c) => c.role === 'measure').map((c) => c.label)
    return (
      <div className="flex flex-col gap-1.5">
        <TableChart
          columns={view.columns}
          rows={view.rows}
          sort={view.sort}
          locale={lang}
          ariaLabel={tc('charts.tableLabel', { measures: fsi(measures.join(', ')), dimensions: fsi(dims.join(', ')) })}
        />
        {view.cut && (
          <p className="text-xs text-muted-foreground" data-table-top-n>
            {t('view.topN', { count: view.rows.length, n: fsi(view.rows.length) })}
          </p>
        )}
      </div>
    )
  }

  if (type === 'heatmap') {
    const view = toHeatmapView(result, definition, model, lang)
    return (
      <HeatmapChart
        xs={view.xs}
        ys={view.ys}
        cells={view.cells}
        min={view.min}
        max={view.max}
        xLabel={view.x.label}
        yLabel={view.y.label}
        unit={view.measure.unit}
        measureLabel={view.measure.label}
        locale={lang}
        ariaLabel={tc('charts.heatmapLabel', { measure: fsi(view.measure.label), x: fsi(view.x.label), y: fsi(view.y.label) })}
      />
    )
  }

  const view = toComboView(result, definition, model, lang)
  const points =
    view.category.kind === 'time' ? view.points.map((p) => ({ ...p, label: formatDay(p.member, lang) || p.label })) : view.points
  return (
    <ComboChart
      points={points}
      volume={view.volume}
      rate={view.rate}
      locale={lang}
      ariaLabel={tc('charts.comboLabel', { volume: fsi(view.volume.label), rate: fsi(view.rate.label), dimension: fsi(view.category.label) })}
    />
  )
}
