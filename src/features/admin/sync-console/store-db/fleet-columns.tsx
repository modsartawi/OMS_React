import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import Ltr from '@/core/ui/Ltr'
import type { Severity } from '@/core/ui/severity'
import type { StoreDbFleetRow } from '@/core/models/store-database'
import { formatCount, formatPair } from '@/core/util/bidi'
import CodeBadgeView from '../CodeBadgeView'
import { MONO, formatTime } from '../console-columns'
import { figure } from '../helpers'
import { fleetRowView } from './fleet-helpers'
import { kbSize, sharePercent } from './size'

/**
 * The Store database tab's columns (oms 915). The order is the tab's (worst first, `shownFleet`), so no column is
 * client-sortable (the console's default col def). Every renderer isolates its own whole value; nothing here uses
 * `fsi` (a grid value reaches Ctrl+C).
 */
export function buildStoreDbFleetColumns(t: TFunction): ColDef<StoreDbFleetRow>[] {
  /** A KB figure in its unit, blank for no reading. */
  const size = (kb: number | null | undefined): string => {
    const s = kbSize(kb)
    return s ? t(`storeDb.units.${s.unit}`, { n: s.n }) : ''
  }
  /** "used / cap" as ONE value (bidi rule); a store with no cap reads its used size beside "No cap". */
  const usedOfCap = (row: StoreDbFleetRow): string => {
    if (row.usedKb == null) return ''
    return row.capKb > 0 ? formatCount(size(row.usedKb), size(row.capKb)) : formatPair(size(row.usedKb), t('storeDb.fleet.noCap'))
  }
  return [
    {
      // The way into the store's database page (916): a real anchor.
      headerName: t('storeDb.fleet.columns.code'),
      field: 'code',
      width: 90,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<StoreDbFleetRow>) =>
        p.data ? (
          <Link
            to={`/admin/sync/database/${encodeURIComponent(p.data.code)}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-store-db-link={p.data.code}
          >
            <Ltr>{p.data.code}</Ltr>
          </Link>
        ) : null,
    },
    { headerName: t('storeDb.fleet.columns.name'), field: 'name', flex: 1, minWidth: 150 },
    {
      headerName: t('storeDb.fleet.columns.state'),
      field: 'state',
      width: 120,
      cellRenderer: (p: ICellRendererParams<StoreDbFleetRow>) =>
        p.data ? (
          <span data-store-db-state={p.data.state}>
            <CodeBadgeView badge={fleetRowView(p.data).chip} code={p.data.state} />
          </span>
        ) : null,
    },
    {
      headerName: t('storeDb.fleet.columns.used'),
      colId: 'used',
      width: 200,
      valueGetter: (p) => (p.data ? usedOfCap(p.data) : ''),
      cellRenderer: (p: ICellRendererParams<StoreDbFleetRow, string>) =>
        p.data ? <UsedCapBar row={p.data} text={p.value ?? ''} /> : null,
    },
    {
      headerName: t('storeDb.fleet.columns.share'),
      field: 'usedShare',
      width: 80,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbFleetRow, number | null>) => {
        const n = sharePercent(p.data && p.data.capKb > 0 ? p.value : null)
        return n === null ? '' : t('storeDb.fleet.share', { n })
      },
    },
    {
      headerName: t('storeDb.fleet.columns.daysToCap'),
      field: 'daysToCap',
      width: 110,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbFleetRow, number | null>) => (p.value == null ? '' : figure(p.value)),
    },
    {
      headerName: t('storeDb.fleet.columns.driveFree'),
      field: 'driveFreeKb',
      width: 110,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbFleetRow, number | null>) => size(p.value),
    },
    {
      headerName: t('storeDb.fleet.columns.engine'),
      field: 'engine',
      width: 90,
      // A label this bundle does not know shows raw, never a raw key.
      valueFormatter: (p: ValueFormatterParams<StoreDbFleetRow, string>) =>
        p.value ? t(`storeDb.engines.${p.value}`, { defaultValue: p.value }) : '',
    },
    { headerName: t('storeDb.fleet.columns.edition'), field: 'edition', width: 150 },
    {
      headerName: t('storeDb.fleet.columns.bitness'),
      field: 'is64Bit',
      width: 90,
      valueFormatter: (p: ValueFormatterParams<StoreDbFleetRow, boolean | null>) =>
        p.value == null ? '' : t(p.value ? 'storeDb.fleet.bitness.x64' : 'storeDb.fleet.bitness.x86'),
    },
    { headerName: t('storeDb.fleet.columns.takenAt'), field: 'takenAt', width: 150, valueFormatter: formatTime },
  ]
}

/** The bar's tone per severity: tokens only (the palette gate). */
const BAR_TONE: Record<Severity, string> = {
  ok: 'var(--success)',
  go: 'var(--chart-1)',
  warn: 'var(--attention)',
  bad: 'var(--danger)',
  mute: 'var(--muted-foreground)',
}

/**
 * Used of cap, as a bar behind the figure: the share of THIS store's cap (not the column's largest, as `CellBar`
 * draws), in the state's colour. Grows from the inline start, so it mirrors under Arabic.
 */
function UsedCapBar({ row, text }: { row: StoreDbFleetRow; text: string }) {
  const { bar } = fleetRowView(row)
  return (
    <span className="relative flex h-full items-center" data-used-bar={bar ? bar.percent : ''}>
      {bar && (
        <span
          className="absolute inset-y-1 start-0 rounded-sm"
          style={{ width: `${bar.percent}%`, background: `color-mix(in oklab, ${BAR_TONE[bar.sev]} 28%, transparent)` }}
          aria-hidden
        />
      )}
      <span className="relative ms-1 tabular-nums">
        <Ltr>{text}</Ltr>
      </span>
    </span>
  )
}
