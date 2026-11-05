import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsItemKey, analyticsQueryKey } from './api'
import { comparing } from './effective-query'
import PanelBody from './PanelBody'
import { retiredMembers } from './panel-state'
import Refused from './Refused'

/**
 * A view the copilot created, drawn inside its answer (CTO demo, spec 766 D): the same `PanelBody` a board panel
 * and the view page draw, at a fixed height, without the panel's actions (the answer's "Open view" link opens the
 * full view). Registered with `@/core/copilot-view-embed` by the app shell.
 */
export default function CopilotViewEmbed({ viewId }: { viewId: string }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const item = useQuery({ queryKey: analyticsItemKey(viewId), queryFn: () => analyticsApi.item(viewId), retry: false })
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })
  const definition = item.data?.definition
  const retired = definition && model.data ? retiredMembers(definition, model.data) : []
  const input = item.data ? { viewId: item.data.id, revision: item.data.revision, ...comparing(item.data.definition) } : null
  const answer = useQuery({
    queryKey: analyticsQueryKey(input ?? { viewId }),
    queryFn: () => analyticsApi.query(input!),
    enabled: !!input && retired.length === 0,
    placeholderData: keepPreviousData,
    retry: false,
  })

  const failure = item.error ?? model.error
  if (failure) return <Refused err={failure} fallbackKey="view.loadFailed" />
  if (!definition || !model.data) {
    return (
      <div className="text-xs text-muted-foreground" role="status">
        {t('view.loading')}
      </div>
    )
  }
  return (
    <div className="flex h-80 flex-col overflow-hidden rounded-md border border-border/60 bg-card p-2 pb-3" data-copilot-view-chart={viewId}>
      <PanelBody
        result={answer.data}
        error={answer.error}
        busy={answer.isFetching}
        definition={definition}
        model={model.data}
        lang={lang}
        table={false}
        onRetry={answer.refetch}
        retired={retired}
      />
    </div>
  )
}
