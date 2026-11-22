import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import type { StockConsoleStoreRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { MONO, formatQuantity, formatTime } from './columns'
import { STOCK_CONSOLE_PATH } from './console-pages'
import { freeLabel, reservedView } from './figures'
import StatusPill from './StatusPill'

type Cell = ICellRendererParams<StockConsoleStoreRow>

/** The store's page (ticket 941). */
export const storeHref = (plant: string) => `${STOCK_CONSOLE_PATH}/store/${encodeURIComponent(plant)}`

const KNOWN_STAGES = ['Shadow', 'Seeding', 'Seeded', 'Blocking']

/** A figure column: a quantity in base units, isolated left-to-right, at the end of its cell. */
const figure = (headerName: string, field: keyof StockConsoleStoreRow, width = 100): ColDef<StockConsoleStoreRow> => ({
  headerName,
  field,
  width,
  type: 'numericColumn',
  valueFormatter: formatQuantity,
  cellRenderer: LtrCell,
})

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
      valueFormatter: (p: ValueFormatterParams<StockConsoleStoreRow, string>) =>
        p.value && KNOWN_STAGES.includes(p.value) ? t(`stage.${p.value}`) : (p.value ?? ''),
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

/** Reserved: "not computed" (never a zero), the figure with a stale mark and its time, or the figure. */
function ReservedCell({ row, t }: { row: StockConsoleStoreRow; t: TFunction }) {
  const view = reservedView(row)
  if (view.kind === 'notComputed')
    return (
      <span className="italic text-muted-foreground" data-reserved="notComputed">
        {t('reserved.notComputed')}
      </span>
    )
  const at = formatDateTime(view.at)
  return (
    <span
      className="inline-flex items-center gap-1.5"
      data-reserved={view.kind}
      title={at ? t('reserved.at', { at: fsi(at) }) : undefined}
    >
      <Ltr>{formatFigure(view.value)}</Ltr>
      {view.kind === 'stale' && (
        <>
          <StatusBadge sev="warn">{t('reserved.stale')}</StatusBadge>
          {at && (
            <span className="font-mono text-[11px] text-muted-foreground">
              <Ltr>{at}</Ltr>
            </span>
          )}
        </>
      )}
    </span>
  )
}

/** Free: the figure, and "reserved not included" whenever reserved is not in it. */
function FreeCell({ row, t }: { row: StockConsoleStoreRow; t: TFunction }) {
  const label = freeLabel(row)
  return (
    <span className="inline-flex items-center gap-1.5" data-free-label={label ?? ''}>
      <Ltr>{formatFigure(row.free)}</Ltr>
      {label && <span className="text-xs text-muted-foreground">{t(`free.${label}`)}</span>}
    </span>
  )
}
