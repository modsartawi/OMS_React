import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import type {
  CellFocusedEvent,
  CellKeyDownEvent,
  FirstDataRenderedEvent,
  FullWidthCellKeyDownEvent,
  GridApi,
  GridReadyEvent,
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
import { deliveriesApi } from './api'
import { buildDeliveryColumns, DELIVERY_DEFAULT_COL_DEF, DELIVERY_ROW_SELECTION } from './columns'
import DeliveryInspector from './DeliveryInspector'
import type { DeliveryFilterCriteria } from './filter'
import FilterPanel from './FilterPanel'
import GridToolbar, { InspectorToggle } from './GridToolbar'
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
import { deliveryRowKey, useDeliverySearch } from './search-store'

/**
 * Screen 1 — Delivery Documents Inquiry.
 *
 * Hosts the filter panel, the results toolbar and the AG Grid results grid: the
 * panel emits the criteria, this component runs `DeliveryDocumentList` and feeds
 * the rows in. Loading, empty and error states are explicit.
 *
 * The search state (criteria, rows, working grid layout, selected row) lives in
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
 */
export default function DeliveriesPage() {
  const { t } = useTranslation('deliveries')
  const navigate = useNavigate()

  const rows = useDeliverySearch((s) => s.rows)
  const error = useDeliverySearch((s) => s.error)
  const savedCriteria = useDeliverySearch((s) => s.criteria)

  const [gridApi, setGridApi] = useState<GridApi<DeliveryDocumentModel> | null>(null)
  const [selectedRow, setSelectedRow] = useState<DeliveryDocumentModel | null>(null)
  const [inspector, setInspector] = useState<InspectorPrefs>(readInspectorPrefs)

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

  const search = useMutation({
    mutationFn: deliveriesApi.search,
    onMutate: (criteria: DeliveryFilterCriteria) => {
      // The grid's selection goes with the page's, so a failed re-search (old rows kept on
      // screen) never shows a highlighted row beside an empty inspector.
      gridApi?.deselectAll()
      setSelectedRow(null)
      useDeliverySearch.getState().beginSearch(criteria)
    },
    onSuccess: (result) => {
      // No success toast. The outcome of a search is the most visible thing on
      // the screen — the grid repaints and the hit count updates — so announcing
      // it says only what the operator just watched happen. Failures still toast:
      // that IS invisible (the grid keeps showing stale rows).
      useDeliverySearch.getState().setResult(result)
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, t('search.unexpected'))
      useDeliverySearch.getState().setError(message)
      toast.error(t('search.failed.title'), { description: message })
    },
  })

  /** Capture the grid API and rehydrate the layout worked before the drill-down. */
  const onGridReady = useCallback((event: GridReadyEvent<DeliveryDocumentModel>) => {
    setGridApi(event.api)
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

  const toggleInspector = useCallback(() => setInspector((prefs) => ({ ...prefs, open: !prefs.open })), [])
  const hasRows = (rows?.length ?? 0) > 0

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
          {
            id: 'inspector.toggle',
            label: inspector.open ? 'deliveries:inspector.hide' : 'deliveries:inspector.show',
            keys: INSPECTOR_KEYS,
            run: toggleInspector,
          },
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

  /** Hit Count is the raw result length, NOT the post-filter count. */
  const hitCount = rows?.length ?? 0
  const showResults = rows !== null && !error

  return (
    <div className="flex">
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <FilterPanel
          loading={search.isPending}
          initialCriteria={savedCriteria}
          onSearch={(criteria) => search.mutate(criteria)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
          {showResults && (
            <GridToolbar gridApi={gridApi} selectedRow={selectedRow} hasRows={hitCount > 0} />
          )}
          <div className="flex-1" />
          {search.isPending && (
            <span role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('search.searching')}
            </span>
          )}
          {showResults && (
            <span className="text-sm text-muted-foreground">{t('hitCount', { count: hitCount })}</span>
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
          <div className="h-[calc(100vh-16rem)] min-h-96">
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
            />
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
