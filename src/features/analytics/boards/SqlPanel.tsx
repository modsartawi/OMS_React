import { useEffect, useMemo, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { Code2, Filter, TriangleAlert } from 'lucide-react'
import { itemHref } from '@/core/analytics-routes'
import { formatClock, formatDay } from '@/core/charts/format'
import type { AnalyticsLabel, Param } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { fsi, formatPair } from '@/core/util/bidi'
import { analyticsApi } from './api'
import type { BoardContext } from './effective-query'
import Refused from './Refused'
import SqlMark from './SqlMark'
import { SqlRefusalNote, SqlResultTable } from './SqlResult'
import { sqlItemAnswer, sqlPanelInput, sqlPanelView } from './sql-panel'

/**
 * A board panel or report block holding a SQL item (ticket 891; BackOffice 3677, spec 3632 Q43, Q47-Q49): the item's
 * title with its "SQL" / "SQL, verified" mark, "Open the SQL" (the item's page, where a viewer reads the statement),
 * "filters do not apply to this SQL panel" when the board or report has any, and its rows — or, for a statement that no
 * longer runs, the plain "can no longer run" message with its reason in place of the chart. The same on the runner's
 * page, the designer and the print page the PDF is made from.
 *
 * It asks `Analytics/Query` by the board or report and its panel (`sqlPanelInput`) with no values, so a filter change
 * does not ask it again; a v1 board with no item to ask by reads the SQL item itself.
 */
export default function SqlPanel({
  panelId,
  viewId,
  fallbackTitle,
  context,
  lang,
  onFetching,
  registerRefresh,
  style,
}: {
  panelId: string
  viewId: string
  /** The item's title as the board read it, until the answer brings its own. */
  fallbackTitle?: AnalyticsLabel
  context: BoardContext
  lang: string
  onFetching: (id: string, fetching: boolean) => void
  registerRefresh?: (id: string, refresh: (() => void) | null) => void
  /** The board grid's placement; absent in a report, which flows. */
  style?: CSSProperties
}) {
  const { t } = useTranslation('boards')
  const input = useMemo(() => sqlPanelInput(panelId, context), [panelId, context])
  const params: readonly Param[] = context.draft ? (context.draft.params ?? []) : context.params
  // Keyed by where it is asked from, never by the draft's contents or the values: nothing of either reaches it (Q48).
  const owner = context.draft ? 'draft' : context.item ? `${context.item.id}@${context.item.revision}` : 'item'
  const answer = useQuery({
    queryKey: ['analytics', 'query', { sqlPanel: panelId, viewId, owner }],
    queryFn: async () => (input ? analyticsApi.query(input) : sqlItemAnswer(await analyticsApi.sqlItem(viewId))),
    retry: false,
  })
  const busy = answer.isFetching
  useEffect(() => {
    onFetching(panelId, busy)
    return () => onFetching(panelId, false)
  }, [onFetching, panelId, busy])
  const { refetch } = answer
  useEffect(() => {
    if (!registerRefresh) return
    registerRefresh(panelId, () => void refetch({ cancelRefetch: false }))
    return () => registerRefresh(panelId, null)
  }, [registerRefresh, panelId, refetch])

  const view = sqlPanelView(answer.data, params)
  const title = (view && saysIn(view.title, lang)) || (fallbackTitle && saysIn(fallbackTitle, lang)) || t('sqlPanel.untitled')
  const ranAt = view?.ranAt ? formatPair(formatDay(view.ranAt, lang), formatClock(view.ranAt, lang)) : ''
  const state = answer.error ? 'refused' : !view ? 'loading' : view.body.kind
  return (
    <article
      id={`panel-${panelId}`}
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 [break-inside:avoid]"
      style={style}
      data-board-panel={panelId}
      data-board-panel-kind="sql"
      data-sql-panel={viewId}
      data-sql-panel-state={state}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-sm font-semibold tracking-tight" data-board-panel-title>
            <bdi>{title}</bdi>
          </h3>
          <SqlMark mark={view?.mark ?? 'sql'} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {ranAt && (
            <span data-sql-panel-ran-at>
              <Trans t={t} i18nKey="sqlPanel.ranAt" values={{ at: ranAt }} components={{ at: <Ltr /> }} />
            </span>
          )}
          <Link
            to={itemHref('view', view?.itemId || viewId)}
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline print:hidden"
            aria-label={t('sqlPanel.openSqlLabel', { title: fsi(title) })}
            data-sql-panel-open
          >
            <Code2 className="size-3.5" aria-hidden />
            {t('sqlPanel.openSql')}
          </Link>
        </div>
      </header>
      {view?.filtersDoNotApply && (
        <p className="flex items-start gap-1 text-xs text-muted-foreground" data-sql-panel-filters-do-not-apply>
          <Filter className="mt-0.5 size-3 shrink-0" aria-hidden />
          {t('sqlPanel.filtersDoNotApply')}
        </p>
      )}
      {answer.error ? (
        <Refused err={answer.error} fallbackKey="view.queryFailed" />
      ) : !view ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('sqlPanel.loading')}
        </p>
      ) : view.body.kind === 'refusal' ? (
        <div className="flex flex-col gap-1.5" data-sql-panel-cannot-run={view.body.refusal.reason}>
          <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-attention-800" aria-hidden />
            {t('sqlPanel.cannotRun')}
          </p>
          <SqlRefusalNote refusal={view.body.refusal} statement="" />
        </div>
      ) : view.body.kind === 'result' ? (
        <SqlResultTable result={view.body.result} />
      ) : (
        <p className="text-sm text-muted-foreground" data-sql-panel-not-run>
          {t('sqlPanel.notRun')}
        </p>
      )}
    </article>
  )
}
