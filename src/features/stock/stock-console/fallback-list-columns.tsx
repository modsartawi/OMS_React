import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleExpiryFallbackRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import { formatDay } from '@/core/util/date-format'
import { localizedName } from '@/core/util/localized-name'
import { MONO, figureColumn, formatTime } from './columns'
import { itemHref } from './console-pages'

type Cell = ICellRendererParams<StockConsoleExpiryFallbackRow>

/** One material, vendor batch and batch chosen per row. Module-level, as AG Grid wants. */
export const fallbackRowId = (row: StockConsoleExpiryFallbackRow) => `${row.item}|${row.vendorBatch}|${row.batch}`

/**
 * Inventory control's list's columns (BackOffice 4277): the item (opening it at the store), its name, the pack's own vendor
 * batch, the batch the fallback chose and its expiry, the takes and the units, and the first and last take. Codes are
 * exported as text.
 */
export function buildFallbackListColumns(
  t: TFunction,
  language: string,
  store: string,
): ColDef<StockConsoleExpiryFallbackRow>[] {
  return [
    {
      headerName: t('fallback.column.item'),
      colId: 'item',
      field: 'item',
      width: 110,
      cellClass: MONO,
      cellRenderer: (p: Cell) =>
        p.data ? (
          <Link to={itemHref(store, p.data.item)} className="font-medium text-primary underline-offset-2 hover:underline">
            <Ltr>{p.data.item}</Ltr>
          </Link>
        ) : null,
    },
    {
      // Free text in either script: the base cell isolates it as `<bdi>`.
      headerName: t('fallback.column.name'),
      colId: 'name',
      width: 220,
      valueGetter: (p) => (p.data ? localizedName({ nameEn: p.data.nameEn, nameAr: p.data.nameAr }, language) : ''),
    },
    { headerName: t('fallback.column.vendorBatch'), colId: 'vendorBatch', field: 'vendorBatch', width: 140, cellClass: MONO, cellRenderer: LtrCell },
    { headerName: t('fallback.column.batch'), colId: 'batch', field: 'batch', width: 130, cellClass: MONO, cellRenderer: LtrCell },
    {
      headerName: t('fallback.column.expiryDate'),
      colId: 'expiryDate',
      width: 110,
      valueGetter: (p) => formatDay(p.data?.expiryDate),
      cellRenderer: LtrCell,
    },
    { ...figureColumn<StockConsoleExpiryFallbackRow>(t('fallback.column.takes'), 'takes', 80), colId: 'takes' },
    { ...figureColumn<StockConsoleExpiryFallbackRow>(t('fallback.column.quantity'), 'quantity', 90), colId: 'quantity' },
    { headerName: t('fallback.column.firstTakenAt'), colId: 'firstTakenAt', field: 'firstTakenAt', width: 140, valueFormatter: formatTime, cellRenderer: LtrCell },
    { headerName: t('fallback.column.lastTakenAt'), colId: 'lastTakenAt', field: 'lastTakenAt', width: 140, valueFormatter: formatTime, cellRenderer: LtrCell },
  ]
}
