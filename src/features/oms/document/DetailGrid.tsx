import { AgGridReact } from 'ag-grid-react'
import { Inbox } from 'lucide-react'
import type { ColDef, RowClassParams, RowSelectionOptions, RowStyle } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { DETAIL_DEFAULT_COL_DEF } from './columns'

/**
 * A read-only grid of the facts column (Items, Pricing conditions), **sized to its
 * rows** (spec 380 D4, ticket 404): `domLayout: 'autoHeight'`, so a one-line document
 * draws one line and the pinned footer, with no empty floor under them (the theme's
 * `autoHeightMinBodyHeight`). A document's lines are a handful, never a scrolling
 * list, so drawing them all costs nothing a virtualised body would save.
 *
 * Its rows arrive on the loaded document, so there is no loading or failure state
 * here; a document with no rows draws its empty line instead of a grid.
 */
export default function DetailGrid<T>({
  columnDefs,
  rowData,
  emptyMessage,
  getRowStyle,
  pinnedBottomRowData,
  rowSelection,
}: {
  columnDefs: ColDef<T>[]
  rowData: T[]
  emptyMessage: string
  getRowStyle?: (params: RowClassParams<T>) => RowStyle | undefined
  /**
   * The totals row pinned under the last row (Items only). Never reached when
   * `rowData` is empty — the empty state renders instead of a grid, and a footer
   * summing nothing has nothing to say.
   */
  pinnedBottomRowData?: T[]
  rowSelection?: RowSelectionOptions<T>
}) {
  if (rowData.length === 0)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-[0.8125rem] text-muted-foreground">
        <Inbox className="h-4 w-4" aria-hidden />
        <span>{emptyMessage}</span>
      </div>
    )

  return (
    <div className="w-full">
      <AgGridReact<T>
        theme={omsGridTheme}
        domLayout="autoHeight"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={DETAIL_DEFAULT_COL_DEF}
        getRowStyle={getRowStyle}
        pinnedBottomRowData={pinnedBottomRowData}
        rowSelection={rowSelection}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        tooltipShowDelay={500}
        animateRows={false}
      />
    </div>
  )
}
