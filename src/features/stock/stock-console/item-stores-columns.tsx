import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleItemStoreRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import { formatFigure } from '@/core/util/number-format'
import { MONO, formatQuantity, formatTime } from './columns'
import { FreeCell, ReservedCell } from './figure-cells'
import { itemStoreFigures, itemStoreHref } from './item-stores'

type Cell = ICellRendererParams<StockConsoleItemStoreRow>

/** One store per row. Module-level, as AG Grid wants. */
export const itemStoreRowId = (row: StockConsoleItemStoreRow) => row.plant

const KNOWN_STAGES = ['Shadow', 'Seeding', 'Seeded', 'Blocking']

const figure = (headerName: string, field: keyof StockConsoleItemStoreRow, width = 100): ColDef<StockConsoleItemStoreRow> => ({
  headerName,
  field,
  width,
  type: 'numericColumn',
  valueFormatter: formatQuantity,
  cellRenderer: LtrCell,
})

/**
 * The item at every store (oms 943, spec 4157 story 59): the store (opens the same item there), its city and stage,
 * then the figures by the stores list's rules (`itemStoreFigures`) — till-side, SAP stock, gap, held, reserved, free —
 * and the last update.
 */
export function buildItemStoresColumns(t: TFunction, item: string): ColDef<StockConsoleItemStoreRow>[] {
  return [
    {
      headerName: t('column.store'),
      field: 'plant',
      width: 100,
      cellClass: MONO,
      cellRenderer: (p: Cell) =>
        p.data ? (
          <Link
            to={itemStoreHref(item, p.data)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-item-store-link={p.data.plant}
          >
            <Ltr>{p.data.plant}</Ltr>
          </Link>
        ) : null,
    },
    // Free text in either script: the base cell isolates it as `<bdi>`.
    { headerName: t('column.city'), field: 'city', width: 130 },
    {
      headerName: t('column.stage'),
      field: 'stage',
      width: 110,
      valueFormatter: (p) => (KNOWN_STAGES.includes(p.value as string) ? t(`stage.${p.value as string}`) : ((p.value as string) ?? '')),
    },
    figure(t('column.tillStock'), 'tillStock', 130),
    figure(t('column.sapStock'), 'sapStock'),
    {
      headerName: t('column.gap'),
      colId: 'gap',
      width: 90,
      type: 'numericColumn',
      valueGetter: (p) => (p.data ? formatFigure(itemStoreFigures(p.data).gap) : ''),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('column.held'),
      colId: 'held',
      width: 90,
      type: 'numericColumn',
      valueGetter: (p) => (p.data ? formatFigure(itemStoreFigures(p.data).held) : ''),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('column.reserved'),
      colId: 'reserved',
      width: 190,
      cellRenderer: (p: Cell) => (p.data ? <ReservedCell row={itemStoreFigures(p.data)} t={t} /> : null),
    },
    {
      headerName: t('column.free'),
      colId: 'free',
      width: 200,
      cellRenderer: (p: Cell) => (p.data ? <FreeCell row={itemStoreFigures(p.data)} t={t} /> : null),
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
