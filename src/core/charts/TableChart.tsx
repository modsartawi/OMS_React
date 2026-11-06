import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { fsi } from '@/core/util/bidi'
import CellBar from './CellBar'
import { formatValue } from './format'
import { tableLayout } from './table-layout'
import type { MeasureUnit } from '@/core/models/analytics'

/**
 * The table form — any measures × 1–3 dimensions, with cell bars on the numeric columns (ticket 769).
 *
 * AG Grid, spreading the core grid base (`npm run lint`'s grid gate): a dimension cell keeps the base's
 * `BdiCell`; a measure cell takes `CellBar`, which isolates its own whole value. The sort and top N are
 * the view model's (`toTableView`); the sorted column shows its arrow and a reader may re-sort.
 * The grid is direction-aware by the app's global options, so it mirrors under Arabic on its own.
 * A long table keeps row virtualisation: it scrolls in a fixed viewport instead of growing (./table-layout).
 */
export interface TableChartColumn {
  key: string
  role: 'dimension' | 'measure'
  label: string
  unit?: MeasureUnit
  max?: number
}

type Row = Record<string, string | number | null>

const TABLE_DEFAULT_COL_DEF: ColDef<Row> = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true }

export default function TableChart({
  columns,
  rows,
  sort,
  locale,
  ariaLabel,
  onRow,
  selectedRow,
}: {
  columns: readonly TableChartColumn[]
  rows: readonly Row[]
  sort: { key: string; direction: 'asc' | 'desc' } | null
  locale: string
  ariaLabel: string
  /** A click on a row (772's cross-filter): the row's index in `rows`. Absent → rows are not clickable. */
  onRow?: (index: number) => void
  /** The row a cross-filter was clicked on here (`rows` index): marked `data-selected` and highlighted. */
  selectedRow?: number | null
}) {
  const columnDefs = useMemo<ColDef<Row>[]>(
    () =>
      columns.map((c) => {
        // An AG Grid header name is a string-only sink: isolate the whole label (bidi rule).
        const base: ColDef<Row> = { colId: c.key, field: c.key, headerName: fsi(c.label), sort: sort?.key === c.key ? sort.direction : null }
        if (c.role === 'dimension') return { ...base, flex: 1, minWidth: 140 }
        const unit = c.unit ?? 'count'
        return {
          ...base,
          flex: 1,
          minWidth: 140,
          valueFormatter: (p) => formatValue(typeof p.value === 'number' ? p.value : null, unit, locale),
          cellRenderer: CellBar,
          cellRendererParams: { max: c.max ?? 0 },
        }
      }),
    [columns, sort, locale],
  )
  // A long table scrolls inside a fixed viewport, so AG Grid renders only the rows in sight (./table-layout).
  const layout = tableLayout(rows.length, OMS_GRID_ROW_HEIGHT, OMS_GRID_HEADER_HEIGHT)
  return (
    <div
      className="overflow-hidden rounded-md border border-border/60"
      data-chart="table"
      data-table-layout={layout.kind}
      role="figure"
      aria-label={ariaLabel}
      style={layout.kind === 'fixed' ? { height: layout.heightPx } : undefined}
    >
      <AgGridReact<Row>
        theme={omsGridTheme}
        rowData={rows as Row[]}
        columnDefs={columnDefs}
        defaultColDef={TABLE_DEFAULT_COL_DEF}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        domLayout={layout.kind === 'auto' ? 'autoHeight' : 'normal'}
        animateRows={false}
        suppressColumnVirtualisation
        onRowClicked={onRow ? (e) => typeof e.data === 'object' && onRow(rows.indexOf(e.data as Row)) : undefined}
        rowClassRules={{ 'cursor-pointer': () => !!onRow, 'bg-accent': (p) => selectedRow != null && p.data === rows[selectedRow] }}
      />
    </div>
  )
}
