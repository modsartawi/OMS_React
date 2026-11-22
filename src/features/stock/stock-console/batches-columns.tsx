import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import { Link } from 'react-router'

import type { StockConsoleBatchRow, StockConsoleScan } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDay } from '@/core/util/date-format'
import type { LocalDate } from '@/core/util/date-window'
import { localizedName } from '@/core/util/localized-name'
import { expiryCell } from './batches'
import { MONO, figureColumn } from './columns'
import { rowKey } from './row-ids'
import { itemHref } from './items-columns'
import { expiryMark, scanExpiry } from './scan'

type Cell = ICellRendererParams<StockConsoleBatchRow>

/** One item and batch per row. Module-level, as AG Grid wants. */
export const batchRowId = (row: StockConsoleBatchRow) => rowKey(row.item, row.batch)

const figure = figureColumn<StockConsoleBatchRow>
const code = (headerName: string, field: 'batch' | 'vendorBatch', width: number): ColDef<StockConsoleBatchRow> => ({
  headerName,
  field,
  width,
  cellClass: MONO,
  cellRenderer: LtrCell,
})

/**
 * The Batches grid's columns (oms 941), in the prototype's order: item, name, our batch, vendor batch, expiry (with its
 * "expired" / "within 90 days" mark), SAP stock, till-side, held, free for the take door, first received, and the
 * placeholder mark. `today` is the reader's local day, for the expiry mark. After a scan with an expiry (944), a column
 * beside the expiry says whether each batch's expiry is the scan's.
 */
export function buildBatchesColumns(
  t: TFunction,
  language: string,
  store: string,
  today: LocalDate,
  scan: StockConsoleScan | null = null,
): ColDef<StockConsoleBatchRow>[] {
  const columns = buildColumns(t, language, store, today)
  if (!scan || !scanExpiry(scan)) return columns
  const at = columns.findIndex((c) => c.field === 'expiry') + 1
  return [...columns.slice(0, at), scanMarkColumn<StockConsoleBatchRow>(t, scan), ...columns.slice(at)]
}

function buildColumns(t: TFunction, language: string, store: string, today: LocalDate): ColDef<StockConsoleBatchRow>[] {
  return [
    {
      headerName: t('batches.column.item'),
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
      headerName: t('batches.column.name'),
      colId: 'name',
      width: 200,
      valueGetter: (p) => (p.data ? localizedName(p.data, language) : ''),
    },
    code(t('batches.column.batch'), 'batch', 120),
    code(t('batches.column.vendorBatch'), 'vendorBatch', 130),
    {
      headerName: t('batches.column.expiry'),
      field: 'expiry',
      width: 190,
      cellRenderer: (p: Cell) => (p.data ? <ExpiryCell row={p.data} today={today} t={t} /> : null),
    },
    figure(t('column.sapStock'), 'sapStock'),
    figure(t('column.tillStock'), 'tillStock', 110),
    figure(t('column.held'), 'held', 90),
    figure(t('batches.column.freeForTheDoor'), 'freeForTheDoor', 160),
    {
      headerName: t('batches.column.firstReceived'),
      field: 'firstReceivedOn',
      width: 120,
      cellClass: MONO,
      valueFormatter: (p: ValueFormatterParams<StockConsoleBatchRow, string | null>) => formatDay(p.value),
      cellRenderer: LtrCell,
    },
    {
      headerName: t('batches.column.placeholder'),
      colId: 'placeholder',
      width: 110,
      cellRenderer: (p: Cell) =>
        p.data?.placeholder ? (
          <span data-placeholder="">
            <StatusBadge sev="mute">{t('batches.placeholder')}</StatusBadge>
          </span>
        ) : null,
    },
  ]
}

// ── 944 ──

/**
 * The expiry mark after a scan: "matches the scan", or "scan says <its expiry>" (by month when its day is 00). Any row
 * with an expiry takes it (943's Find batch rows too).
 */
export const scanMarkColumn = <T extends { expiry: string | null }>(t: TFunction, scan: StockConsoleScan): ColDef<T> => ({
  headerName: t('gs1.column.mark'),
  colId: 'scanMark',
  width: 170,
  cellRenderer: (p: ICellRendererParams<T>) => (p.data ? <ScanMarkCell expiry={p.data.expiry} scan={scan} t={t} /> : null),
})

function ScanMarkCell({ expiry, scan, t }: { expiry: string | null; scan: StockConsoleScan; t: TFunction }) {
  const cell = expiryMark(expiry, scan)
  if (cell.mark === 'none') return null
  return (
    <span data-scan-mark={cell.mark}>
      {cell.mark === 'matches' ? (
        <StatusBadge sev="ok">{t('gs1.mark.matches')}</StatusBadge>
      ) : (
        <StatusBadge sev="warn">
          <Trans t={t} i18nKey="gs1.mark.differs" values={{ expiry: cell.scan }} components={{ d: <Ltr /> }} />
        </StatusBadge>
      )}
    </span>
  )
}

const EXPIRY_SEV = { expired: 'bad', within90: 'warn' } as const

/** The expiry day, and its mark when the batch is expired or expires within 90 days. Find's batch rows (943) too. */
export function ExpiryCell({ row, today, t }: { row: { expiry: string | null }; today: LocalDate; t: TFunction }) {
  const expiry = expiryCell(row.expiry, today)
  if (!expiry.day) return null
  return (
    <span className="inline-flex items-center gap-1.5" data-expiry={expiry.mark}>
      <span className={MONO}>
        <Ltr>{expiry.day}</Ltr>
      </span>
      {(expiry.mark === 'expired' || expiry.mark === 'within90') && (
        <StatusBadge sev={EXPIRY_SEV[expiry.mark]}>{t(`batches.expiry.${expiry.mark}`)}</StatusBadge>
      )}
    </span>
  )
}
