import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleStoreRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import { MONO, formatTime, figureColumn } from './columns'
import { storeHref } from './console-pages'
import { FreeCell, ReservedCell } from './figure-cells'
import { stageWord } from './figures'
import StatusPill from './StatusPill'
import { wordText } from './WordOrRaw'

type Cell = ICellRendererParams<StockConsoleStoreRow>

/** The store's page (ticket 941) — built in `./console-pages` since 943. */
export { storeHref }

const figure = figureColumn<StockConsoleStoreRow>
/**
 * The Stores grid's columns (oms 940), in the prototype's order: store, city, stage, status, stock (the till-side
 * counter) with SAP stock and the gap, held with its two parts, reserved, free, items below zero, last update.
 */
export function buildStoresColumns(t: TFunction): ColDef<StockConsoleStoreRow>[] {
  return [
    {
      // The way into the store's page — a real anchor, so it can be middle-clicked, copied and linked to.
      headerName: t('column.store'),
      field: 'plant',
      width: 90,
      cellClass: MONO,
      cellRenderer: (p: Cell) =>
        p.data ? (
          <Link
            to={storeHref(p.data.plant)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-store-link={p.data.plant}
          >
            <Ltr>{p.data.plant}</Ltr>
          </Link>
        ) : null,
    },
    { headerName: t('column.city'), field: 'city', width: 120 },
    {
      headerName: t('column.stage'),
      field: 'stage',
      width: 95,
      // A stage this bundle does not know shows as it came, never as a raw key.
      valueFormatter: (p: ValueFormatterParams<StockConsoleStoreRow, string>) => wordText(t, stageWord(p.value)),
    },
    {
      headerName: t('column.status'),
      field: 'status',
      width: 95,
      cellRenderer: (p: Cell) =>
        p.data ? <StatusPill store={p.data.plant} status={p.data.status} flags={p.data.flags} /> : null,
    },
    figure(t('column.tillStock'), 'tillStock', 110),
    figure(t('column.sapStock'), 'sapStock'),
    figure(t('column.gap'), 'gap', 90),
    figure(t('column.held'), 'held', 90),
    figure(t('column.heldStanding'), 'heldStanding', 95),
    figure(t('column.heldSold'), 'heldSold', 120),
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
    figure(t('column.belowZero'), 'belowZero', 100),
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
