import { useMemo } from 'react'
import type { ColDef, GetRowIdParams, RowClassRules, RowSelectionOptions } from 'ag-grid-community'
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react'

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
  rowClassRules,
  rowSelection,
  selectionProps,
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
  /**
   * Classes a row takes while a rule holds (the Mirror tab mutes an acknowledged dead
   * letter). Rules, not `getRowClass`: AG Grid re-applies them both ways when a kept
   * row's data changes, where a `getRowClass` class is only ever added. Module-level.
   */
  rowClassRules?: RowClassRules<T>
  /** A selectable list's checkboxes (the Mirror tab's dead letters, 458); omitted, no checkbox column. Module-level. */
  rowSelection?: RowSelectionOptions<T>
  /** `useCappedSelection`'s `gridProps`, spread on the grid beside `rowSelection`. */
  selectionProps?: Pick<AgGridReactProps<T>, 'onGridReady' | 'onGridPreDestroyed' | 'onRowDataUpdated' | 'onSelectionChanged'>
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
        rowClassRules={rowClassRules}
        rowSelection={rowSelection}
        {...selectionProps}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        domLayout="autoHeight"
        animateRows={false}
        suppressColumnVirtualisation
      />
    </div>
  )
}
