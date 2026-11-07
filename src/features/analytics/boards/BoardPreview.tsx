import { useCallback, useMemo, useReducer, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import type { AnalyticsBoardDefinition, AnalyticsLabel, AnalyticsModel, AnalyticsTier } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { analyticsApi, analyticsItemKey } from './api'
import { inLogicalOrder, NO_WAVE } from './board'
import BoardGrid from './BoardGrid'
import type { ParamNotice } from './BoardPanel'
import CrossFilterChip from './CrossFilterChip'
import { toggleCrossFilter } from './drill'
import type { BoardContext, CrossFilter, ViewPanel } from './effective-query'
import FilterStrip from './FilterStrip'
import { noticeReducer, streamReducer, stripNotices } from './panel-notices'
import { defaultsOf, type ParamValues } from './params'
import TierBadge from './TierBadge'

/**
 * The board editor's Preview (ticket 837 item 1, modelled on the report designer's DraftPreview, story 95): the
 * board exactly as a viewer sees it — its real panels, charts, filter strip and cross-filter — built from the
 * editor's UNSAVED working copy. Every panel asks `inline` (its view's definition plus the draft's parameters and
 * bindings), never by item, which would run the saved revision instead. The filter values and the cross-filter
 * are the preview's own (not the editor's URL) and start from the draft's defaults; the editor stays mounted
 * behind it, so "Back to design" returns to it as it was.
 */
export default function BoardPreview({
  title,
  tier,
  definition,
  model,
  lang,
  onBack,
}: {
  title: AnalyticsLabel
  tier: AnalyticsTier | null
  definition: AnalyticsBoardDefinition
  model: AnalyticsModel
  lang: string
  onBack: () => void
}) {
  const { t } = useTranslation('boards')
  const params = useMemo(() => definition.params ?? [], [definition.params])
  const bindings = useMemo(() => definition.bindings ?? {}, [definition.bindings])
  const [values, setValues] = useState<ParamValues>(() => defaultsOf(params))
  const [crossFilter, setCrossFilter] = useState<CrossFilter | null>(null)
  const onCross = useCallback((clicked: CrossFilter) => setCrossFilter((c) => toggleCrossFilter(c, clicked)), [])
  const [notices, notice] = useReducer(noticeReducer, new Map<string, ParamNotice>())
  const onParamNotice = useCallback((id: string, n: ParamNotice) => notice([id, n]), [])
  const { fellBack, invalid } = stripNotices(params, [], notices)
  const [stream, report] = useReducer(streamReducer, { fetching: new Set<string>(), wave: NO_WAVE })
  const onFetching = useCallback((id: string, on: boolean) => report([id, on]), [])

  const context: BoardContext = useMemo(() => ({ params, bindings, values, crossFilter, item: null, inline: true }), [params, bindings, values, crossFilter])
  const panels = useMemo(() => inLogicalOrder(definition.panels), [definition.panels])
  const viewPanels = panels.filter((p): p is ViewPanel => p.kind === 'view')
  // The same cache entries the editor already filled: the preview asks nothing the editor has not.
  const items = useQueries({
    queries: viewPanels.map((p) => ({ queryKey: analyticsItemKey(p.viewId), queryFn: () => analyticsApi.item(p.viewId), staleTime: 60_000, retry: false })),
  })
  const byPanel = new Map(viewPanels.map((p, i) => [p.id, items[i]]))
  const said = saysIn(title, lang)

  return (
    <div className="flex flex-col gap-3" data-board-preview>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outlined" onClick={onBack} data-board-preview-back>
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {t('boardEditor.previewBack')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('boardEditor.previewNote')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {said && (
          <h2 className="text-base font-semibold tracking-tight" data-board-preview-title>
            <bdi>{said}</bdi>
          </h2>
        )}
        {tier && <TierBadge tier={tier} />}
      </div>
      <FilterStrip params={params} values={values} onChange={setValues} onReset={() => setValues(defaultsOf(params))} fellBack={fellBack} invalid={invalid} model={model} lang={lang} wave={stream.wave} />
      {crossFilter && <CrossFilterChip cross={crossFilter} model={model} lang={lang} onClear={() => setCrossFilter(null)} />}
      <BoardGrid panels={panels} byPanel={byPanel} context={context} model={model} lang={lang} onFetching={onFetching} onCross={onCross} role="runner" onParamNotice={onParamNotice} />
    </div>
  )
}
