import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleItemRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import { localizedName } from '@/core/util/localized-name'
import { MONO, formatTime, figureColumn } from './columns'
import { itemHref } from './console-pages'
import { FreeCell, ReservedCell } from './figure-cells'

type Cell = ICellRendererParams<StockConsoleItemRow>

/** An item's page at a store (ticket 943) — built in `./console-pages`, so the pure modules link to it too. */
export { itemHref }

/** The Items grid's row id: the item is unique within one store's page. Module-level, as AG Grid wants. */
export const itemRowId = (row: StockConsoleItemRow) => row.item

const figure = figureColumn<StockConsoleItemRow>
/**
 * The Items grid's columns (oms 941), in the prototype's order: number (opens the item's page), name in the reader's
 * language, SAP stock, till-side, gap, held, reserved, free, last update. Paged by the server, so no header sorts.
 */
export function buildItemsColumns(t: TFunction, language: string, store: string): ColDef<StockConsoleItemRow>[] {
  return [
    {
      headerName: t('items.column.item'),
      field: 'item',
      width: 100,
      cellClass: MONO,
      cellRenderer: (p: Cell) =>
        p.data ? (
          <Link
            to={itemHref(store, p.data.item)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-item-link={p.data.item}
          >
            <Ltr>{p.data.item}</Ltr>
          </Link>
        ) : null,
    },
    {
      // Free text in either script: the base cell isolates it as `<bdi>`.
      headerName: t('items.column.name'),
      colId: 'name',
      width: 240,
      valueGetter: (p) => (p.data ? localizedName(p.data, language) : ''),
    },
    figure(t('column.sapStock'), 'sapStock'),
    figure(t('column.tillStock'), 'tillStock', 110),
    figure(t('column.gap'), 'gap', 90),
    figure(t('column.held'), 'held', 90),
    {
      headerName: t('column.reserved'),
      colId: 'reserved',
      width: 190,
      cellRenderer: (p: Cell) => (p.data ? <ReservedCell row={p.data} t={t} /> : null),
    },
    {
      headerName: t('column.free'),
      colId: 'free',
      width: 200,
      cellRenderer: (p: Cell) => (p.data ? <FreeCell row={p.data} t={t} /> : null),
    },
    {
      headerName: t('column.lastUpdate'),
      field: 'lastUpdate',
      width: 140,
      cellClass: MONO,
      valueFormatter: formatTime,
      cellRenderer: LtrCell,
    },
  ]
}
