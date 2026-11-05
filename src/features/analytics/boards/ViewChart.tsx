import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import ChartFrame from '@/core/charts/ChartFrame'
import VerticalBarChart from '@/core/charts/VerticalBarChart'
import type { AnalyticsItem, AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import type { MarkPoint } from './drill'
import SeriesPanel, { drawsAsSeries } from './SeriesPanel'
import { toBarView } from './view-model'
import ViewForm, { isViewForm } from './ViewForms'
import { dimensionOf, measureOf } from './wire'

/**
 * ONE view's chart, wherever a view is drawn (ticket 771): the view page and every board panel use it,
 * so a form added here draws in both. It switches on the definition's chart type and wraps the form in
 * `ChartFrame`, which keeps the previous chart dimmed while `busy` (pass the query's `isFetching`).
 *
 * The dispatch: 767's single-series vertical bar (`VerticalBarChart`), 768's forms (`SeriesPanel`),
 * 769's forms (`ViewForm`). A refusal of the answer is the caller's (the page's, or the panel's state).
 *
 * A board panel passes `onPoint` (772): a click on a bar, a slice or a table row reports the mark's
 * category dimension and member; `selected` is the point a cross-filter was clicked on here.
 */

/** A clicked mark: the category dimension it stands for, and its member key (772). */
export type PointHandler = (dimension: string, member: string) => void
export function drawsHere(def: AnalyticsViewDefinition): boolean {
  return drawsAsSeries(def) || isViewForm(def.chart.type) || (def.chart.type === 'bar' && (def.chart.orientation ?? 'vertical') === 'vertical')
}

/** A view's title, or — empty, as an AI view's is by default — one made from the model labels (766 §B). */
export function viewTitleOf(item: AnalyticsItem, model: AnalyticsModel, lang: string, t: TFunction<'boards'>): string {
  const def = item.definition
  const measure = measureOf(model, def.query.measures[0])
  const dimension = dimensionOf(model, def.query.dimensions[0])
  const measureLabel = saysIn(measure?.label, lang) || (def.query.measures[0] ?? '')
  const dimensionLabel = saysIn(dimension?.label, lang) || (def.query.dimensions[0] ?? '')
  return saysIn(item.title, lang) || t('view.generatedTitle', { measure: fsi(measureLabel), dimension: fsi(dimensionLabel) })
}

export default function ViewChart({
  result,
  busy,
  definition,
  model,
  lang,
  onPoint,
  selected,
}: {
  /** The answer drawn, or the previous key's while the new one is asked (`keepPreviousData`). */
  result: AnalyticsQueryResult | undefined
  busy: boolean
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  onPoint?: PointHandler
  selected?: MarkPoint | null
}) {
  const { t } = useTranslation('boards')

  if (!drawsHere(definition)) {
    return (
      <p className="text-sm text-muted-foreground" data-analytics-unsupported>
        {t('view.unsupported')}
      </p>
    )
  }

  return (
    <>
      <ChartFrame busy={busy} hasChart={!!result}>
        {result && <ChartBody result={result} definition={definition} model={model} lang={lang} onPoint={onPoint} selected={selected} />}
      </ChartFrame>
      {result?.truncated && <p className="text-xs text-muted-foreground">{t('view.truncated')}</p>}
    </>
  )
}

/**
 * The form itself, memoised: while a re-ask is in flight the answer drawn is the previous one (the same
 * object), so going busy and back only repaints the frame, never the chart — a board of panels goes busy at once.
 */
const ChartBody = memo(function ChartBody({
  result,
  definition,
  model,
  lang,
  onPoint,
  selected,
}: {
  result: AnalyticsQueryResult
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  onPoint?: PointHandler
  selected?: MarkPoint | null
}) {
  const { t: tc } = useTranslation('common')
  const type = definition.chart.type
  if (drawsAsSeries(definition)) return <SeriesPanel result={result} definition={definition} model={model} lang={lang} onPoint={onPoint} />
  // 769's forms: the donut, the table with cell bars, the heatmap and the combo.
  if (isViewForm(type)) return result.rows.length === 0 ? <Empty /> : <ViewForm type={type} result={result} definition={definition} model={model} lang={lang} onPoint={onPoint} selected={selected} />
  const view = toBarView(result, definition, model, lang)
  return view.empty ? (
    <Empty />
  ) : (
    <VerticalBarChart
      points={view.points}
      colourBy={view.colourBy}
      unit={view.measure.unit}
      measureLabel={view.measure.label}
      locale={lang}
      onPoint={onPoint ? (member) => onPoint(view.category.key, member) : undefined}
      selected={selected?.dimension === view.category.key ? selected.member : null}
      ariaLabel={tc('charts.chartLabel', { measure: fsi(view.measure.label), dimension: fsi(view.category.label) })}
    />
  )
})

function Empty() {
  const { t } = useTranslation('boards')
  return (
    <p className="flex h-72 items-center justify-center text-sm text-muted-foreground" data-analytics-empty>
      {t('view.empty')}
    </p>
  )
}
