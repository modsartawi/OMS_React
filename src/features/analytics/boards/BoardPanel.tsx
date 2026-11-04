import { memo, useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { formatClock } from '@/core/charts/format'
import type { AnalyticsBoardPanel, AnalyticsItem, AnalyticsModel, BoardLayout } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import { analyticsApi, analyticsQueryKey } from './api'
import { effectiveQuery, panelKey, type BoardContext, type ViewPanel } from './effective-query'
import Refused from './Refused'
import { labelIn } from './view-model'
import ViewChart, { viewTitleOf } from './ViewChart'

/**
 * One panel of a board (ticket 771) on the 12-column grid: a view by reference, a text panel or a
 * section header. A view panel owns its query — keyed by its effective query, with
 * `placeholderData: keepPreviousData`, so a re-ask dims the previous chart and never blanks — and
 * reports whether it is fetching, for the strip's n of N. A superseded answer lands in its old key's
 * cache entry and is never drawn: the newer key wins.
 *
 * Memoised, with its effective query made inside it from the board's `context`, so when another panel's
 * fetching state re-renders the board, this panel's chart is not redrawn.
 *
 * 773 adds the panel actions and states to `ViewPanelCard`'s header (`data-board-panel-actions`).
 */

/** The grid placement: logical columns, so the board mirrors under RTL. */
const place = ({ x, y, w, h }: BoardLayout): CSSProperties => ({ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` })

type PanelProps = {
  item?: AnalyticsItem
  itemError?: unknown
  /** The board-wide state the effective query is made from (memoised by the board). */
  context: BoardContext
  model: AnalyticsModel
  lang: string
  onFetching: (id: string, fetching: boolean) => void
}

export default memo(function BoardPanel({ panel, ...view }: { panel: AnalyticsBoardPanel } & PanelProps) {
  if (panel.kind === 'view') return <ViewPanelCard panel={panel} {...view} />
  if (panel.kind === 'section') {
    return (
      <h2 className="self-end border-b border-border/60 pb-1 text-sm font-semibold tracking-tight" style={place(panel.layout)} data-board-panel={panel.id} data-board-panel-kind="section">
        <bdi>{labelIn(panel.title, view.lang)}</bdi>
      </h2>
    )
  }
  return (
    <Card panel={panel} kind="text">
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        <bdi>{labelIn(panel.text, view.lang)}</bdi>
      </p>
    </Card>
  )
})

function Card({ panel, kind, children, ...data }: { panel: AnalyticsBoardPanel; kind: string; children: ReactNode } & Record<`data-${string}`, string | undefined>) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" style={place(panel.layout)} data-board-panel={panel.id} data-board-panel-kind={kind} {...data}>
      {children}
    </article>
  )
}

function ViewPanelCard({ panel, item, itemError, context, model, lang, onFetching }: { panel: ViewPanel } & PanelProps) {
  const { t } = useTranslation('boards')
  const input = useMemo(
    () => (item ? effectiveQuery({ panel, view: item.definition, revision: item.revision, model }, context) : null),
    [panel, item, model, context],
  )
  const answer = useQuery({
    queryKey: analyticsQueryKey(input ?? { viewId: panel.viewId }),
    queryFn: () => analyticsApi.query(input!),
    enabled: !!input,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const busy = answer.isFetching
  useEffect(() => {
    onFetching(panel.id, busy)
    return () => onFetching(panel.id, false)
  }, [onFetching, panel.id, busy])

  if (itemError) {
    return (
      <Card panel={panel} kind="view" data-board-panel-state="refused">
        <Refused err={itemError} fallbackKey="board.viewFailed" />
      </Card>
    )
  }
  if (!item) {
    return (
      <Card panel={panel} kind="view" data-board-panel-state="loading">
        <p className="text-sm text-muted-foreground" role="status">
          {t('board.panelLoading')}
        </p>
      </Card>
    )
  }

  const result = answer.data
  const asOf = result ? formatClock(result.dataAsOf, lang) : ''
  return (
    <Card panel={panel} kind="view" data-board-panel-state={busy ? 'busy' : 'idle'} data-panel-key={input ? panelKey(input) : undefined}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="min-w-0 text-sm font-semibold tracking-tight" data-board-panel-title>
          <bdi>{viewTitleOf(item, model, lang, t)}</bdi>
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-board-panel-actions>
          {asOf && (
            <span data-analytics-as-of>
              <Trans t={t} i18nKey="view.dataAsOf" values={{ at: asOf }} components={{ at: <Ltr /> }} />
            </span>
          )}
        </div>
      </header>
      {answer.error && !result ? (
        <Refused err={answer.error} fallbackKey="view.queryFailed" />
      ) : (
        <ViewChart result={result} busy={busy} definition={item.definition} model={model} lang={lang} />
      )}
    </Card>
  )
}
