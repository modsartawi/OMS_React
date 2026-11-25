import { useMemo, useRef } from 'react'
import type { ColDef, GetRowIdParams, GridApi } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { CONSOLE_COL_DEF } from './columns'
import { gridRowIds } from './row-ids'

/**
 * One page of a searched list (oms 941): at most 25 rows, so the grid is sized to its rows and never scrolls inside.
 * On the console's column base (`CONSOLE_COL_DEF`, which spreads the grid base). `rowId` must be module-level: AG Grid
 * reads it once.
 */
export default function ListGrid<T>({
  rows,
  columns,
  rowId,
  name,
  onApi,
}: {
  rows: T[]
  columns: ColDef<T>[]
  rowId: (row: T) => string
  /** The `data-list-grid` hook a drive finds it by. */
  name: string
  /** BackOffice 4277: the grid's api once ready, for a page that exports what it shows. */
  onApi?: (api: GridApi<T>) => void
}) {
  // A blank or repeated key falls back to the row's place (`./row-ids`): AG Grid would drop the row otherwise. The ids
  // are the page's, read through a ref, since AG Grid takes `getRowId` once.
  const ids = useRef<Map<T, string>>(new Map())
  ids.current = useMemo(() => gridRowIds(rows, rowId), [rows, rowId])
  const getRowId = useMemo(() => ({ data: row }: GetRowIdParams<T>) => ids.current.get(row) ?? rowId(row), [rowId])
  return (
    <div className="overflow-hidden rounded-md border border-border/60" data-list-grid={name}>
      <AgGridReact<T>
        theme={omsGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={CONSOLE_COL_DEF}
        getRowId={getRowId}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        domLayout="autoHeight"
        animateRows={false}
        suppressColumnVirtualisation
        onGridReady={onApi ? (e) => onApi(e.api) : undefined}
      />
    </div>
  )
}
