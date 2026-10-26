import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { GridApi, RowClassParams } from 'ag-grid-community'
import { Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { ApiError, apiErrorMessage } from '@/core/api'
import { canOpenDispatchBoard, canReleaseLock, dispatchAccessQuery } from '@/core/dispatch/access'
import ReleaseLockDialog from '@/core/dispatch/ReleaseLockDialog'
import type { DispatchBoardFilter } from '@/core/models/dispatch-board'
import { canViewServingLists, servingListAccessQuery } from '@/core/serving-list/access'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { BOARD_KEY, boardQuery } from './api'
import { EMPTY_BOARD_FILTER, boardFilterFromParams, boardFilterToParams, boardTiles, isFilteredBoard, type BoardTile } from './board-view'
import { BOARD_DEFAULT_COL_DEF, buildClosedColumns, buildOpenColumns, type BoardRow } from './columns'
import Inspector from './Inspector'

/**
 * The Dispatch board — `/oms/dispatch-board` (BackOffice spec 2952, oms ticket 541; the fleet board,
 * 2950 variant A). A tile row, an **On callout now** grid with a live countdown, a **Closed · last
 * 60 min** grid with the outcome, and a bid inspector beside them. Filters (channel, city, store) live
 * in the URL. It polls every 30 s (paused in a hidden tab) and a 1 s clock moves the countdowns.
 *
 * HQ watches with Display; with Execute it releases a locked delivery (Release lock). There is no
 * hand-over or withdraw of an open callout (ruled out in 2950), and no move here: after a release the
 * Change store link opens Delivery details, whose existing action moves it.
 */
export default function DispatchBoardPage() {
  const { t } = useTranslation('dispatch-board')
  return (
    <ScreenGate query={dispatchAccessQuery()} can={canOpenDispatchBoard} ns="dispatch-board" title={t('title')} subtitle={t('subtitle')}>
      <Board />
    </ScreenGate>
  )
}

function Board() {
  const { t } = useTranslation('dispatch-board')
  const { query: filter, update, changedFromOutside } = useUrlQuery(boardFilterFromParams, boardFilterToParams)
  const access = useQuery(dispatchAccessQuery())
  const canRelease = canReleaseLock(access.data)
  // A callout's serving list links to its screen only for a View holder (572; 567's probe, the menu leaf's key).
  const servingListAccess = useQuery(servingListAccessQuery())
  const canLinkServingList = canViewServingLists(servingListAccess.data)
  const board = useQuery(boardQuery(filter))
  const queryClient = useQueryClient()

  // The last good board stays on screen when one 30 s poll fails (a notice says so); the error state
  // is only for a board never read. A placeholder (the previous filter's board) keeps its own receipt time.
  const data = board.data
  const fetchedAt = data?.receivedAt ?? 0
  const open: BoardRow[] = useMemo(() => (data?.open ?? []).map((c) => ({ ...c, fetchedAt })), [data, fetchedAt])
  const closed: BoardRow[] = useMemo(() => (data?.closed ?? []).map((c) => ({ ...c, fetchedAt })), [data, fetchedAt])
  const tiles = useMemo(() => (data ? boardTiles(data.tiles) : []), [data])
  const windowMin = data?.windowMinutes ?? 60

  // The inspector follows a callout by its id across reads; nothing chosen → the first open, else the first closed.
  const [chosen, setChosen] = useState<string | null>(null)
  const selected = useMemo(
    () => [...open, ...closed].find((c) => c.calloutId === chosen) ?? open[0] ?? closed[0] ?? null,
    [open, closed, chosen],
  )
  const selectedId = selected?.calloutId ?? null

  // The chosen row is marked in whichever grid holds it; both redraw when the choice moves.
  const openGrid = useRef<GridApi<BoardRow> | null>(null)
  const closedGrid = useRef<GridApi<BoardRow> | null>(null)
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  useEffect(() => {
    openGrid.current?.redrawRows()
    closedGrid.current?.redrawRows()
  }, [selectedId])
  const rowClassRules = useMemo(
    () => ({ 'bg-primary-050': (p: RowClassParams<BoardRow>) => p.data?.calloutId === selectedRef.current }),
    [],
  )

  const [releasing, setReleasing] = useState<BoardRow | null>(null)
  const [released, setReleased] = useState<ReadonlySet<string>>(new Set())

  const openColumns = useMemo(() => buildOpenColumns(t), [t])
  const closedColumns = useMemo(() => buildClosedColumns(t), [t])
  const refused = board.error instanceof ApiError && board.error.statusCode === 403

  return (
    <div className="flex min-w-0 flex-col gap-4" data-dispatch-board="">
      <Filters filter={filter} onApply={(f) => update(() => f)} resetFromOutside={changedFromOutside} />

      <div className="flex flex-wrap items-center justify-end gap-x-3 text-xs text-muted-foreground">
        {board.isFetching && (
          <span className="inline-flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('refreshing')}
          </span>
        )}
        {data && (
          <span data-as-of={data.asOf}>
            <Trans t={t} i18nKey="asOf" values={{ at: formatDateTime(data.asOf) }} components={{ at: <Ltr /> }} />
          </span>
        )}
      </div>

      {refused ? (
        <div className="mx-auto mt-8 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-board-denied="">
          <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
          <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
          <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
        </div>
      ) : board.isError && !data ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(board.error, t('failed'))} />
      ) : !data ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('loading')}
        </div>
      ) : (
        <>
          {board.isError && (
            <div data-board-stale="">
              <ErrorBanner className="p-2.5" title={t('failedStale')} message={apiErrorMessage(board.error, t('failed'))} />
            </div>
          )}
          <section aria-label={t('tiles.label')} className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2" data-tiles="">
            {tiles.map((tile) => (
              <Tile key={tile.key} tile={tile} windowMin={windowMin} />
            ))}
          </section>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <section className="flex min-w-0 flex-col gap-2" data-open-section="">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sections.open')}</h2>
                {open.length === 0 ? (
                  <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-open-empty="">
                    {t(isFilteredBoard(filter) ? 'sections.emptyFiltered' : 'sections.emptyOpen')}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-border/60" data-open-grid="">
                    <AgGridReact<BoardRow>
                      theme={omsGridTheme}
                      rowData={open}
                      columnDefs={openColumns}
                      defaultColDef={BOARD_DEFAULT_COL_DEF}
                      getRowId={({ data }) => data.calloutId}
                      rowHeight={OMS_GRID_ROW_HEIGHT}
                      headerHeight={OMS_GRID_HEADER_HEIGHT}
                      domLayout="autoHeight"
                      animateRows={false}
                      suppressColumnVirtualisation
                      rowClass="cursor-pointer"
                      rowClassRules={rowClassRules}
                      onGridReady={(e) => (openGrid.current = e.api)}
                      onGridPreDestroyed={() => (openGrid.current = null)}
                      onRowClicked={(e) => e.data && setChosen(e.data.calloutId)}
                    />
                  </div>
                )}
              </section>

              <section className="flex min-w-0 flex-col gap-2" data-closed-section="">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('sections.closed', { n: fsi(String(windowMin)) })}
                </h2>
                {closed.length === 0 ? (
                  <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-closed-empty="">
                    {isFilteredBoard(filter) ? t('sections.emptyFiltered') : t('sections.emptyClosed', { n: fsi(String(windowMin)) })}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border border-border/60" data-closed-grid="">
                    <AgGridReact<BoardRow>
                      theme={omsGridTheme}
                      rowData={closed}
                      columnDefs={closedColumns}
                      defaultColDef={BOARD_DEFAULT_COL_DEF}
                      getRowId={({ data }) => data.calloutId}
                      rowHeight={OMS_GRID_ROW_HEIGHT}
                      headerHeight={OMS_GRID_HEADER_HEIGHT}
                      domLayout="autoHeight"
                      animateRows={false}
                      suppressColumnVirtualisation
                      rowClass="cursor-pointer"
                      rowClassRules={rowClassRules}
                      onGridReady={(e) => (closedGrid.current = e.api)}
                      onGridPreDestroyed={() => (closedGrid.current = null)}
                      onRowClicked={(e) => e.data && setChosen(e.data.calloutId)}
                    />
                  </div>
                )}
              </section>
            </div>

            <Inspector
              row={selected}
              canRelease={canRelease}
              justReleased={selected ? released.has(selected.calloutId) : false}
              onRelease={() => selected && setReleasing(selected)}
              canLinkServingList={canLinkServingList}
            />
          </div>
        </>
      )}

      <ReleaseLockDialog
        open={releasing !== null}
        deliveryNumber={releasing?.deliveryNumber ?? ''}
        heldBy={releasing ? releasing.awardedParty || releasing.fallbackParty : ''}
        onClose={() => setReleasing(null)}
        onReleased={(result) => {
          if (releasing) setReleased((s) => new Set(s).add(releasing.calloutId))
          setReleasing(null)
          toast.success(t('release.done', { delivery: fsi(result.deliveryNumber) }))
          void queryClient.invalidateQueries({ queryKey: BOARD_KEY })
        }}
      />
    </div>
  )
}

function Tile({ tile, windowMin }: { tile: BoardTile; windowMin: number }) {
  const { t } = useTranslation('dispatch-board')
  return (
    <div
      className={
        'flex flex-col items-start gap-0.5 rounded-lg border border-t-4 border-border/60 bg-card px-3 py-2 ' +
        (tile.attention ? 'border-t-attention' : 'border-t-border')
      }
      data-tile={tile.key}
      data-tile-value={tile.value}
    >
      <span className="text-xs text-muted-foreground">{t(`tiles.${tile.key}`, { n: fsi(String(windowMin)) })}</span>
      <span className="font-mono text-xl font-medium tabular-nums">
        <Ltr>{String(tile.value)}</Ltr>
      </span>
      <span className="text-xs text-muted-foreground" data-tile-sub="">
        <Trans t={t} i18nKey={tile.sub.key} values={tile.sub.values} components={{ v: <Ltr /> }} />
      </span>
    </div>
  )
}

/** The three filters, applied together (Enter or Apply) and kept in the URL. */
function Filters({
  filter,
  onApply,
  resetFromOutside,
}: {
  filter: DispatchBoardFilter
  onApply: (f: DispatchBoardFilter) => void
  resetFromOutside: () => boolean
}) {
  const { t } = useTranslation('dispatch-board')
  const [draft, setDraft] = useState(filter)
  useEffect(() => {
    if (resetFromOutside()) setDraft(filter)
  }, [filter, resetFromOutside])
  const field = (name: keyof DispatchBoardFilter) => (
    <label className="flex flex-col gap-0.5 text-xs font-medium text-muted-foreground">
      {t(`filters.${name}`)}
      <input
        value={draft[name]}
        onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
        placeholder={t('filters.any')}
        dir="auto"
        className="h-8 w-40 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        data-filter={name}
      />
    </label>
  )
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onApply(draft)
      }}
      data-filters=""
    >
      {field('channel')}
      {field('city')}
      {field('store')}
      <Button type="submit" variant="secondary" data-filter-apply="">
        {t('filters.apply')}
      </Button>
      {isFilteredBoard(filter) && (
        <Button
          type="button"
          variant="text"
          onClick={() => {
            setDraft(EMPTY_BOARD_FILTER)
            onApply(EMPTY_BOARD_FILTER)
          }}
          data-filter-clear=""
        >
          {t('filters.clear')}
        </Button>
      )}
    </form>
  )
}
