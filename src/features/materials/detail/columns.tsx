import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { MaterialBarcode, MaterialBatch, MaterialStockCell } from '@/core/models/materials'
import { pinStart } from '@/core/theme/direction'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'

// The detail's three grids (ticket 452, spec 2544 stories 18–20). Every plain cell is isolated by
// the core grid base (`<bdi>`, dir auto), so a negative quantity keeps its sign at its start under
// RTL and a store name reads in its own script.

const CODE = 'font-mono text-[12px]'

/** Identities each export writes as text, so Excel never totals one or strips its leading zeros. */
export const EXPORT_AS_TEXT: ReadonlySet<string> = new Set(['barcode', 'batch', 'vendorBatch', 'storeCode'])

/** A number as the machine value it is: signed, no grouping. */
const quantity = ({ value }: { value: number | null | undefined }) => formatNumber(value)

/** Barcodes: barcode, UoM, quantity and the main flag. */
export function barcodeColumns(t: TFunction): ColDef<MaterialBarcode>[] {
  return [
    { field: 'barcode', headerName: t('barcodes.columns.barcode'), width: 180, pinned: pinStart, cellClass: CODE },
    { field: 'uom', headerName: t('barcodes.columns.uom'), width: 90, cellClass: CODE },
    { field: 'quantity', headerName: t('barcodes.columns.quantity'), width: 110, type: 'numericColumn', cellClass: 'text-end tabular-nums', valueFormatter: quantity },
    {
      field: 'isMain',
      headerName: t('barcodes.columns.isMain'),
      width: 110,
      valueFormatter: ({ value }: ValueFormatterParams<MaterialBarcode, boolean>) => (value === true ? t('barcodes.main') : ''),
      cellRenderer: ({ data }: ICellRendererParams<MaterialBarcode>) =>
        data?.isMain ? <StatusBadge sev="ok">{t('barcodes.main')}</StatusBadge> : null,
    },
  ]
}

/** Batches: SAP batch, vendor batch and expiry (a date-only value, shown as sent). */
export function batchColumns(t: TFunction): ColDef<MaterialBatch>[] {
  return [
    { field: 'batch', headerName: t('batches.columns.batch'), width: 150, pinned: pinStart, cellClass: CODE },
    { field: 'vendorBatch', headerName: t('batches.columns.vendorBatch'), width: 150, cellClass: CODE },
    { field: 'expiry', headerName: t('batches.columns.expiry'), width: 120, cellClass: 'tabular-nums' },
  ]
}

/** Stock: store, ATP, SAP unrestricted, POS, OMS and last updated. The rows arrive in their order
 *  (highest ATP first, `detailStockRows`); no column sort is set, so there is one source of it. */
export function detailStockColumns(t: TFunction): ColDef<MaterialStockCell>[] {
  const qty = (field: 'atp' | 'sapUnrestricted' | 'pos' | 'oms', width: number): ColDef<MaterialStockCell> => ({
    field,
    headerName: t(`stock.columns.${field}`),
    width,
    type: 'numericColumn',
    cellClass: 'text-end tabular-nums',
    valueFormatter: quantity,
  })
  return [
    { field: 'storeCode', headerName: t('stock.columns.storeCode'), width: 100, pinned: pinStart, cellClass: CODE },
    { field: 'storeName', headerName: t('stock.columns.storeName'), width: 240, tooltipField: 'storeName' },
    qty('atp', 100),
    qty('sapUnrestricted', 140),
    qty('pos', 90),
    qty('oms', 90),
    {
      field: 'updatedAt',
      headerName: t('stock.columns.updatedAt'),
      width: 160,
      cellClass: 'tabular-nums',
      // Local wall-clock with no offset, shown as sent: never a `Z` appended, never shifted.
      valueFormatter: ({ value }: ValueFormatterParams<MaterialStockCell, string | null>) => formatDateTime(value),
    },
  ]
}
