import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import type { AnalyticsBoard, AnalyticsModel, BoardFilters } from '@/core/models/analytics'
import ScreenGate from '@/core/ui/ScreenGate'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey } from './api'
import AskBox from './AskBox'
import { boardDefaults, inLogicalOrder, NO_WAVE, streamProgress, type StreamWave } from './board'
import BoardPanel from './BoardPanel'
import CrossFilterChip from './CrossFilterChip'
import { toggleCrossFilter } from './drill'
import type { BoardContext, CrossFilter, ViewPanel } from './effective-query'
import FilterStrip from './FilterStrip'
import ItemHistory from './ItemHistory'
import ItemTierActions from './ItemTierActions'
import { readBoardFilters, readCrossFilter, writeBoardFilters, writeCrossFilter } from './permalink'
import Refused from './Refused'
import TierBadge from './TierBadge'
import { labelIn } from './view-model'

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

/** Which view panels are fetching, folded into the strip's wave as each one starts and lands. */
function streamReducer(state: { fetching: ReadonlySet<string>; wave: StreamWave }, [id, on]: [string, boolean]) {
  if (state.fetching.has(id) === on) return state
  const fetching = new Set(state.fetching)
  if (on) fetching.add(id)
  else fetching.delete(id)
  return { fetching, wave: streamProgress(state.wave, [...fetching]) }
}

function BoardView({ board, model }: { board: AnalyticsBoard; model: AnalyticsModel }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const defaults = useMemo(() => boardDefaults(board.definition), [board.definition])
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readBoardFilters(params, defaults), [params, defaults])
  const setFilters = useCallback(
    (next: BoardFilters) => setParams((prev) => writeBoardFilters(prev, next, defaults), { replace: true }),
    [setParams, defaults],
  )

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

  const context: BoardContext = useMemo(() => ({ filters, crossFilter }), [filters, crossFilter])
  const [stream, report] = useReducer(streamReducer, { fetching: new Set<string>(), wave: NO_WAVE })
  const onFetching = useCallback((id: string, on: boolean) => report([id, on]), [])

  const title = labelIn(board.title, lang)
  return (
    <div className="flex flex-col gap-3" data-analytics-board={board.id}>
      <div className="flex flex-wrap items-center gap-3" data-analytics-board-header>
        {title && (
          <h2 className="text-base font-semibold tracking-tight" data-analytics-board-title>
            <bdi>{title}</bdi>
          </h2>
        )}
        {/* 778: the tier badge on the board too, and the tier's actions. */}
        <TierBadge tier={board.tier} />
        <AskBox />
        <ItemHistory item={board} kind="board" />
        <ItemTierActions item={board} />
      </div>
      <FilterStrip filters={filters} onChange={setFilters} model={model} lang={lang} wave={stream.wave} />
      {crossFilter && <CrossFilterChip cross={crossFilter} model={model} lang={lang} onClear={clearCross} />}
      {panels.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-analytics-board-empty>
          {t('board.empty')}
        </p>
      ) : (
        <div className="grid auto-rows-[minmax(3rem,auto)] grid-cols-12 gap-3" data-board-grid>
          {panels.map((p) => {
            const it = p.kind === 'view' ? byPanel.get(p.id) : undefined
            return <BoardPanel key={p.id} panel={p} item={it?.data} itemError={it?.error ?? undefined} context={context} model={model} lang={lang} onFetching={onFetching} onCross={onCross} />
          })}
        </div>
      )}
    </div>
  )
}
