import type { ColDef } from 'ag-grid-community'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { fsi } from '@/core/util/bidi'
import CellBar from './CellBar'
import { formatValue } from './format'
import type { TableChartColumn } from './TableChart'

/** A table form row: a column key to its cell. */
export type TableRow = Record<string, string | number | null>

/**
 * The table form's default column (ticket 769): the core grid base, every column sortable and resizable — a reader
 * re-sorts by a header click, whatever order the rows arrived in (868: the copilot's answer tables arrive as sent).
 */
export const TABLE_DEFAULT_COL_DEF: ColDef<TableRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true }

/**
 * The number a sent text holds (878): its first figure, with its sign — `"62.0%"` 62, `"-620"` -620, `"1,204.5"` 1204.5.
 * `null` when it holds none. Only for ordering the texts of one column (they share a unit); what is SHOWN stays the text.
 */
export function sentFigure(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const m = /[-+−]?\d[\d,]*(?:\.\d+)?/.exec(value.replace(/\s+/g, ''))
  if (!m) return null
  const n = Number(m[0].replace(/,/g, '').replace('−', '-'))
  return Number.isFinite(n) ? n : null
}

/**
 * The grid's comparator on a column of sent texts (878): by the number each holds, so `"9.5%"` sorts below `"62.0%"`
 * and `"-620"` below `"-70"` — as text they would not. A cell with no figure sorts below every figure, where the grid
 * puts an ordinary column's empty cell.
 */
export function compareSentFigures(a: unknown, b: unknown): number {
  const x = sentFigure(a)
  const y = sentFigure(b)
  if (x == null || y == null) return x == null ? (y == null ? 0 : -1) : 1
  return x - y
}

/**
 * The table form's grid columns (ticket 769; out of `./TableChart` in 878 so they are proven without a DOM). A dimension
 * cell keeps the base's `BdiCell`. A measure cell takes `CellBar` over its number, formatted by its unit. A measure
 * column `asSent` holds the server's texts: no formatter (the cell shows the text itself, isolated by `CellBar`, with no
 * bar) and {@link compareSentFigures}, so a header click still sorts it by number.
 */
export function tableColumnDefs(
  columns: readonly TableChartColumn[],
  sort: { key: string; direction: 'asc' | 'desc' } | null,
  locale: string,
): ColDef<TableRow>[] {
  return columns.map((c) => {
    // An AG Grid header name is a string-only sink: isolate the whole label (bidi rule).
    const base: ColDef<TableRow> = {
      colId: c.key,
      field: c.key,
      headerName: fsi(c.label),
      // A tooltip is a string-only sink too: the whole text isolated.
      ...(c.tooltip ? { headerTooltip: fsi(c.tooltip) } : {}),
      sort: sort?.key === c.key ? sort.direction : null,
    }
    if (c.role === 'dimension') return { ...base, flex: 1, minWidth: 140 }
    if (c.asSent) return { ...base, flex: 1, minWidth: 140, comparator: compareSentFigures, cellRenderer: CellBar, cellRendererParams: { max: 0 } }
    const unit = c.unit ?? 'count'
    return {
      ...base,
      flex: 1,
      minWidth: 140,
      valueFormatter: (p) => formatValue(typeof p.value === 'number' ? p.value : null, unit, locale),
      cellRenderer: CellBar,
      cellRendererParams: { max: c.max ?? 0 },
    }
  })
}
