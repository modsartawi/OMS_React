import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { boardEditHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsBoard, AnalyticsModel } from '@/core/models/analytics'
import { buttonClass } from '@/core/ui/control-classes'
import ScreenGate from '@/core/ui/ScreenGate'
import { saysIn } from '@/core/rules/sentence'
import { analyticsAccessQuery, canAuthorAnalytics, canViewAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey } from './api'
import AskBox from './AskBox'
import { inLogicalOrder, NO_WAVE } from './board'
import { noticeReducer, streamReducer, stripNotices } from './panel-notices'
import BoardPanel, { type ParamNotice } from './BoardPanel'
import { RefreshPicker, useRefreshChoice, useRefreshLoop } from './BoardRefresh'
import CrossFilterChip from './CrossFilterChip'
import { toggleCrossFilter } from './drill'
import type { BoardContext, CrossFilter, ViewPanel } from './effective-query'
import FilterStrip from './FilterStrip'
import { itemActions } from './item-actions'
import { editingItemOf, sourceMovedOn } from './item-save'
import ItemHistory from './ItemHistory'
import ItemTierActions from './ItemTierActions'
import { boardParams, defaultsOf, type ParamValues } from './params'
import { readCrossFilter, readParamLink, writeCrossFilter, writeParamValues } from './permalink'
import Refused from './Refused'
import SaveAsReport from './SaveAsReport'
import { SourceMovedOn } from './SaveNotes'
import AudienceChip from './AudienceChip'
import TierBadge from './TierBadge'
import { FilterChips, TvButton, useTvMode } from './TvMode'
import { useItemActor } from './use-item-save'

/**
 * A board at `/analytics/board/:id` (spec 766 §F, ticket 771), read only (editing is 777).
 *
 * Its panels sit on a 12-column grid in logical order. The filter strip's state lives in the query string,
 * which is the permalink (`./permalink`). Each view panel's query is its effective query (`./effective-query`):
 * a filter change re-asks only the panels it reaches, each redraws on its own answer, and the strip counts
 * them in — "Updating… n of N panels".
 *
 * The cross-filter (772) is in `BoardContext` and the URL (`cross`, `crossFrom`): a click on a mark sets it,
 * the same click clears it, and it re-asks every panel it reaches but the one clicked. Drill by is each
 * panel's own (`BoardPanel`). 773 adds the panel actions and states.
 *
 * 780: the board refreshes itself (`refresh=`, `./BoardRefresh`: one loop, staggered, paused while hidden)
 * and `tv=1` is TV mode (`./TvMode`): no shell, the board alone, its filters as read-only chips, Esc leaves.
 */
export default function AnalyticsBoardPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('board.title')} subtitle={t('board.subtitle')}>
      <BoardBody />
    </ScreenGate>
  )
}

function BoardBody() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  const board = useQuery({ queryKey: analyticsBoardKey(id), queryFn: () => analyticsApi.board(id), retry: false })
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })

  const failure = board.error ?? model.error
  if (failure) return <Refused err={failure} fallbackKey="board.loadFailed" what="board" />
  if (!board.data || !model.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('board.loading')}
      </div>
    )
  }
  return <BoardView board={board.data} model={model.data} />
}

function BoardView({ board, model }: { board: AnalyticsBoard; model: AnalyticsModel }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  // 821: the board's parameters (a v1 board's six, converted) and their bindings; their values are the URL's.
  const declared = useMemo(() => boardParams(board.definition), [board.definition])
  // 823: a board the server sent WITH its parameters asks by item and panel, and the server applies the
  // bindings; a v1 board the web converted keeps v1's resolved wire (its server cannot apply bindings).
  const v2 = !!(board.definition.params && board.definition.bindings)
  const item = useMemo(() => (v2 ? { id: board.id, revision: board.revision } : null), [v2, board.id, board.revision])
  const [params, setParams] = useSearchParams()
  const link = useMemo(() => readParamLink(params, declared.params), [params, declared])
  const values = link.values
  const setValues = useCallback(
    (next: ParamValues) => setParams((prev) => writeParamValues(prev, declared.params, next), { replace: true }),
    [setParams, declared],
  )
  const reset = useCallback(() => setValues(defaultsOf(declared.params)), [setValues, declared])
  const [notices, notice] = useReducer(noticeReducer, new Map<string, ParamNotice>())
  const onParamNotice = useCallback((id: string, n: ParamNotice) => notice([id, n]), [])
  const { fellBack, invalid } = stripNotices(declared.params, link.fellBack, notices)
  // 823: the author reads every "not filtered by …" line; a runner only those for parameters moved off their defaults.
  const access = useQuery(analyticsAccessQuery())
  const role = canAuthorAnalytics(access.data) ? 'author' : 'runner'

  const panels = useMemo(() => inLogicalOrder(board.definition.panels), [board.definition.panels])
  const viewPanels = panels.filter((p): p is ViewPanel => p.kind === 'view')
  const items = useQueries({
    queries: viewPanels.map((p) => ({ queryKey: analyticsItemKey(p.viewId), queryFn: () => analyticsApi.item(p.viewId), staleTime: 60_000, retry: false })),
  })
  const byPanel = new Map(viewPanels.map((p, i) => [p.id, items[i]]))

  const crossKey = params.get('cross') ?? ''
  const crossFrom = params.get('crossFrom') ?? ''
  // Keyed on the two params, so a board filter change keeps the same cross-filter object.
  const crossFilter = useMemo(
    () => readCrossFilter(new URLSearchParams([['cross', crossKey], ['crossFrom', crossFrom]])),
    [crossKey, crossFrom],
  )
  // react-router's `setParams` is a new function whenever the params change, so a filter change would hand
  // every panel a new `onCross` (and its chart a new `onPoint`) and redraw every chart: the memo the 771
  // "busy within 0.5 s" check depends on. The handler reads the latest `setParams` through a ref instead, and
  // its updater reads `prev`, so it never acts on stale params.
  const setParamsRef = useRef(setParams)
  useLayoutEffect(() => {
    setParamsRef.current = setParams
  }, [setParams])
  const onCross = useCallback(
    (clicked: CrossFilter) => setParamsRef.current((prev) => writeCrossFilter(prev, toggleCrossFilter(readCrossFilter(prev), clicked)), { replace: true }),
    [],
  )
  const clearCross = useCallback(() => setParams((prev) => writeCrossFilter(prev, null), { replace: true }), [setParams])

  const context: BoardContext = useMemo(() => ({ ...declared, values, crossFilter, item }), [declared, values, crossFilter, item])
  const [stream, report] = useReducer(streamReducer, { fetching: new Set<string>(), wave: NO_WAVE })
  const onFetching = useCallback((id: string, on: boolean) => report([id, on]), [])

  const root = useRef<HTMLDivElement>(null)
  const tv = useTvMode(params, setParams)
  const [refresh, setRefresh] = useRefreshChoice(board.id, board.definition.refresh, params, setParams)
  const refreshers = useRef(new Map<string, () => void>())
  const registerRefresh = useCallback((pid: string, fn: (() => void) | null) => (fn ? refreshers.current.set(pid, fn) : refreshers.current.delete(pid)), [])
  const refreshPanel = useCallback((pid: string) => refreshers.current.get(pid)?.(), [])
  useRefreshLoop(viewPanels.map((p) => p.id), refresh, refreshPanel)

  const title = saysIn(board.title, lang)
  // 777: anyone who may save it (in place or as a copy) may open the board editor.
  const canEdit = itemActions(editingItemOf({ ...board, kind: 'board' }), useItemActor()).save !== 'read-only'
  // 830: an author who may edit or copy the board may save it as a report, once its views are read.
  const views = new Map(items.flatMap((q) => (q.data ? [[q.data.id, q.data] as const] : [])))
  return (
    <div
      ref={root}
      className={'flex flex-col gap-3 ' + (tv.on ? 'fixed inset-0 z-40 overflow-auto bg-background p-4' : '')}
      data-analytics-board={board.id}
      data-analytics-tv={tv.on ? 'on' : 'off'}
    >
      <div className="flex flex-wrap items-center gap-3" data-analytics-board-header>
        {title && (
          <h2 className="text-base font-semibold tracking-tight" data-analytics-board-title>
            <bdi>{title}</bdi>
          </h2>
        )}
        {/* 778: the tier badge on the board too, and the tier's actions. */}
        <TierBadge tier={board.tier} />
        {/* 826: who a Shared board is shared with. */}
        <AudienceChip item={board} />
        {/* 780: a wall screen shows the board, not the ask box, the editor link, the history or the tier's actions. */}
        {!tv.on && (
          <>
            <AskBox />
            {canEdit && (
              <Link to={boardEditHref(board.id)} className={buttonClass('secondary')} data-analytics-board-edit>
                <Pencil className="size-4" aria-hidden />
                {t('boardEditor.edit')}
              </Link>
            )}
            {canEdit && role === 'author' && <SaveAsReport board={board} views={views} pending={items.some((q) => q.isPending)} model={model} />}
            <ItemHistory item={board} kind="board" />
            <ItemTierActions item={board} />
          </>
        )}
        <div className="ms-auto flex items-end gap-2">
          <RefreshPicker value={refresh} onChange={setRefresh} />
          <TvButton on={tv.on} fullscreen={tv.fullscreen} onEnter={tv.enter} onExit={tv.exit} onFullscreen={tv.goFullscreen} />
        </div>
      </div>
      {/* Story 64: my copy of a board whose original has moved on since I copied it. */}
      {!tv.on && sourceMovedOn(board) && <SourceMovedOn />}
      {tv.on ? (
        <FilterChips params={declared.params} values={values} model={model} lang={lang} />
      ) : (
        <FilterStrip params={declared.params} values={values} onChange={setValues} onReset={reset} fellBack={fellBack} invalid={invalid} model={model} lang={lang} wave={stream.wave} />
      )}
      {crossFilter && <CrossFilterChip cross={crossFilter} model={model} lang={lang} onClear={clearCross} />}
      {panels.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-analytics-board-empty>
          {t('board.empty')}
        </p>
      ) : (
        <div className="grid auto-rows-[minmax(3rem,auto)] grid-cols-12 gap-3" data-board-grid>
          {panels.map((p) => {
            const it = p.kind === 'view' ? byPanel.get(p.id) : undefined
            return <BoardPanel key={p.id} panel={p} item={it?.data} itemError={it?.error ?? undefined} context={context} model={model} lang={lang} onFetching={onFetching} onCross={onCross} registerRefresh={registerRefresh} role={role} onParamNotice={onParamNotice} />
          })}
        </div>
      )}
    </div>
  )
}
