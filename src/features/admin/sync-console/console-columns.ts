import type { ColDef, ValueFormatterParams } from 'ag-grid-community'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { formatDateTime } from '@/core/util/date-format'

/**
 * What every console grid shares (tickets 445, 446). Sorting and paging are the
 * door's, so no column is client-sortable or filterable: a sort over one page of 50
 * would reorder a page, not the list.
 */
export const CONSOLE_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/** A machine code's cell: monospaced, a size under the body text. */
export const MONO = 'font-mono text-[12px]'

/** A server time as drawn — local wall-clock, formatted, never shifted; `null` is blank. */
export const formatTime = (p: ValueFormatterParams) => formatDateTime(p.value as string | null)
