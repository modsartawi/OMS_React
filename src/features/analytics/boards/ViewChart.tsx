import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import ChartFrame from '@/core/charts/ChartFrame'
import VerticalBarChart from '@/core/charts/VerticalBarChart'
import type { AnalyticsItem, AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import SeriesPanel, { drawsAsSeries } from './SeriesPanel'
import { labelIn, toBarView } from './view-model'
import ViewForm, { isViewForm } from './ViewForms'

/**
 * ONE view's chart, wherever a view is drawn (ticket 771): the view page and every board panel use it,
 * so a form added here draws in both. It switches on the definition's chart type and wraps the form in
 * `ChartFrame`, which keeps the previous chart dimmed while `busy` (pass the query's `isFetching`).
 *
 * The dispatch: 767's single-series vertical bar (`VerticalBarChart`), 768's forms (`SeriesPanel`),
 * 769's forms (`ViewForm`). A refusal of the answer is the caller's (the page's, or the panel's state).
 */
export function drawsHere(def: AnalyticsViewDefinition): boolean {
  return drawsAsSeries(def) || isViewForm(def.chart.type) || (def.chart.type === 'bar' && (def.chart.orientation ?? 'vertical') === 'vertical')
}

/** A view's title, or — empty, as an AI view's is by default — one made from the model labels (766 §B). */
export function viewTitleOf(item: AnalyticsItem, model: AnalyticsModel, lang: string, t: TFunction<'boards'>): string {
  const def = item.definition
  const measure = model.measures.find((m) => m.key === def.query.measures[0])
  const dimension = model.dimensions.find((d) => d.key === def.query.dimensions[0])
  const measureLabel = labelIn(measure?.label, lang) || (def.query.measures[0] ?? '')
  const dimensionLabel = labelIn(dimension?.label, lang) || (def.query.dimensions[0] ?? '')
  return labelIn(item.title, lang) || t('view.generatedTitle', { measure: fsi(measureLabel), dimension: fsi(dimensionLabel) })
}

export default function ViewChart({
  result,
  busy,
  definition,
  model,
  lang,
}: {
  /** The answer drawn, or the previous key's while the new one is asked (`keepPreviousData`). */
  result: AnalyticsQueryResult | undefined
  busy: boolean
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
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
        {result && <ChartBody result={result} definition={definition} model={model} lang={lang} />}
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
}: {
  result: AnalyticsQueryResult
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
}) {
  const { t: tc } = useTranslation('common')
  const type = definition.chart.type
  if (drawsAsSeries(definition)) return <SeriesPanel result={result} definition={definition} model={model} lang={lang} />
  // 769's forms: the donut, the table with cell bars, the heatmap and the combo.
  if (isViewForm(type)) return result.rows.length === 0 ? <Empty /> : <ViewForm type={type} result={result} definition={definition} model={model} lang={lang} />
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
