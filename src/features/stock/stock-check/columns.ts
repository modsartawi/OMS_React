import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { MaterialStockCell } from '@/core/models/materials'
import { pinStart } from '@/core/theme/direction'
import { formatDateTime } from '@/core/util/date-format'

type Row = MaterialStockCell

/** Identities the export writes as text, so Excel never totals one or strips its leading zeros. */
export const EXPORT_AS_TEXT: ReadonlySet<string> = new Set(['materialNumber', 'storeCode'])

/** A quantity as the machine value it is: signed (POS and OMS can be negative), no grouping. */
const quantity = ({ value }: ValueFormatterParams<Row, number>) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : ''

/**
 * The stock grid (ticket 453, spec 2544 story 29): one row per material × store — material, store,
 * store name, ATP, SAP unrestricted, POS, OMS and when the figure was last updated.
 *
 * Every plain cell is isolated by the core grid base (`<bdi>`, dir auto), so a negative `-2` keeps
 * its sign at its start under RTL and the store name reads in its own script. Every column sorts;
 * the grid opens sorted by material, then ATP descending — the door's own order.
 */
export function stockColumns(t: TFunction): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  const qty = (field: 'atp' | 'sapUnrestricted' | 'pos' | 'oms', width: number): ColDef<Row> => ({
    field,
    headerName: t(`columns.${field}`),
    width,
    type: 'numericColumn',
    cellClass: 'text-end tabular-nums',
    valueFormatter: quantity,
  })

  return [
    { field: 'materialNumber', headerName: t('columns.materialNumber'), width: 120, pinned: pinStart, cellClass: code, sort: 'asc', sortIndex: 0 },
    { field: 'storeCode', headerName: t('columns.storeCode'), width: 100, cellClass: code },
    { field: 'storeName', headerName: t('columns.storeName'), width: 240, tooltipField: 'storeName' },
    { ...qty('atp', 100), sort: 'desc', sortIndex: 1 },
    qty('sapUnrestricted', 140),
    qty('pos', 90),
    qty('oms', 90),
    {
      field: 'updatedAt',
      headerName: t('columns.updatedAt'),
      width: 160,
      cellClass: 'tabular-nums',
      // Local wall-clock with no offset, shown as sent: never a `Z` appended, never shifted.
      valueFormatter: ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value),
    },
  ]
}
