import { useMemo } from 'react'
import type { ColDef, GetRowIdParams } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { CONSOLE_COL_DEF } from './columns'

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
}: {
  rows: T[]
  columns: ColDef<T>[]
  rowId: (row: T) => string
  /** The `data-list-grid` hook a drive finds it by. */
  name: string
}) {
  const getRowId = useMemo(() => ({ data: row }: GetRowIdParams<T>) => rowId(row), [rowId])
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
      />
    </div>
  )
}
