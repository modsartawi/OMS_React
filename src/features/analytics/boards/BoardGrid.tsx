import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AnalyticsBoardPanel, AnalyticsItem, AnalyticsModel } from '@/core/models/analytics'
import BoardPanel, { type ParamNotice } from './BoardPanel'
import type { BoardContext, CrossFilter } from './effective-query'

/**
 * A board's panels on the 12-column grid, as its viewer sees them (ticket 771): the board page draws its saved
 * board through it and the board editor's Preview (837) its unsaved working copy — the only difference is the
 * `context` (by item, or `inline`). `panels` come in logical order; `byPanel` is each view panel's view query.
 */
export default function BoardGrid({
  panels,
  byPanel,
  context,
  model,
  lang,
  onFetching,
  onCross,
  registerRefresh,
  role,
  onParamNotice,
}: {
  panels: readonly AnalyticsBoardPanel[]
  byPanel: ReadonlyMap<string, Pick<UseQueryResult<AnalyticsItem>, 'data' | 'error'>>
  context: BoardContext
  model: AnalyticsModel
  lang: string
  onFetching: (id: string, fetching: boolean) => void
  onCross: (point: CrossFilter) => void
  registerRefresh?: (id: string, refresh: (() => void) | null) => void
  role: 'author' | 'runner'
  onParamNotice: (id: string, notice: ParamNotice) => void
}) {
  const { t } = useTranslation('boards')
  if (panels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-analytics-board-empty>
        {t('board.empty')}
      </p>
    )
  }
  return (
    <div className="grid auto-rows-[minmax(3rem,auto)] grid-cols-12 gap-3" data-board-grid>
      {panels.map((p) => {
        const it = p.kind === 'view' ? byPanel.get(p.id) : undefined
        return (
          <BoardPanel
            key={p.id}
            panel={p}
            item={it?.data}
            itemError={it?.error ?? undefined}
            context={context}
            model={model}
            lang={lang}
            onFetching={onFetching}
            onCross={onCross}
            registerRefresh={registerRefresh}
            role={role}
            onParamNotice={onParamNotice}
          />
        )
      })}
    </div>
  )
}
