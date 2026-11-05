import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AnalyticsBoardPanel, AnalyticsItem, AnalyticsModel, BoardLayout } from '@/core/models/analytics'
import { analyticsApi, analyticsQueryKey } from './api'
import { effectiveQuery, panelKey, type BoardContext, type ViewPanel } from './effective-query'
import PanelActions from './PanelActions'
import PanelBody, { bodyState } from './PanelBody'
import { useFullscreen, useScrollToPanel } from './panel-hooks'
import { panelPermalink } from './panel-state'
import Refused from './Refused'
import { labelIn } from './view-model'
import { viewTitleOf } from './ViewChart'

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
 * 773's panel actions and freshness sit in the header (`data-board-panel-actions`, `./PanelActions`) and
 * its states in the body (`./PanelBody`); the card is what goes full screen, and `#panel-<id>` (the
 * panel's permalink) scrolls to it.
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

function Card({
  panel,
  kind,
  children,
  ref,
  ...data
}: { panel: AnalyticsBoardPanel; kind: string; children: ReactNode; ref?: Ref<HTMLElement> } & Record<`data-${string}`, string | undefined>) {
  return (
    <article
      ref={ref}
      id={`panel-${panel.id}`}
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 [&:fullscreen]:overflow-auto [&:fullscreen]:p-6"
      style={place(panel.layout)}
      data-board-panel={panel.id}
      data-board-panel-kind={kind}
      {...data}
    >
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
  const frame = useRef<HTMLElement>(null)
  const fullscreen = useFullscreen(frame)
  const [table, setTable] = useState(false)
  useScrollToPanel(panel.id, frame, !!answer.data || !!answer.error)
  const onTable = useCallback(() => setTable((on) => !on), [])
  const permalink = useCallback(() => panelPermalink(window.location.href, panel.id), [panel.id])
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
  const title = viewTitleOf(item, model, lang, t)
  return (
    <Card ref={frame} panel={panel} kind="view" data-board-panel-state={bodyState(result, answer.error, busy)} data-panel-key={input ? panelKey(input) : undefined}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="min-w-0 text-sm font-semibold tracking-tight" data-board-panel-title>
          <bdi>{title}</bdi>
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-board-panel-actions>
          <PanelActions
            viewId={panel.viewId}
            title={title}
            result={result}
            updatedAt={answer.dataUpdatedAt}
            definition={item.definition}
            model={model}
            lang={lang}
            onRefresh={answer.refetch}
            table={table}
            onTable={onTable}
            frame={frame}
            fullscreen={fullscreen}
            permalink={permalink}
          />
        </div>
      </header>
      <PanelBody result={result} error={answer.error} busy={busy} definition={item.definition} model={model} lang={lang} table={table} onRetry={answer.refetch} />
    </Card>
  )
}
