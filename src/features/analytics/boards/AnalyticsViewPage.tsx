import { useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsItem, AnalyticsModel } from '@/core/models/analytics'
import { buttonClass } from '@/core/ui/control-classes'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsItemKey, analyticsQueryKey } from './api'
import { editItemLink } from './editor'
import { comparing } from './effective-query'
import { itemActions } from './item-actions'
import ItemHistory from './ItemHistory'
import PinToggle from './PinToggle'
import ItemTierActions from './ItemTierActions'
import PanelActions from './PanelActions'
import PanelBody, { bodyState } from './PanelBody'
import { useFullscreen } from './panel-hooks'
import { panelPermalink, retiredMembers } from './panel-state'
import Refused from './Refused'
import { SourceMovedOn } from './SaveNotes'
import SqlItemView from './SqlItemView'
import AudienceChip from './AudienceChip'
import TierBadge from './TierBadge'
import { useItemActor } from './use-item-save'
import { viewTitleOf } from './ViewChart'

/**
 * One analytics view at `/analytics/view/:id` (spec 766 §F, ticket 767 — Slice 0).
 *
 * Behind `canViewAnalytics` on `GET Analytics/Access`, the predicate the menu reads, failing closed.
 * It reads the item and the model, then asks `Analytics/Query` for the saved view by id, with
 * `placeholderData: keepPreviousData` so a re-ask keeps the previous chart, dimmed (`ChartFrame`).
 *
 * The chart is `ViewChart`, the one form dispatch a board panel uses too (771): 767's vertical bar,
 * 768's KPI, line, stacked area and other bars, and 769's forms.
 * 776: "Edit" opens the editor on this view (it saves by the tier: in place, or as my copy), and a copy whose
 * source has moved on says so.
 * `ANALYTICS-404` is the not-found state and `ANALYTICS-401` the no-access state, from the item or the query.
 * 773: the same panel actions, freshness and states as a board panel (`PanelActions`, `PanelBody`).
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

  // 890: a SQL item is not a cube view: it is drawn from its kept run, with its own Edit (the SQL editor).
  if (item.data?.engine === 'sql') return <SqlItemView id={id} />
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
  const input = { viewId: item.id, revision: item.revision, ...comparing(item.definition) }
  // A view naming a member the model no longer holds is retired: not asked at all (766 §B).
  const retired = retiredMembers(item.definition, model)
  const answer = useQuery({
    queryKey: analyticsQueryKey(input),
    queryFn: () => analyticsApi.query(input),
    enabled: retired.length === 0,
    placeholderData: keepPreviousData,
    retry: false,
  })

  const frame = useRef<HTMLElement>(null)
  const fullscreen = useFullscreen(frame)
  const [table, setTable] = useState(false)
  const actions = itemActions(item, useItemActor())
  const edit = editItemLink(item)

  const title = viewTitleOf(item, model, lang, t)
  const subtitle = saysIn(item.subtitle, lang)
  const result = answer.data
  const period = result?.period ? formatRange(formatDay(result.period.from, lang), formatDay(result.period.to, lang)) : ''

  return (
    <article
      ref={frame}
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 [&:fullscreen]:overflow-auto [&:fullscreen]:p-6"
      data-analytics-view={item.id}
      data-board-panel-state={bodyState(result, answer.error, answer.isFetching, retired)}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight" data-analytics-view-title>
              <bdi>{title}</bdi>
            </h2>
            {/* 778: the tier badge, the Certified one with its check. */}
            <TierBadge tier={item.tier} />
            {/* 826: who a Shared view is shared with. */}
            <AudienceChip item={item} />
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              <bdi>{subtitle}</bdi>
            </p>
          )}
          {item.copiedFrom && item.sourceChangedSinceCopy && <SourceMovedOn />}
        </div>
        {actions.save !== 'read-only' && (
          <Link to={edit.to} state={edit.state} className={buttonClass('secondary')} data-analytics-edit={actions.save}>
            <Pencil className="size-3.5" aria-hidden />
            {t('view.edit')}
          </Link>
        )}
        {/* 840: pin it to Home. */}
        <PinToggle item={item} title={title} />
        <ItemHistory item={item} kind="view" />
        {/* 778: share, certify, un-certify and delete, as the tier allows. */}
        <ItemTierActions item={item} />
        <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
          <PanelActions
            viewId={item.id}
            title={title}
            result={result}
            updatedAt={answer.dataUpdatedAt}
            definition={item.definition}
            model={model}
            lang={lang}
            onRefresh={answer.refetch}
            table={table}
            onTable={() => setTable((on) => !on)}
            frame={frame}
            fullscreen={fullscreen}
            permalink={() => panelPermalink(window.location.href)}
          />
          {period && (
            <span data-analytics-period>
              <Trans t={t} i18nKey="view.period" values={{ range: period }} components={{ range: <Ltr /> }} />
            </span>
          )}
        </div>
      </header>

      <PanelBody
        result={result}
        error={answer.error}
        busy={answer.isFetching}
        definition={item.definition}
        model={model}
        lang={lang}
        table={table}
        onRetry={answer.refetch}
        retired={retired}
      />
    </article>
  )
}
