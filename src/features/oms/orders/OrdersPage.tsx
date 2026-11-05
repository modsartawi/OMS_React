import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Bookmark, Loader2, Search } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import type {
  CellFocusedEvent,
  CellKeyDownEvent,
  ColumnState,
  FirstDataRenderedEvent,
  FullWidthCellKeyDownEvent,
  GridApi,
  GridReadyEvent,
  IRowNode,
  ModelUpdatedEvent,
  OverlayType,
  RowDoubleClickedEvent,
  SelectionChangedEvent,
  StateUpdatedEvent,
} from 'ag-grid-community'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { useCommands } from '@/core/commands/registry'
import {
  INSPECTOR_KEYS,
  NEXT_ROW_KEYS,
  nextRowIndex,
  parseInspectorPrefs,
  PREVIOUS_ROW_KEYS,
  serializeInspectorPrefs,
  type InspectorPrefs,
} from '@/core/list/list-keys'
import type { OrderDocumentRow, OrderSearchCriteria } from '@/core/models/order-document'
import { omsAccessQuery } from '@/core/oms/api'
import { canViewInsurance } from '@/core/oms/insurance-grant'
import { fromListState } from '@/core/oms/open-intent'
import { useSession } from '@/core/session'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { fsi } from '@/core/util/bidi'
import { ordersApi } from './api'
import { buildOrderColumns, ORDER_DEFAULT_COL_DEF, ORDER_ROW_SELECTION } from './columns'
import EmptyOverlay, { type EmptyKind } from './EmptyOverlay'
import GridToolbar, { InspectorToggle, RowSummary } from './GridToolbar'
import { documentPathOf } from './inspector-model'
import { isCut, LENS_IDS, lensCounts, lensIsEmpty, lensMatches, rowPill, type LoadedResult } from './lenses'
import MyViews, { ModifiedDot, type ViewAction } from './MyViews'
import OrderInspector from './OrderInspector'
import QueryBar from './QueryBar'
import { hasIdentifier, QUERY_FOCUS_KEYS, searchProblem, toSearchCriteria, withinGrant, type QueryCriteria } from './query-model'
import {
  defaultView,
  deleteView,
  isDrifted,
  nameTaken,
  newViewId,
  opensOnDefault,
  renameView,
  restoreView,
  saveView,
  toggleDefault,
  updateView,
  type NameRefusal,
  type SavedView,
  type ViewLayout,
  type ViewSnapshot,
} from './saved-views'
import { orderRowKey, useOrderSearch } from './search-store'
import StatusBar from './StatusBar'
import { useOrderViews } from './view-store'
import ViewNameDialog, { type ViewNameMode } from './ViewNameDialog'
import ViewsRail, { LENS_ICON } from './ViewsRail'

/** The remembered pane, per browser. Versioned, so a later shape never misreads this one. */
const INSPECTOR_PREFS_KEY = 'oms.orders.inspector.v1'

/**
 * The Order / ERX list (ticket 786, BackOffice spec 3389, door 3391): finds an order or an ERX
 * prescription by any identifier — before it has a delivery — on the Deliveries list's shell.
 *
 * - The **query bar** carries 3391's criteria. An identifier ignores the date; without one the
 *   search needs a range of at most 31 days (default the last 3), refused here before it is sent.
 * - The **lenses** — All, Bupa Care Connect, No delivery yet, Channel / Engine money — narrow the
 *   LOADED rows through the grid's external filter, never the server.
 * - **Saved views** keep the Date relative. The starred default runs on open when there is no
 *   in-memory search.
 * - The **inspector** shows the current row from the row alone; Enter or a double-click opens
 *   Document details, and a row with a delivery links it.
 * - 🚩 **Patient and member ID** — token, column, inspector line and export — only with the
 *   insurance-view grant (`@/core/oms/insurance-grant`, fails closed).
 *
 * Self-guards on `canOpenList`, sharing the ONE OMS probe entry with the menu and both OMS pages.
 * Read-only: nothing on this screen writes.
 */
export default function OrdersPage() {
  const { t } = useTranslation('orders')
  const navigate = useNavigate()

  const rows = useOrderSearch((s) => s.rows)
  const limit = useOrderSearch((s) => s.limit)
  const error = useOrderSearch((s) => s.error)
  const draft = useOrderSearch((s) => s.draft)
  const lastRun = useOrderSearch((s) => s.query)
  const setDraft = useOrderSearch((s) => s.setDraft)
  const lens = useOrderSearch((s) => s.lens)
  const setLens = useOrderSearch((s) => s.setLens)
  const activeViewId = useOrderSearch((s) => s.activeViewId)

  const userId = useSession((s) => s.userId)
  const viewStore = useOrderViews((s) => s.store)
  const viewsLoadedFor = useOrderViews((s) => s.loadedFor)
  const commitViews = useOrderViews((s) => s.commit)
  useEffect(() => useOrderViews.getState().load(userId), [userId])
  const activeView = viewStore.views.find((v) => v.id === activeViewId) ?? null
  const [viewDialog, setViewDialog] = useState<ViewNameMode | null>(null)
  const defaultColumns = useRef<ColumnState[] | null>(null)
  // The shared OMS probe (same key and options as the menu and both OMS pages: one call).
  const access = useQuery(omsAccessQuery())
  const canOpenList = access.data?.canOpenList === true
  const insuranceGrant = canViewInsurance(access.data)
  const grants = useMemo(() => ({ canViewInsurance: insuranceGrant }), [insuranceGrant])

  // Drift is measured on what this session may hold: a view's hidden patient ID is not a change.
  const modified = useOrderSearch((s) =>
    activeView
      ? isDrifted(
          { ...activeView, query: activeView.query && withinGrant(activeView.query, grants) },
          { query: withinGrant(s.draft, grants), lens: s.lens, columnState: s.columnState, filterModel: s.filterModel },
          defaultColumns.current,
        )
      : false,
  )

  const [gridApi, setGridApi] = useState<GridApi<OrderDocumentRow> | null>(null)
  const addFilterRef = useRef<HTMLButtonElement>(null)
  const [selectedRow, setSelectedRow] = useState<OrderDocumentRow | null>(null)
  const [inspector, setInspector] = useState<InspectorPrefs>(readInspectorPrefs)
  const [displayed, setDisplayed] = useState({ count: 0, columnFiltered: false })

  useEffect(() => {
    try {
      localStorage.setItem(INSPECTOR_PREFS_KEY, serializeInspectorPrefs(inspector))
    } catch {
      // Storage full or blocked: the pane still works, it just isn't remembered.
    }
  }, [inspector])

  /** The layout + selection to restore on THIS mount, snapshotted before the grid emits events. */
  const restore = useRef(useOrderSearch.getState())

  const columns = useMemo(() => buildOrderColumns(t, grants), [t, grants])

  const latestSearch = useRef(0)
  const search = useMutation({
    mutationFn: ({ criteria }: { seq: number; query: QueryCriteria; criteria: OrderSearchCriteria }) => ordersApi.search(criteria),
    onMutate: () => {
      gridApi?.deselectAll()
      setSelectedRow(null)
      useOrderSearch.getState().beginSearch()
    },
    onSuccess: (result, { seq, query, criteria }) => {
      if (seq !== latestSearch.current) return
      useOrderSearch.getState().setResult(result, criteria.limit ?? 0, query)
    },
    onError: (err: unknown, { seq }) => {
      if (seq !== latestSearch.current) return
      const message = apiErrorMessage(err, t('search.unexpected'))
      useOrderSearch.getState().setError(message)
      toast.error(t('search.failed.title'), { description: message })
    },
  })

  const onGridReady = useCallback((event: GridReadyEvent<OrderDocumentRow>) => {
    setGridApi(event.api)
    defaultColumns.current = event.api.getColumnState()
    const { columnState, filterModel } = restore.current
    if (columnState) event.api.applyColumnState({ state: columnState, applyOrder: true })
    if (filterModel) event.api.setFilterModel(filterModel)
  }, [])

  const onFirstDataRendered = useCallback((event: FirstDataRenderedEvent<OrderDocumentRow>) => {
    const key = restore.current.selectedKey
    if (!key) return
    event.api.forEachNode((node) => {
      if (node.data && orderRowKey(node.data) === key) {
        node.setSelected(true)
        event.api.ensureNodeVisible(node, 'middle')
      }
    })
  }, [])

  const onStateUpdated = useCallback((event: StateUpdatedEvent<OrderDocumentRow>) => {
    useOrderSearch.getState().captureGridState(event.api.getColumnState(), event.api.getFilterModel())
  }, [])

  const onSelectionChanged = useCallback((event: SelectionChangedEvent<OrderDocumentRow>) => {
    const row = event.api.getSelectedRows()[0] ?? null
    setSelectedRow(row)
    useOrderSearch.getState().setSelectedKey(row ? orderRowKey(row) : null)
  }, [])

  /** Selection follows focus: the focused row IS the current row. */
  const onCellFocused = useCallback((event: CellFocusedEvent<OrderDocumentRow>) => {
    if (event.rowIndex == null || event.rowPinned) return
    const node = event.api.getDisplayedRowAtIndex(event.rowIndex)
    if (node && !node.isSelected()) node.setSelected(true, true)
  }, [])

  const openRow = useCallback(
    (row: OrderDocumentRow | null | undefined) => {
      const to = row ? documentPathOf(row) : null
      // Marked as come from the list, so Details' Esc goes back to this entry.
      if (to) navigate(to, { state: fromListState() })
    },
    [navigate],
  )

  /** Enter opens Document details (the grid's own event: AG Grid prevents Enter on a cell). */
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<OrderDocumentRow> | FullWidthCellKeyDownEvent<OrderDocumentRow>) => {
      const key = event.event
      if (!(key instanceof KeyboardEvent) || key.key !== 'Enter' || key.isComposing) return
      if (key.ctrlKey || key.altKey || key.metaKey || key.shiftKey) return
      if (key.target instanceof Element && key.target.closest('button, a')) return
      openRow(event.data)
    },
    [openRow],
  )

  const onRowDoubleClicked = useCallback((event: RowDoubleClickedEvent<OrderDocumentRow>) => openRow(event.data), [openRow])

  // The lens is the grid's external filter, read through a ref so the callbacks stay stable.
  const lensRef = useRef(lens)
  const isExternalFilterPresent = useCallback(() => lensRef.current !== 'all', [])
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<OrderDocumentRow>) => !node.data || lensMatches(lensRef.current, node.data),
    [],
  )
  useEffect(() => {
    lensRef.current = lens
    if (!gridApi) return
    gridApi.onFilterChanged()
    const selected = gridApi.getSelectedRows()[0]
    if (selected && !lensMatches(lens, selected)) gridApi.deselectAll()
  }, [gridApi, lens])

  const onModelUpdated = useCallback((event: ModelUpdatedEvent<OrderDocumentRow>) => {
    const count = event.api.getDisplayedRowCount()
    const columnFiltered = event.api.isColumnFilterPresent()
    setDisplayed((prev) => (prev.count === count && prev.columnFiltered === columnFiltered ? prev : { count, columnFiltered }))
  }, [])

  const loaded = useMemo<LoadedResult | null>(() => (rows && limit !== null && !error ? { rows, limit } : null), [rows, limit, error])
  const counts = useMemo(() => lensCounts(loaded), [loaded])

  const toggleInspector = useCallback(() => setInspector((prefs) => ({ ...prefs, open: !prefs.open })), [])

  /**
   * Search runs the draft as it stands in the store. 3391's date rule is checked first: a search
   * the door would refuse is refused here, with the reason, and nothing is sent. The relative Date
   * resolves against the clock here, and nowhere earlier.
   */
  const runSearch = ({ supersede = false } = {}) => {
    if (search.isPending && !supersede) return
    const query = withinGrant(useOrderSearch.getState().draft, grants)
    const now = new Date()
    const problem = searchProblem(query, now, grants)
    if (problem) {
      toast.error(t('search.refused.title'), { description: t(`search.refused.${problem}`) })
      return
    }
    search.mutate({ seq: ++latestSearch.current, query, criteria: toSearchCriteria(query, now, grants) })
  }
  const hasRows = (rows?.length ?? 0) > 0
  const steppable = gridApi !== null && hasRows && !error

  const liveGrid = () => (gridApi && !gridApi.isDestroyed() ? gridApi : null)

  const applyLayout = (view: SavedView) => {
    const store = useOrderSearch.getState()
    const api = liveGrid()
    let layout: ViewLayout
    if (api) {
      api.resetColumnState()
      if (view.columnState) api.applyColumnState({ state: view.columnState, applyOrder: true })
      api.setFilterModel(view.filterModel)
      layout = { columnState: api.getColumnState(), filterModel: api.getFilterModel() }
    } else {
      layout = { columnState: view.columnState, filterModel: view.filterModel }
    }
    store.captureGridState(layout.columnState, layout.filterModel)
    restore.current = { ...restore.current, ...layout }
  }

  /** Applying a view runs its search; a layout-only view sets the layout and runs nothing. */
  const applyView = (view: SavedView) => {
    const store = useOrderSearch.getState()
    store.setActiveView(view.id)
    applyLayout(view)
    if (view.query === null) return
    store.setDraft(withinGrant(view.query, grants))
    store.setLens(view.lens)
    runSearch({ supersede: true })
  }

  const snapshot = (): ViewSnapshot => {
    const store = useOrderSearch.getState()
    const api = liveGrid()
    return {
      query: withinGrant(store.draft, grants),
      lens: store.lens,
      columnState: api ? api.getColumnState() : store.columnState,
      filterModel: api ? api.getFilterModel() : store.filterModel,
    }
  }

  const submitViewName = (name: string): NameRefusal | null => {
    if (!viewDialog) return null
    const result =
      viewDialog.kind === 'save' ? saveView(viewStore, name, snapshot(), newViewId()) : renameView(viewStore, viewDialog.view.id, name)
    if (!result.ok) return result.refusal
    commitViews(result.store)
    setViewDialog(null)
    if (viewDialog.kind === 'save') {
      useOrderSearch.getState().setActiveView(result.view.id)
      toast.success(t('views.saved.title'), { description: t('views.saved.detail', { name: fsi(result.view.name) }) })
    }
    return null
  }

  const onViewAction = (action: ViewAction, view: SavedView) => {
    switch (action) {
      case 'update':
        commitViews(updateView(viewStore, view.id, snapshot()))
        toast.success(t('views.updated.title'), { description: t('views.updated.detail', { name: fsi(view.name) }) })
        return
      case 'saveAs':
        setViewDialog({ kind: 'save' })
        return
      case 'rename':
        setViewDialog({ kind: 'rename', view })
        return
      case 'toggleDefault':
        commitViews(toggleDefault(viewStore, view.id))
        return
      case 'delete': {
        const { store, removed } = deleteView(viewStore, view.id)
        if (!removed) return
        const wasActive = useOrderSearch.getState().activeViewId === view.id
        commitViews(store)
        if (wasActive) useOrderSearch.getState().setActiveView(null)
        toast.info(t('views.deleted.title'), {
          description: t('views.deleted.detail', { name: fsi(view.name) }),
          action: {
            label: t('views.deleted.undo'),
            onClick: () => {
              const views = useOrderViews.getState()
              views.commit(restoreView(views.store, removed))
              const state = useOrderSearch.getState()
              if (wasActive && state.activeViewId === null) state.setActiveView(view.id)
            },
          },
        })
        return
      }
    }
  }

  // The starred default applies and runs on open: once per mount, only with no in-memory search.
  const defaultTried = useRef(false)
  useEffect(() => {
    if (defaultTried.current || !canOpenList || !userId || viewsLoadedFor !== userId) return
    defaultTried.current = true
    const view = defaultView(viewStore)
    if (view && opensOnDefault(useOrderSearch.getState())) applyView(view)
  }, [canOpenList, userId, viewsLoadedFor, viewStore])

  useCommands(
    canOpenList
      ? [
          {
            id: 'row.next',
            label: 'orders:inspector.nextRow',
            keys: NEXT_ROW_KEYS,
            hidden: true,
            run: steppable ? () => stepRow(gridApi, 1) : null,
            reason: 'orders:inspector.noRows',
          },
          {
            id: 'row.previous',
            label: 'orders:inspector.previousRow',
            keys: PREVIOUS_ROW_KEYS,
            hidden: true,
            run: steppable ? () => stepRow(gridApi, -1) : null,
            reason: 'orders:inspector.noRows',
          },
          { id: 'query.focus', label: 'orders:query.focus', icon: Search, keys: QUERY_FOCUS_KEYS, run: () => addFilterRef.current?.focus() },
          {
            id: 'inspector.toggle',
            label: inspector.open ? 'orders:inspector.hide' : 'orders:inspector.show',
            keys: INSPECTOR_KEYS,
            run: toggleInspector,
          },
          ...LENS_IDS.map((id) => ({ id: `lens.${id}`, label: `orders:lens.show.${id}`, icon: LENS_ICON[id], run: () => setLens(id) })),
          ...viewStore.views.map((view) => ({
            id: `view.${view.id}`,
            label: 'orders:views.applyRow',
            detail: view.name,
            icon: Bookmark,
            run: () => applyView(view),
          })),
        ]
      : [],
  )

  // ----- access states ------------------------------------------------------
  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('access.checking')}
      </div>
    )
  }
  if (!canOpenList) {
    const unreachable = access.isError
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-oms-denied="orders">
        <div className="text-base font-semibold tracking-tight">{t(unreachable ? 'access.unavailableTitle' : 'access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable ? apiErrorMessage(access.error, t('access.unavailableHint')) : t('access.deniedHint')}
        </p>
      </div>
    )
  }

  const showResults = rows !== null && !error
  const pill = rowPill(loaded, lens, { displayed: displayed.count, columnFiltered: displayed.columnFiltered })
  const lensEmpty = lensIsEmpty(loaded, lens)
  const empty: EmptyKind | null =
    rows === null ? (search.isPending ? null : 'before') : rows.length === 0 ? 'none' : lensEmpty ? 'lens' : null

  return (
    <div className="flex" data-orders-page="">
      <ViewsRail
        lens={lens}
        counts={counts}
        onLens={setLens}
        className="sticky top-11 z-20 -my-4 -ms-4 me-4 h-[calc(100dvh-2.75rem)] self-start"
      >
        <MyViews
          views={viewStore.views}
          activeId={activeView?.id ?? null}
          defaultId={viewStore.defaultId}
          modified={modified}
          onApply={applyView}
          onAction={onViewAction}
          onSave={() => setViewDialog({ kind: 'save' })}
        />
      </ViewsRail>
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <QueryBar
          draft={draft}
          lastRun={lastRun}
          searching={search.isPending}
          grants={grants}
          dateIgnored={hasIdentifier(draft, grants)}
          addRef={addFilterRef}
          onDraft={setDraft}
          onSearch={() => runSearch()}
        />

        <div className="flex flex-wrap items-center gap-3">
          {activeView ? (
            <h1 className="flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight" data-active-view="">
              <bdi className="truncate">{activeView.name}</bdi>
              {modified && <ModifiedDot />}
            </h1>
          ) : (
            <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
          )}
          {pill && (
            <RowSummary pill={pill} cut={isCut(loaded)} limit={loaded?.limit ?? null} onClearFilters={() => gridApi?.setFilterModel(null)} />
          )}
          <div className="flex-1" />
          {search.isPending && (
            <span role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('search.searching')}
            </span>
          )}
          {showResults && <GridToolbar gridApi={gridApi} selectedRow={selectedRow} hasRows={hasRows} grants={grants} />}
          <InspectorToggle open={inspector.open} onToggle={toggleInspector} />
        </div>

        {error ? (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="font-medium">{t('search.failed.title')}</p>
              <p className="text-muted-foreground">
                <bdi>{error}</bdi>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="relative h-[calc(100vh-17.75rem)] min-h-96">
              <AgGridReact<OrderDocumentRow>
                theme={omsGridTheme}
                rowData={rows ?? NO_ROWS}
                columnDefs={columns}
                defaultColDef={ORDER_DEFAULT_COL_DEF}
                rowSelection={ORDER_ROW_SELECTION}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                tooltipShowDelay={500}
                animateRows={false}
                onGridReady={onGridReady}
                onFirstDataRendered={onFirstDataRendered}
                onStateUpdated={onStateUpdated}
                onSelectionChanged={onSelectionChanged}
                onCellFocused={onCellFocused}
                onCellKeyDown={onCellKeyDown}
                onRowDoubleClicked={onRowDoubleClicked}
                onModelUpdated={onModelUpdated}
                isExternalFilterPresent={isExternalFilterPresent}
                doesExternalFilterPass={doesExternalFilterPass}
                suppressOverlays={lensEmpty ? GRID_OVERLAYS_UNDER_LENS : GRID_OVERLAYS}
              />
              {empty && <EmptyOverlay kind={empty} />}
            </div>
            <StatusBar loaded={loaded} selected={selectedRow !== null} />
          </div>
        )}
      </section>

      {inspector.open && (
        <OrderInspector
          row={selectedRow}
          grants={grants}
          width={inspector.width}
          onWidth={(width) => setInspector((prefs) => ({ ...prefs, width }))}
          onCollapse={toggleInspector}
          onOpen={(to) => navigate(to, { state: fromListState() })}
          className="sticky top-11 -my-4 -me-4 ms-4 h-[calc(100dvh-2.75rem)] self-start"
        />
      )}

      <ViewNameDialog
        mode={viewDialog}
        isTaken={(name, exceptId) => nameTaken(viewStore, name, exceptId)}
        onClose={() => setViewDialog(null)}
        onSubmit={submitViewName}
      />
    </div>
  )
}

const NO_ROWS: OrderDocumentRow[] = []
const GRID_OVERLAYS: OverlayType[] = ['loading', 'noRows']
const GRID_OVERLAYS_UNDER_LENS: OverlayType[] = ['loading', 'noRows', 'noMatchingRows']

function readInspectorPrefs(): InspectorPrefs {
  try {
    return parseInspectorPrefs(localStorage.getItem(INSPECTOR_PREFS_KEY))
  } catch {
    return parseInspectorPrefs(null)
  }
}

/** J (`+1`) / K (`-1`): move the one current row, as ↓/↑ do, from anywhere on the screen. */
function stepRow(api: GridApi<OrderDocumentRow>, delta: 1 | -1) {
  const current = api.getSelectedNodes()[0]?.rowIndex ?? null
  const next = nextRowIndex(current, delta, api.getDisplayedRowCount())
  if (next === null) return
  const node = api.getDisplayedRowAtIndex(next)
  if (!node) return
  node.setSelected(true, true)
  api.ensureIndexVisible(next)
  const column = api.getFocusedCell()?.column ?? api.getAllDisplayedColumns()[0]
  if (column) api.setFocusedCell(next, column)
}
