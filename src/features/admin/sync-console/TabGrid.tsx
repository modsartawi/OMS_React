import { useMemo } from 'react'
import type { ColDef, GetRowIdParams } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { STORE_DEFAULT_COL_DEF } from './store-columns'
import Loading from './Loading'

/**
 * A store tab's list (ticket 446): loading, its error, its empty sentence, or a grid
 * sized to its rows. The tabs whose door does not page (Counters, Scripts, a pass's
 * detail) draw through this; Passes adds its own pager around the same grid.
 */
export default function TabGrid<T>({
  rows,
  columns,
  rowId,
  pending,
  error,
  failed,
  empty,
  loading,
  data,
}: {
  rows: T[] | undefined
  columns: ColDef<T>[]
  /**
   * A stable id per row, when the door gives one; omitted, AG Grid numbers the rows.
   * Pass a module-level function: AG Grid reads `getRowId` once, so it must not change.
   */
  rowId?: (row: T) => string
  pending: boolean
  error: unknown
  /** The fallback sentence for a failed read. */
  failed: string
  /** The sentence for an answered read with no rows. */
  empty: string
  loading: string
  /** The `data-*` hook a drive finds the list by. */
  data: string
}) {
  const getRowId = useMemo(() => (rowId ? ({ data: row }: GetRowIdParams<T>) => rowId(row) : undefined), [rowId])
  if (pending) return <Loading label={loading} />
  if (error) return <ErrorBanner className="p-3" message={apiErrorMessage(error, failed)} />
  if (!rows || rows.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-tab-empty={data}>
        {empty}
      </p>
    )
  return (
    <div className="overflow-hidden rounded-md border border-border/60" data-tab-grid={data}>
      <AgGridReact<T>
        theme={omsGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={STORE_DEFAULT_COL_DEF}
        getRowId={getRowId}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        domLayout="autoHeight"
        animateRows={false}
        suppressColumnVirtualisation
      />
    </div>
  )
}
