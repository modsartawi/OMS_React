import type { ColDef, ColDefField, ValueFormatterParams } from 'ag-grid-community'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import LtrCell from '@/core/ui/LtrCell'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'

/**
 * What every stock console grid shares (oms 940). No column is sortable or filterable from its header: the Stores list
 * sorts by its own toolbar (one tested sort), and the searched lists (941+) are paged by the server, where a header
 * sort would reorder one page, not the list.
 */
export const CONSOLE_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/** A machine code's cell: monospaced, a size under the body text. */
export const MONO = 'font-mono text-[12px]'

/** A quantity in base units, grouped in Latin digits; an absent one is blank, never 0. */
export const formatQuantity = (p: ValueFormatterParams) => formatFigure(p.value as number | null)

/** A server time as drawn — local wall-clock, formatted, never shifted; `null` is blank. */
export const formatTime = (p: ValueFormatterParams) => formatDateTime(p.value as string | null)

/** A figure column of any console grid: a quantity in base units, isolated left to right, at the end of its cell. */
export const figureColumn = <T>(headerName: string, field: ColDefField<T>, width = 100): ColDef<T> => ({
  headerName,
  field,
  width,
  type: 'numericColumn',
  valueFormatter: formatQuantity,
  cellRenderer: LtrCell,
})
