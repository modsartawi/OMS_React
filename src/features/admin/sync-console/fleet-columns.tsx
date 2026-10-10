import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { StoreRow } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
import { figure, lastLoopError, stateBadge } from './helpers'
import StateBadges from './StateBadges'
import { CONSOLE_DEFAULT_COL_DEF, MONO, formatTime } from './console-columns'

/**
 * The fleet store table's columns (ticket 445). Sorting and paging are the door's,
 * so no column is client-sortable or filterable: a sort over page 3's 50 rows would
 * reorder a page, not the fleet.
 *
 * A WPF store has no health row, so its health cells are blank rather than a `0` that
 * would read as "caught up".
 */
export const FLEET_DEFAULT_COL_DEF: ColDef<StoreRow> = CONSOLE_DEFAULT_COL_DEF

/** A health figure, blank on a store that has no health row. */
const formatHealth = (p: ValueFormatterParams<StoreRow, number>) =>
  p.data?.healthUpdatedAt == null || p.value == null ? '' : figure(p.value)

export function buildFleetColumns(t: TFunction): ColDef<StoreRow>[] {
  return [
    {
      // 🔑 The way into the store page — a real anchor, so it can be middle-clicked,
      // copied and linked to.
      headerName: t('table.columns.code'),
      field: 'code',
      width: 100,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<StoreRow>) =>
        p.data ? (
          <Link
            to={`/admin/sync/store/${encodeURIComponent(p.data.code)}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-store-link={p.data.code}
          >
            <Ltr>{p.data.code}</Ltr>
          </Link>
        ) : null,
    },
    { headerName: t('table.columns.description'), field: 'description', width: 220 },
    {
      headerName: t('table.columns.host'),
      field: 'host',
      width: 90,
      // A host this bundle does not know shows its raw code, never a raw key.
      valueFormatter: (p: ValueFormatterParams<StoreRow, string>) =>
        p.value ? t(`hosts.${p.value}`, { defaultValue: p.value }) : '',
    },
    {
      // Every state the door sent except `controlPending`, which has its own column
      // below, read off the row's own `controlPending` field.
      headerName: t('table.columns.states'),
      colId: 'states',
      width: 230,
      cellRenderer: (p: ICellRendererParams<StoreRow>) =>
        p.data ? <StateBadges states={p.data.states.filter((s) => s !== 'controlPending')} /> : null,
    },
    { headerName: t('table.columns.lastConnectOk'), field: 'lastConnectOkAt', width: 150, valueFormatter: formatTime },
    { headerName: t('table.columns.lastConnectFail'), field: 'lastConnectFailAt', width: 170, valueFormatter: formatTime },
    {
      headerName: t('table.columns.pendingActions'),
      field: 'pendingActions',
      width: 100,
      type: 'rightAligned',
      valueFormatter: formatHealth,
    },
    { headerName: t('table.columns.oldestPending'), field: 'oldestPendingActionAt', width: 150, valueFormatter: formatTime },
    { headerName: t('table.columns.lastTrxPulled'), field: 'lastTrxPulledAt', width: 150, valueFormatter: formatTime },
    {
      // The newer of the two loops' errors. The message is the server's free text,
      // so it is isolated on its own (`<bdi>`, dir auto) and its time as a machine value.
      // The column is resizable; the store page (446) shows the whole message.
      headerName: t('table.columns.lastError'),
      colId: 'lastError',
      width: 320,
      cellRenderer: (p: ICellRendererParams<StoreRow>) => {
        const last = p.data ? lastLoopError(p.data) : null
        if (!last) return null
        return (
          <span className="flex min-w-0 gap-2">
            <span className="shrink-0 text-muted-foreground">
              <Ltr>{formatDateTime(last.at)}</Ltr>
            </span>
            <bdi className="truncate">{last.error}</bdi>
          </span>
        )
      },
    },
    {
      headerName: t('table.columns.control'),
      field: 'controlPending',
      width: 110,
      cellRenderer: (p: ICellRendererParams<StoreRow>) =>
        p.data?.controlPending ? <StatusBadge sev={stateBadge('controlPending').sev}>{t('table.pending')}</StatusBadge> : null,
    },
  ]
}
