import type { ColDef } from 'ag-grid-community'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'

/** A table form row: a column key to its cell. */
export type TableRow = Record<string, string | number | null>

/**
 * The table form's default column (ticket 769): the core grid base, every column sortable and resizable — a reader
 * re-sorts by a header click, whatever order the rows arrived in (868: the copilot's answer tables arrive as sent).
 */
export const TABLE_DEFAULT_COL_DEF: ColDef<TableRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true }
