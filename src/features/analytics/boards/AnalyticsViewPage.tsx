import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { SearchX, ShieldAlert } from 'lucide-react'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsItem, AnalyticsModel } from '@/core/models/analytics'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange, fsi } from '@/core/util/bidi'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsItemKey, analyticsQueryKey } from './api'
import { labelIn } from './view-model'
import ViewChart from './ViewChart'
import { analyticsRefusal } from './wire'

/**
 * One analytics view at `/analytics/view/:id` (spec 766 §F, ticket 767 — Slice 0).
 *
 * Behind `canViewAnalytics` on `GET Analytics/Access`, the predicate the menu reads, failing closed.
 * It reads the item and the model, then asks `Analytics/Query` for the saved view by id, with
 * `placeholderData: keepPreviousData` so a re-ask keeps the previous chart, dimmed (`ChartFrame`).
 *
 * Slice 0 draws a vertical bar of one measure × one category; 768 adds KPI, line, stacked area and the
 * other bars (`SeriesPanel`), and 769 the rest, where the chart type is switched on below.
 * `ANALYTICS-404` is the not-found state and `ANALYTICS-401` the no-access state, from the item or the query.
 */
export default function AnalyticsViewPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('view.title')} subtitle={t('view.subtitle')}>
      <ViewBody />
    </ScreenGate>
  )
}

function ViewBody() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  const item = useQuery({ queryKey: analyticsItemKey(id), queryFn: () => analyticsApi.item(id), retry: false })
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })

  const failure = item.error ?? model.error
  if (failure) return <Refused err={failure} fallbackKey="view.loadFailed" />
  if (!item.data || !model.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('view.loading')}
      </div>
    )
  }
  return <ViewPanel item={item.data} model={model.data} />
}

function ViewPanel({ item, model }: { item: AnalyticsItem; model: AnalyticsModel }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const input = { viewId: item.id, revision: item.revision }
  const answer = useQuery({
    queryKey: analyticsQueryKey(input),
    queryFn: () => analyticsApi.query(input),
    placeholderData: keepPreviousData,
    retry: false,
  })

  const def = item.definition
  const measure = model.measures.find((m) => m.key === def.query.measures[0])
  const dimension = model.dimensions.find((d) => d.key === def.query.dimensions[0])
  const measureLabel = labelIn(measure?.label, lang) || (def.query.measures[0] ?? '')
  const dimensionLabel = labelIn(dimension?.label, lang) || (def.query.dimensions[0] ?? '')
  // An AI view's title is empty by default: the screen generates it from the model labels (766 §B).
  const title =
    labelIn(item.title, lang) || t('view.generatedTitle', { measure: fsi(measureLabel), dimension: fsi(dimensionLabel) })
  const subtitle = labelIn(item.subtitle, lang)

  const result = answer.data
  const asOf = result ? formatClock(result.dataAsOf, lang) : ''
  const period = result?.period ? formatRange(formatDay(result.period.from, lang), formatDay(result.period.to, lang)) : ''

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-analytics-view={item.id}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight" data-analytics-view-title>
            <bdi>{title}</bdi>
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              <bdi>{subtitle}</bdi>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
          {asOf && (
            <span data-analytics-as-of>
              <Trans t={t} i18nKey="view.dataAsOf" values={{ at: asOf }} components={{ at: <Ltr /> }} />
            </span>
          )}
          {period && (
            <span data-analytics-period>
              <Trans t={t} i18nKey="view.period" values={{ range: period }} components={{ range: <Ltr /> }} />
            </span>
          )}
        </div>
      </header>

      <ViewChart
        definition={def}
        model={model}
        lang={lang}
        answer={answer}
        refused={(err) => <Refused err={err} fallbackKey="view.queryFailed" />}
      />
    </article>
  )
}

/** A refusal: `ANALYTICS-404` and `-401` are their own states; any other is the server's own words. */
function Refused({ err, fallbackKey }: { err: unknown; fallbackKey: string }) {
  const { t } = useTranslation('boards')
  const refusal = analyticsRefusal(err, t(fallbackKey))
  const words = 'key' in refusal ? t(refusal.key) : refusal.message
  if (refusal.code === 'ANALYTICS-404' || refusal.code === 'ANALYTICS-401') {
    const notFound = refusal.code === 'ANALYTICS-404'
    const Icon = notFound ? SearchX : ShieldAlert
    return (
      <div
        className="mx-auto mt-10 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
        data-analytics-state={notFound ? 'not-found' : 'no-access'}
      >
        <Icon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t(notFound ? 'view.notFoundTitle' : 'view.noAccessTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{words}</p>
      </div>
    )
  }
  return <ErrorBanner title={t(fallbackKey)} message={words} />
}
