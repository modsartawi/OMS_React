import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ChartFrame from '@/core/charts/ChartFrame'
import VerticalBarChart from '@/core/charts/VerticalBarChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { fsi } from '@/core/util/bidi'
import SeriesPanel, { drawsAsSeries } from './SeriesPanel'
import { toBarView } from './view-model'
import ViewForm, { isViewForm } from './ViewForms'
import { analyticsRefusal } from './wire'

/**
 * The ONE form dispatch for an analytics view's chart (767's vertical bar, 768's `SeriesPanel`, 769's
 * `ViewForm`), inside the loading frame, with the empty, unsupported and cut states. Lifted out of the
 * view page by ticket 775 so the chart editor's live preview draws through exactly the same switch.
 *
 * Presentational: the caller owns the query (`placeholderData: keepPreviousData`, so a re-ask keeps the
 * previous chart, dimmed) and passes its state. A query failure is shown by `refused` when the caller
 * words it itself (404/401 on the view page, 406/407/410 in the editor), else as the server's words.
 */
export interface ViewAnswer {
  data: AnalyticsQueryResult | undefined
  error: unknown
  isFetching: boolean
}

export default function ViewChart({
  definition: def,
  model,
  lang,
  answer,
  refused,
}: {
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  answer: ViewAnswer
  refused?: (err: unknown) => ReactNode
}) {
  const { t } = useTranslation('boards')
  const { t: tc } = useTranslation('common')
  const result = answer.data

  // 768's forms (KPI, line, area, the other bars) draw through `SeriesPanel`; 767's vertical bar below.
  const series = drawsAsSeries(def)
  const view = result && !series ? toBarView(result, def, model, lang) : null
  const verticalBar = def.chart.type === 'bar' && (def.chart.orientation ?? 'vertical') === 'vertical'
  // 769's forms: the donut, the table with cell bars, the heatmap and the combo.
  const viewForm = isViewForm(def.chart.type) ? def.chart.type : null
  const drawable = series || verticalBar || viewForm !== null

  if (answer.error && !result) {
    if (refused) return <>{refused(answer.error)}</>
    const refusal = analyticsRefusal(answer.error, t('view.queryFailed'))
    return <ErrorBanner title={t('view.queryFailed')} message={'key' in refusal ? t(refusal.key) : refusal.message} />
  }
  if (!drawable) {
    return (
      <p className="text-sm text-muted-foreground" data-analytics-unsupported>
        {t('view.unsupported')}
      </p>
    )
  }
  return (
    <>
      {series ? (
        <ChartFrame busy={answer.isFetching} hasChart={!!result}>
          {result && <SeriesPanel result={result} definition={def} model={model} lang={lang} />}
        </ChartFrame>
      ) : (
        <ChartFrame busy={answer.isFetching} hasChart={!!view}>
          {view?.empty ? (
            <p className="flex h-72 items-center justify-center text-sm text-muted-foreground" data-analytics-empty>
              {t('view.empty')}
            </p>
          ) : (
            view &&
            (viewForm && result ? (
              <ViewForm type={viewForm} result={result} definition={def} model={model} lang={lang} />
            ) : (
              <VerticalBarChart
                points={view.points}
                colourBy={view.colourBy}
                unit={view.measure.unit}
                measureLabel={view.measure.label}
                locale={lang}
                ariaLabel={tc('charts.chartLabel', { measure: fsi(view.measure.label), dimension: fsi(view.category.label) })}
              />
            ))
          )}
        </ChartFrame>
      )}
      {(view?.truncated || (series && result?.truncated)) && <p className="text-xs text-muted-foreground">{t('view.truncated')}</p>}
    </>
  )
}
