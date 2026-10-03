import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Bookmark, Loader2, Search } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import type {
  CellFocusedEvent,
  ColumnState,
  CellKeyDownEvent,
  FirstDataRenderedEvent,
  FullWidthCellKeyDownEvent,
  GridApi,
  GridReadyEvent,
  IRowNode,
  ModelUpdatedEvent,
  RowDoubleClickedEvent,
  SelectionChangedEvent,
  StateUpdatedEvent,
} from 'ag-grid-community'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { apiErrorMessage } from '@/core/api'
import { useCommands } from '@/core/commands/registry'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_ACCESS_KEY, omsAccessApi } from '@/core/oms/api'
import { useSession } from '@/core/session'
import { fsi } from '@/core/util/bidi'
import { deliveriesApi } from './api'
import { buildDeliveryColumns, DELIVERY_DEFAULT_COL_DEF, DELIVERY_ROW_SELECTION } from './columns'
import DeliveryInspector from './DeliveryInspector'
import { effectiveLimit, type DeliveryFilterCriteria } from './filter'
import GridToolbar, { InspectorToggle, RowSummary } from './GridToolbar'
import { detailsPathOf } from './inspector-model'
import {
  INSPECTOR_KEYS,
  INSPECTOR_PREFS_KEY,
  NEXT_ROW_KEYS,
  nextRowIndex,
  PREVIOUS_ROW_KEYS,
  parseInspectorPrefs,
  serializeInspectorPrefs,
  type InspectorPrefs,
} from './inspector-pane'
import { isCut, LENS_IDS, lensCounts, lensIsEmpty, lensMatches, rowPill, type LoadedResult } from './lenses'
import MyViews, { ModifiedDot, type ViewAction } from './MyViews'
import QueryBar from './QueryBar'
import { QUERY_FOCUS_KEYS, toFilterCriteria, type QueryCriteria } from './query-model'
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
import { deliveryRowKey, useDeliverySearch } from './search-store'
import { useSavedViews } from './view-store'
import ViewNameDialog, { type ViewNameMode } from './ViewNameDialog'
import ViewsRail, { LENS_ICON } from './ViewsRail'

/**
 * Screen 1 — Delivery Documents Inquiry.
 *
 * Hosts the query bar, the results toolbar and the AG Grid results grid: the bar
 * edits the draft criteria, this component runs `DeliveryDocumentList` on Search and
 * feeds the rows in. Loading, empty and error states are explicit.
 *
 * The search state (the draft and last-run query, rows, working grid layout, selected row) lives in
 * the module-scoped `useDeliverySearch` store rather than in this component, so
 * a drill-down into Screen 2 and back restores everything instead of re-creating
 * the screen empty (R-8).
 *
 * Self-guards on `canOpenList` (ticket 125): spinner → denied card → content, sharing
 * the ONE `OMS_ACCESS_KEY` cache entry with the menu probe and the Document Details
 * guard. The server's `SdDocumentWeb/*` grant filter stays authoritative; this only
 * spares a denied deep-link a request it cannot make.
 *
 * The Delivery inspector (ticket 397) sits at the inline-end edge and shows the current row
 * from the row alone. Selection follows focus, so ↓/↑ and J/K move ONE current row and the
 * inspector follows it; Enter (on the grid's `onCellKeyDown`, because AG Grid prevents Enter
 * on a cell) and a double-click open Delivery details.
 *
 * The views rail (ticket 398) sits at the inline-start edge. Its lenses narrow the LOADED rows
 * through the grid's external filter, never the server, and their counts cover the whole loaded
 * result, ignoring the grid's column filters (366). The grid bar's pill says what is shown.
 *
 * The query bar (ticket 399) sits across the top of the centre column. Its Date stays relative
 * until Search resolves it against the clock, and `/` focuses it.
 *
 * The operator's saved views (ticket 400) sit under the lenses. Applying one sets its layout and,
 * unless it is layout-only, its criteria and lens, and runs its search. The starred default
 * applies and runs on open when there is no in-memory search, so returning from Delivery details
 * keeps the search that was there.
 */
export default function DeliveriesPage() {
  const { t } = useTranslation('deliveries')
  const navigate = useNavigate()

  const rows = useDeliverySearch((s) => s.rows)
  const limit = useDeliverySearch((s) => s.limit)
  const error = useDeliverySearch((s) => s.error)
  const draft = useDeliverySearch((s) => s.draft)
  const lastRun = useDeliverySearch((s) => s.query)
  const setDraft = useDeliverySearch((s) => s.setDraft)
  const lens = useDeliverySearch((s) => s.lens)
  const setLens = useDeliverySearch((s) => s.setLens)
  const activeViewId = useDeliverySearch((s) => s.activeViewId)

  // The signed-in user's saved views: read (and the old layouts imported) per user.
  const userId = useSession((s) => s.userId)
  const viewStore = useSavedViews((s) => s.store)
  const viewsLoadedFor = useSavedViews((s) => s.loadedFor)
  const commitViews = useSavedViews((s) => s.commit)
  useEffect(() => useSavedViews.getState().load(userId), [userId])
  const activeView = viewStore.views.find((v) => v.id === activeViewId) ?? null
  const [viewDialog, setViewDialog] = useState<ViewNameMode | null>(null)
  /** The grid's own layout, read before any restore: what a view saved before any grid stands on. */
  const defaultColumns = useRef<ColumnState[] | null>(null)
  // Recomputed on every store change, but the page re-renders only when the answer flips.
  const modified = useDeliverySearch((s) =>
    activeView
      ? isDrifted(
          activeView,
          { query: s.draft, lens: s.lens, columnState: s.columnState, filterModel: s.filterModel },
          defaultColumns.current,
        )
      : false,
  )

  const [gridApi, setGridApi] = useState<GridApi<DeliveryDocumentModel> | null>(null)
  // The query bar's + Filter, which `/` focuses.
  const addFilterRef = useRef<HTMLButtonElement>(null)
  const [selectedRow, setSelectedRow] = useState<DeliveryDocumentModel | null>(null)
  const [inspector, setInspector] = useState<InspectorPrefs>(readInspectorPrefs)
  // What the grid shows once the lens and the column filters have narrowed it (the pill).
  const [displayed, setDisplayed] = useState({ count: 0, columnFiltered: false })

  // Width and open/closed, remembered per browser (367 §4).
  useEffect(() => {
    try {
      localStorage.setItem(INSPECTOR_PREFS_KEY, serializeInspectorPrefs(inspector))
    } catch {
      // Storage full or blocked: the pane still works, it just isn't remembered.
    }
  }, [inspector])

  /**
   * The layout + selection to restore on THIS mount, snapshotted before the grid
   * exists and starts emitting its own state events — so the one-time restore
   * cannot race the live capture wired through `onStateUpdated` (R-8).
   */
  const restore = useRef(useDeliverySearch.getState())

  const columns = useMemo(() => buildDeliveryColumns(t), [t])

  // Both options MATCH the menu probe's own on this shared key (see useVisibleMenu), and
  // matching is the point: `staleTime: Infinity` keeps this observer from marking the
  // shared entry stale and refetching on mount — a second answer that failed would empty
  // the OMS group from the nav while this screen is happily open. `retry: false` lands a
  // fail-closed grant on the card at once instead of holding "Checking access…" through a
  // retry backoff.
  const access = useQuery({
    queryKey: OMS_ACCESS_KEY,
    queryFn: () => omsAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  })
  const canOpenList = access.data?.canOpenList === true

  // The latest search's number. A view applied while a search runs starts its own search, and
  // the earlier one's answer, if it lands later, is dropped rather than shown under the view.
  const latestSearch = useRef(0)
  const search = useMutation({
    mutationFn: ({ criteria }: { seq: number; query: QueryCriteria; criteria: DeliveryFilterCriteria }) =>
      deliveriesApi.search(criteria),
    onMutate: () => {
      // The grid's selection goes with the page's, so a failed re-search (old rows kept on
      // screen) never shows a highlighted row beside an empty inspector.
      gridApi?.deselectAll()
      setSelectedRow(null)
      useDeliverySearch.getState().beginSearch()
    },
    onSuccess: (result, { seq, query, criteria }) => {
      if (seq !== latestSearch.current) return
      // No success toast. The outcome of a search is the most visible thing on
      // the screen — the grid repaints and the row pill updates — so announcing
      // it says only what the operator just watched happen. Failures still toast:
      // that IS invisible (the grid keeps showing stale rows).
      useDeliverySearch.getState().setResult(result, effectiveLimit(criteria), query)
    },
    onError: (err: unknown, { seq }) => {
      if (seq !== latestSearch.current) return
      const message = apiErrorMessage(err, t('search.unexpected'))
      useDeliverySearch.getState().setError(message)
      toast.error(t('search.failed.title'), { description: message })
    },
  })

  /** Capture the grid API and rehydrate the layout worked before the drill-down. */
  const onGridReady = useCallback((event: GridReadyEvent<DeliveryDocumentModel>) => {
    setGridApi(event.api)
    defaultColumns.current = event.api.getColumnState()
    const { columnState, filterModel } = restore.current
    if (columnState) event.api.applyColumnState({ state: columnState, applyOrder: true })
    if (filterModel) event.api.setFilterModel(filterModel)
  }, [])

  /** Re-select and centre the row last opened on Screen 2 once the rows render (R-8). */
  const onFirstDataRendered = useCallback((event: FirstDataRenderedEvent<DeliveryDocumentModel>) => {
    const key = restore.current.selectedKey
    if (!key) return
    event.api.forEachNode((node) => {
      if (node.data && deliveryRowKey(node.data) === key) {
        node.setSelected(true)
        event.api.ensureNodeVisible(node, 'middle')
      }
    })
  }, [])

  /** Keep the store's copy of the working layout current (R-8). */
  const onStateUpdated = useCallback((event: StateUpdatedEvent<DeliveryDocumentModel>) => {
    useDeliverySearch
      .getState()
      .captureGridState(event.api.getColumnState(), event.api.getFilterModel())
  }, [])

  const onSelectionChanged = useCallback((event: SelectionChangedEvent<DeliveryDocumentModel>) => {
    const row = event.api.getSelectedRows()[0] ?? null
    setSelectedRow(row)
    useDeliverySearch.getState().setSelectedKey(row ? deliveryRowKey(row) : null)
  }, [])

  /** Selection follows focus (365 §5): the focused row IS the current row. */
  const onCellFocused = useCallback((event: CellFocusedEvent<DeliveryDocumentModel>) => {
    if (event.rowIndex == null || event.rowPinned) return
    const node = event.api.getDisplayedRowAtIndex(event.rowIndex)
    if (node && !node.isSelected()) node.setSelected(true, true)
  }, [])

  const openRow = useCallback(
    (row: DeliveryDocumentModel | null | undefined) => {
      const to = row ? detailsPathOf(row) : null
      if (to) navigate(to)
    },
    [navigate],
  )

  /**
   * Enter opens Delivery details. It is the grid's own event, because AG Grid prevents Enter
   * on a cell, so the window key layer never sees it (368). Enter on a button or link inside a
   * cell stays that control's.
   */
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<DeliveryDocumentModel> | FullWidthCellKeyDownEvent<DeliveryDocumentModel>) => {
      const key = event.event
      if (!(key instanceof KeyboardEvent) || key.key !== 'Enter' || key.isComposing) return
      if (key.ctrlKey || key.altKey || key.metaKey || key.shiftKey) return
      if (key.target instanceof Element && key.target.closest('button, a')) return
      openRow(event.data)
    },
    [openRow],
  )

  const onRowDoubleClicked = useCallback(
    (event: RowDoubleClickedEvent<DeliveryDocumentModel>) => openRow(event.data),
    [openRow],
  )

  // The lens is the grid's external filter. The grid reads it through a ref, so the filter
  // callbacks stay stable and a lens change only asks the grid to filter again.
  const lensRef = useRef(lens)
  const isExternalFilterPresent = useCallback(() => lensRef.current !== 'all', [])
  const doesExternalFilterPass = useCallback(
    (node: IRowNode<DeliveryDocumentModel>) => !node.data || lensMatches(lensRef.current, node.data),
    [],
  )
  useEffect(() => {
    lensRef.current = lens
    if (!gridApi) return
    gridApi.onFilterChanged()
    // A current row the lens hides is no longer on screen: the inspector lets it go too.
    const selected = gridApi.getSelectedRows()[0]
    if (selected && !lensMatches(lens, selected)) gridApi.deselectAll()
  }, [gridApi, lens])

  const onModelUpdated = useCallback((event: ModelUpdatedEvent<DeliveryDocumentModel>) => {
    const count = event.api.getDisplayedRowCount()
    const columnFiltered = event.api.isColumnFilterPresent()
    setDisplayed((prev) =>
      prev.count === count && prev.columnFiltered === columnFiltered ? prev : { count, columnFiltered },
    )
  }, [])

  // The loaded result the lenses count: none before a search, and none while a failed search
  // shows its error instead of the grid.
  const loaded = useMemo<LoadedResult | null>(
    () => (rows && limit !== null && !error ? { rows, limit } : null),
    [rows, limit, error],
  )
  const counts = useMemo(() => lensCounts(loaded), [loaded])

  const toggleInspector = useCallback(() => setInspector((prefs) => ({ ...prefs, open: !prefs.open })), [])

  /**
   * Search runs the draft as it stands in the store, so an Enter in a token popover runs the
   * value just typed. The relative Date resolves against the clock here, and nowhere earlier.
   */
  const runSearch = ({ supersede = false } = {}) => {
    if (search.isPending && !supersede) return
    const query = useDeliverySearch.getState().draft
    search.mutate({ seq: ++latestSearch.current, query, criteria: toFilterCriteria(query, new Date()) })
  }
  const hasRows = (rows?.length ?? 0) > 0

  /** The grid, if one is mounted: a failed search unmounts it and leaves its API destroyed. */
  const liveGrid = () => (gridApi && !gridApi.isDestroyed() ? gridApi : null)

  /**
   * A view's layout onto the grid: reset first, so a column the view does not name takes the
   * grid's default. With no grid mounted (before a search) the layout waits for the grid that
   * the search mounts.
   */
  const applyLayout = (view: SavedView) => {
    const store = useDeliverySearch.getState()
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
    // A grid the view's search mounts — or re-mounts after a failed search — starts from it too.
    restore.current = { ...restore.current, ...layout }
  }

  /**
   * Applying a view runs its search (366). A layout-only view (imported) sets the layout, leaves
   * the criteria and the lens alone and runs nothing.
   */
  const applyView = (view: SavedView) => {
    const store = useDeliverySearch.getState()
    store.setActiveView(view.id)
    applyLayout(view)
    if (view.query === null) return
    store.setDraft(view.query)
    store.setLens(view.lens)
    runSearch({ supersede: true })
  }

  /** What a view captures: the criteria on screen, the lens, and the grid's layout and filters. */
  const snapshot = (): ViewSnapshot => {
    const store = useDeliverySearch.getState()
    const api = liveGrid()
    return {
      query: store.draft,
      lens: store.lens,
      columnState: api ? api.getColumnState() : store.columnState,
      filterModel: api ? api.getFilterModel() : store.filterModel,
    }
  }

  /** The name dialog's submit: a new view (Save current view, Save as new…) or a rename. */
  const submitViewName = (name: string): NameRefusal | null => {
    if (!viewDialog) return null
    const result =
      viewDialog.kind === 'save'
        ? saveView(viewStore, name, snapshot(), newViewId())
        : renameView(viewStore, viewDialog.view.id, name)
    if (!result.ok) return result.refusal
    commitViews(result.store)
    setViewDialog(null)
    if (viewDialog.kind === 'save') {
      // The new view is what the page holds, so it is the active one, with nothing drifted.
      useDeliverySearch.getState().setActiveView(result.view.id)
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
        // No confirm dialog: Undo from the toast puts it back where it was (366).
        const { store, removed } = deleteView(viewStore, view.id)
        if (!removed) return
        const wasActive = useDeliverySearch.getState().activeViewId === view.id
        commitViews(store)
        if (wasActive) useDeliverySearch.getState().setActiveView(null)
        toast.info(t('views.deleted.title'), {
          description: t('views.deleted.detail', { name: fsi(view.name) }),
          action: {
            label: t('views.deleted.undo'),
            onClick: () => {
              const views = useSavedViews.getState()
              views.commit(restoreView(views.store, removed))
              const search = useDeliverySearch.getState()
              if (wasActive && search.activeViewId === null) search.setActiveView(view.id)
            },
          },
        })
        return
      }
    }
  }

  // The starred default applies and runs on open: once per mount, and only when there is no
  // in-memory search (L5). It waits for the grant and for this user's views. `applyView` is this
  // render's; the guard runs the body once.
  const defaultTried = useRef(false)
  useEffect(() => {
    if (defaultTried.current || !canOpenList || !userId || viewsLoadedFor !== userId) return
    defaultTried.current = true
    const view = defaultView(viewStore)
    if (view && opensOnDefault(useDeliverySearch.getState())) applyView(view)
  }, [canOpenList, userId, viewsLoadedFor, viewStore])

  // J/K are hidden navigation commands (they repeat while held); `I` is a palette row too.
  // None of them reads the server. A denied session registers nothing.
  useCommands(
    canOpenList
      ? [
          {
            id: 'row.next',
            label: 'deliveries:inspector.nextRow',
            keys: NEXT_ROW_KEYS,
            hidden: true,
            run: gridApi && hasRows ? () => stepRow(gridApi, 1) : null,
            reason: 'deliveries:inspector.noRows',
          },
          {
            id: 'row.previous',
            label: 'deliveries:inspector.previousRow',
            keys: PREVIOUS_ROW_KEYS,
            hidden: true,
            run: gridApi && hasRows ? () => stepRow(gridApi, -1) : null,
            reason: 'deliveries:inspector.noRows',
          },
          // `/` focuses the query bar (365 §5); the key layer prevents the press, so Firefox's
          // quick-find stays shut.
          {
            id: 'query.focus',
            label: 'deliveries:query.focus',
            icon: Search,
            keys: QUERY_FOCUS_KEYS,
            run: () => addFilterRef.current?.focus(),
          },
          {
            id: 'inspector.toggle',
            label: inspector.open ? 'deliveries:inspector.hide' : 'deliveries:inspector.show',
            keys: INSPECTOR_KEYS,
            run: toggleInspector,
          },
          // "Show: ‹lens›" rows in This screen, with no key (368 §2). A lens never searches.
          ...LENS_IDS.map((id) => ({
            id: `lens.${id}`,
            label: `deliveries:lens.show.${id}`,
            icon: LENS_ICON[id],
            run: () => setLens(id),
          })),
          // "Apply view: ‹name›" for each saved view, with no key (368 §2). It runs its search.
          ...viewStore.views.map((view) => ({
            id: `view.${view.id}`,
            label: 'deliveries:views.applyRow',
            detail: view.name,
            icon: Bookmark,
            run: () => applyView(view),
          })),
        ]
      : [],
  )

  // ----- access states ------------------------------------------------------
  // After every hook, before any render: a denied session never reaches the filter
  // panel, so no DeliveryDocumentList request can be fired from here.
  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('access.checking')}
      </div>
    )
  }
  if (!canOpenList) {
    // The screen is hidden either way — the probe fails closed. But WHICH copy shows
    // matters to whoever reads it: an unreachable probe is a server fault, and telling a
    // fully entitled operator to ask for a grant they already hold sends support chasing
    // the wrong thing.
    const unreachable = access.isError
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
        data-oms-denied="list"
      >
        <div className="text-base font-semibold tracking-tight">
          {t(unreachable ? 'access.unavailableTitle' : 'access.deniedTitle')}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable ? apiErrorMessage(access.error, t('access.unavailableHint')) : t('access.deniedHint')}
        </p>
      </div>
    )
  }

  const showResults = rows !== null && !error
  const pill = rowPill(loaded, lens, { displayed: displayed.count, columnFiltered: displayed.columnFiltered })
  const lensEmpty = lensIsEmpty(loaded, lens)

  return (
    <div className="flex">
      <ViewsRail
        lens={lens}
        counts={counts}
        onLens={setLens}
        // Flush with the screen's inline-start and bottom edges, under the 44px top bar. Sticky
        // makes it a stacking context, so it rises over the grid (and stays under the top bar's
        // z-30) for its ⋯ menu to open over the centre column.
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
          addRef={addFilterRef}
          onDraft={setDraft}
          onSearch={() => runSearch()}
        />

        <div className="flex flex-wrap items-center gap-3">
          {activeView ? (
            // The active view's name and its modified dot (L9).
            <h1 className="flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight" data-active-view="">
              <bdi className="truncate">{activeView.name}</bdi>
              {modified && <ModifiedDot />}
            </h1>
          ) : (
            <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
          )}
          {pill && (
            <RowSummary
              pill={pill}
              cut={isCut(loaded)}
              limit={loaded?.limit ?? null}
              onClearFilters={() => gridApi?.setFilterModel(null)}
            />
          )}
          <div className="flex-1" />
          {search.isPending && (
            <span role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('search.searching')}
            </span>
          )}
          {showResults && (
            <GridToolbar gridApi={gridApi} selectedRow={selectedRow} hasRows={hasRows} />
          )}
          <InspectorToggle open={inspector.open} onToggle={toggleInspector} />
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="font-medium">{t('search.failed.title')}</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : rows === null ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 p-10 text-sm text-muted-foreground">
            <Search className="h-5 w-5" aria-hidden />
            <p>{t('emptyPrompt')}</p>
          </div>
        ) : (
          // Prior rows stay visible while a re-search runs — the grid is not torn down.
          <div className="relative h-[calc(100vh-16rem)] min-h-96">
            <AgGridReact<DeliveryDocumentModel>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={DELIVERY_DEFAULT_COL_DEF}
              rowSelection={DELIVERY_ROW_SELECTION}
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
              // The lens's own empty state stands in for the grid's "no matching rows".
              suppressOverlays={lensEmpty ? ['noMatchingRows'] : undefined}
            />
            {lensEmpty && (
              // Over the grid, which stays mounted under it (368 §1).
              <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-4">
                <p
                  className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
                  data-lens-empty=""
                >
                  {t('lens.empty')}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {inspector.open && (
        <DeliveryInspector
          row={selectedRow}
          width={inspector.width}
          onWidth={(width) => setInspector((prefs) => ({ ...prefs, width }))}
          onCollapse={toggleInspector}
          onOpen={(to) => navigate(to)}
          // Flush with the screen's inline-end and bottom edges, under the 44px top bar.
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

/** The remembered pane, read defensively (367 §4): anything malformed reads as 360, open. */
function readInspectorPrefs(): InspectorPrefs {
  try {
    return parseInspectorPrefs(localStorage.getItem(INSPECTOR_PREFS_KEY))
  } catch {
    return parseInspectorPrefs(null)
  }
}

/**
 * J (`+1`) / K (`-1`): move the one current row, as ↓/↑ do in the grid, from anywhere on the
 * screen. The focused cell moves with it, so selection and focus stay one row.
 */
function stepRow(api: GridApi<DeliveryDocumentModel>, delta: 1 | -1) {
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
