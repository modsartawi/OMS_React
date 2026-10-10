import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import type { SyncCommand } from '@/core/models/sync-console'
import { MONO, formatTime } from './console-columns'
import { canCancel, commandKindKey, commandStatusBadge, echoedDay } from './command-helpers'
import CodeBadgeView from './CodeBadgeView'

/**
 * The Commands feed's columns (ticket 448) — the fleet-wide page and a store's tab
 * draw the same command: when and by whom, the store, the kind (and a re-push's
 * object and date), its batch, its status, the worker's result and when it finished.
 * The door orders and pages the list.
 *
 * `onCancel` is the Cancel cell's action; it is `null` without `canOperate`, and the
 * cell then draws nothing at all (absent, not disabled).
 */
export function buildCommandColumns(
  t: TFunction,
  onCancel: ((command: SyncCommand) => void) | null,
): ColDef<SyncCommand>[] {
  const columns: ColDef<SyncCommand>[] = [
    { headerName: t('commands.columns.requestedAt'), field: 'requestedAt', width: 150, valueFormatter: formatTime },
    { headerName: t('commands.columns.requestedBy'), field: 'requestedBy', width: 130 },
    {
      headerName: t('commands.columns.code'),
      field: 'code',
      width: 90,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<SyncCommand>) =>
        p.data ? (
          <Link
            to={`/admin/sync/store/${encodeURIComponent(p.data.code)}?tab=commands`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-command-store={p.data.code}
          >
            <Ltr>{p.data.code}</Ltr>
          </Link>
        ) : null,
    },
    {
      headerName: t('commands.columns.kind'),
      field: 'kind',
      width: 140,
      // A kind this bundle does not know shows its raw code, never a raw key.
      valueFormatter: (p: ValueFormatterParams<SyncCommand, string>) => {
        if (!p.value) return ''
        const key = commandKindKey(p.value)
        return key ? t(key) : p.value
      },
    },
    {
      // A re-push names its object, or "all push objects" when it has none; other kinds have no object.
      headerName: t('commands.columns.objectId'),
      field: 'objectId',
      width: 150,
      cellClass: MONO,
      valueFormatter: (p: ValueFormatterParams<SyncCommand, string | null>) =>
        p.value ?? (p.data?.kind === 'RePush' ? t('rePush.allObjects') : ''),
    },
    {
      headerName: t('commands.columns.fromDate'),
      field: 'fromDate',
      width: 110,
      // The date as the door wrote it — its day part, never shifted through a Date.
      valueFormatter: (p: ValueFormatterParams<SyncCommand, string | null>) => (p.value ? echoedDay(p.value) : ''),
    },
    { headerName: t('commands.columns.batchId'), field: 'batchId', width: 120, cellClass: MONO },
    {
      headerName: t('commands.columns.status'),
      field: 'status',
      width: 110,
      cellRenderer: (p: ICellRendererParams<SyncCommand>) =>
        p.data ? (
          <span data-command-status={p.data.status}>
            <CodeBadgeView badge={commandStatusBadge(p.data.status)} code={p.data.status} />
          </span>
        ) : null,
    },
    // The worker's own words: free text, isolated by the base cell.
    { headerName: t('commands.columns.result'), field: 'result', flex: 1, minWidth: 220 },
    { headerName: t('commands.columns.finishedAt'), field: 'finishedAt', width: 150, valueFormatter: formatTime },
  ]
  if (onCancel) {
    columns.push({
      headerName: '',
      colId: 'cancel',
      width: 100,
      cellRenderer: (p: ICellRendererParams<SyncCommand>) =>
        p.data && canCancel(p.data) ? (
          <Button variant="text" className="h-6 px-2 text-xs" onClick={() => onCancel(p.data!)} data-command-cancel={p.data.id}>
            {t('commands.cancel')}
          </Button>
        ) : null,
    })
  }
  return columns
}
