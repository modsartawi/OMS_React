import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import type {
  FirstDataRenderedEvent,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  StateUpdatedEvent,
} from 'ag-grid-community'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { searchDeliveries } from './api'
import { buildDeliveryColumns, DELIVERY_DEFAULT_COL_DEF, DELIVERY_ROW_SELECTION } from './columns'
import type { DeliveryFilterCriteria } from './filter'
import FilterPanel from './FilterPanel'
import GridToolbar from './GridToolbar'
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
 */
export default function DeliveriesPage() {
  const { t } = useTranslation('deliveries')

  const rows = useDeliverySearch((s) => s.rows)
  const error = useDeliverySearch((s) => s.error)
  const savedCriteria = useDeliverySearch((s) => s.criteria)

  const [gridApi, setGridApi] = useState<GridApi<DeliveryDocumentModel> | null>(null)
  const [selectedRow, setSelectedRow] = useState<DeliveryDocumentModel | null>(null)

  /**
   * The layout + selection to restore on THIS mount, snapshotted before the grid
   * exists and starts emitting its own state events — so the one-time restore
   * cannot race the live capture wired through `onStateUpdated` (R-8).
   */
  const restore = useRef(useDeliverySearch.getState())

  const columns = useMemo(() => buildDeliveryColumns(t), [t])

  const search = useMutation({
    mutationFn: searchDeliveries,
    onMutate: (criteria: DeliveryFilterCriteria) => {
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

  /** Hit Count is the raw result length, NOT the post-filter count. */
  const hitCount = rows?.length ?? 0
  const showResults = rows !== null && !error

  return (
    <section className="flex flex-col gap-3">
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
          />
        </div>
      )}
    </section>
  )
}
