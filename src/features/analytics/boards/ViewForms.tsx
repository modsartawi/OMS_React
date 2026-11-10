import { useTranslation } from 'react-i18next'
import ComboChart from '@/core/charts/ComboChart'
import DonutChart from '@/core/charts/DonutChart'
import { formatDay } from '@/core/charts/format'
import HeatmapChart from '@/core/charts/HeatmapChart'
import TableChart from '@/core/charts/TableChart'
import type { AnalyticsChartType, AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import type { MarkPoint } from './drill'
import { hasSeries, seriesColumnOf } from './series'
import { toComboView, toDonutView, toHeatmapView, toTableView } from './view-model-forms'
import { useAreaNoteWords, useTableWords } from './AreaNotes'
import { columnTooltip } from './unsplit'

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
  onPoint,
  selected,
}: {
  type: ViewFormType
  result: AnalyticsQueryResult
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  /** 772: a click on a slice or a table row reports its category dimension and member. */
  onPoint?: (dimension: string, member: string) => void
  selected?: MarkPoint | null
}) {
  const { t } = useTranslation('boards')
  const { t: tc } = useTranslation('common')
  const noteWords = useAreaNoteWords()
  const tableWords = useTableWords()

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
        onPoint={onPoint ? (member) => member !== OTHER && onPoint(view.category.key, member) : undefined}
        selected={selected?.dimension === view.category.key ? selected.member : null}
        ariaLabel={tc('charts.donutLabel', { measure: fsi(view.measure.label), dimension: fsi(view.category.label) })}
      />
    )
  }

  if (type === 'table') {
    // 864 (spec 3543 decisions 12, 14): "All" rows after the sorted rows, and a cross-area column's date basis.
    const view = toTableView(result, definition, model, lang, { ...tableWords, tooltip: (key) => columnTooltip(key, result, model, lang, noteWords) })
    // 825: the series column is not a dimension a row click cross-filters on.
    const seriesKey = hasSeries(definition) ? seriesColumnOf(result.columns) : null
    const dims = view.columns.filter((c) => c.role === 'dimension' && c.key !== seriesKey).map((c) => c.label)
    const measures = view.columns.filter((c) => c.role === 'measure').map((c) => c.label)
    const first = view.columns.find((c) => c.role === 'dimension' && c.key !== seriesKey)?.key ?? ''
    const selectedRow = selected?.dimension === first ? view.members.indexOf(selected.member) : -1
    return (
      <div className="flex flex-col gap-1.5">
        <TableChart
          columns={view.columns}
          rows={view.rows}
          sort={view.sort}
          locale={lang}
          onRow={onPoint && first ? (i) => view.members[i] !== undefined && onPoint(first, view.members[i]) : undefined}
          selectedRow={selectedRow >= 0 ? selectedRow : null}
          ariaLabel={tc('charts.tableLabel', { measures: fsi(listText(measures, lang)), dimensions: fsi(listText(dims, lang)) })}
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
      series={view.series.map((x) => ({ id: x.id, label: x.label, slot: x.slot }))}
      locale={lang}
      ariaLabel={tc('charts.comboLabel', { volume: fsi(view.volume.label), rate: fsi(view.rate.label), dimension: fsi(view.category.label) })}
    />
  )
}
