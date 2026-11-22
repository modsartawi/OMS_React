import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleFindBatchRow, StockConsoleFindItemRow, StockConsoleScan } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import type { LocalDate } from '@/core/util/date-window'
import { localizedName } from '@/core/util/localized-name'
import { ExpiryCell, scanMarkColumn } from './batches-columns'
import { MONO, figureColumn } from './columns'
import { rowKey } from './row-ids'
import { findRowHref, itemStoresParams } from './find'
import { scanExpiry } from './scan'
import type { SearchState } from './search'

type BatchCell = ICellRendererParams<StockConsoleFindBatchRow>
type ItemCell = ICellRendererParams<StockConsoleFindItemRow>

/** One store, item and batch per row. Module-level, as AG Grid wants. */
export const findBatchRowId = (row: StockConsoleFindBatchRow) => rowKey(row.plant, row.item, row.batch)
/** One item per row. */
export const findItemRowId = (row: StockConsoleFindItemRow) => row.item

const LINK = 'font-medium text-primary underline-offset-2 hover:underline'

const figure = figureColumn<StockConsoleFindBatchRow>
/**
 * Find's batch answer (oms 943, spec 4157 stories 63–65): store, city, item, name, our batch, vendor batch, expiry (with
 * its marks; after a scan with an expiry, whether each is the scan's), SAP stock, till-side, held. The store and the item
 * each open the item at that store.
 */
export function buildFindBatchColumns(
  t: TFunction,
  language: string,
  today: LocalDate,
  scan: StockConsoleScan | null,
): ColDef<StockConsoleFindBatchRow>[] {
  const link = (key: 'plant' | 'item') => (p: BatchCell) =>
    p.data ? (
      <Link to={findRowHref(p.data)} className={LINK} data-find-link={findRowHref(p.data)}>
        <Ltr>{p.data[key]}</Ltr>
      </Link>
    ) : null
  const columns: ColDef<StockConsoleFindBatchRow>[] = [
    { headerName: t('column.store'), field: 'plant', width: 100, cellClass: MONO, cellRenderer: link('plant') },
    // Free text in either script: the base cell isolates it as `<bdi>`.
    { headerName: t('column.city'), field: 'city', width: 130 },
    { headerName: t('batches.column.item'), field: 'item', width: 100, cellClass: MONO, cellRenderer: link('item') },
    {
      headerName: t('batches.column.name'),
      colId: 'name',
      width: 200,
      valueGetter: (p) => (p.data ? localizedName(p.data, language) : ''),
    },
    { headerName: t('batches.column.batch'), field: 'batch', width: 120, cellClass: MONO, cellRenderer: LtrCell },
    { headerName: t('batches.column.vendorBatch'), field: 'vendorBatch', width: 130, cellClass: MONO, cellRenderer: LtrCell },
    {
      headerName: t('batches.column.expiry'),
      field: 'expiry',
      width: 190,
      cellRenderer: (p: BatchCell) => (p.data ? <ExpiryCell row={p.data} today={today} t={t} /> : null),
    },
    figure(t('column.sapStock'), 'sapStock'),
    figure(t('column.tillStock'), 'tillStock', 130),
    figure(t('column.held'), 'held', 90),
  ]
  if (!scan || !scanExpiry(scan)) return columns
  const at = columns.findIndex((c) => c.field === 'expiry') + 1
  return [...columns.slice(0, at), scanMarkColumn<StockConsoleFindBatchRow>(t, scan), ...columns.slice(at)]
}

/**
 * Find's items answer (story 62): number and name. An item has no store yet, so it opens its Other stores view on Find
 * (`itemStoresParams`: the address keeps the search and names the item).
 */
export function buildFindItemColumns(t: TFunction, language: string, state: SearchState): ColDef<StockConsoleFindItemRow>[] {
  return [
    {
      headerName: t('items.column.item'),
      field: 'item',
      width: 120,
      cellClass: MONO,
      cellRenderer: (p: ItemCell) =>
        p.data ? (
          <Link
            to={{ search: `?${itemStoresParams(state, p.data.item).toString()}` }}
            title={t('find.openStores')}
            className={LINK}
            data-find-item={p.data.item}
          >
            <Ltr>{p.data.item}</Ltr>
          </Link>
        ) : null,
    },
    {
      headerName: t('items.column.name'),
      colId: 'name',
      width: 320,
      valueGetter: (p) => (p.data ? localizedName(p.data, language) : ''),
    },
  ]
}
