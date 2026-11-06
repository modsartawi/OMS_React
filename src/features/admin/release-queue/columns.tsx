import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import type { LiveSlot, SlotHistoryRow, SlotQueueEntry } from '@/core/models/release-queue'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatSeconds, fourHourFlag, outcomeKind, queuePositionLabel, type OutcomeKind } from './helpers'

/**
 * The release download queue's grids (ticket 791). Order is HQ's (oldest grant, grant order, newest end), so no
 * column sorts on the client. Plain cells are isolated by the core base; each renderer isolates its own whole value.
 */
export const RELEASE_QUEUE_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  suppressHeaderMenuButton: true,
}

const versions = (from: string, to: string) => formatRange(from, to)

/** The slot's progress: a bar and its percent. */
function ProgressCell({ data }: ICellRendererParams<LiveSlot>) {
  if (!data) return null
  const pct = Math.max(0, Math.min(100, Math.round(data.progressPercent)))
  return (
    <span className="flex h-full items-center gap-2" data-slot-progress={pct}>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[12px] tabular-nums">
        <Ltr>{`${pct}%`}</Ltr>
      </span>
    </span>
  )
}

/**
 * The live slots. `onFree` is handed only to a `PosRelease.Queue.Manage` holder (ticket 792): it adds a Free button on
 * each row, which opens the confirm — nothing is sent from the grid.
 */
export function slotColumns(t: TFunction, onFree?: (slot: LiveSlot) => void): ColDef<LiveSlot>[] {
  const columns: ColDef<LiveSlot>[] = [
    { colId: 'store', headerName: t('columns.store'), field: 'storeCode', width: 110 },
    { colId: 'till', headerName: t('columns.till'), field: 'machineCode', width: 130 },
    { colId: 'package', headerName: t('columns.package'), valueGetter: ({ data }) => (data ? t(`package.${data.package}`, { defaultValue: data.package }) : ''), width: 120 },
    { colId: 'versions', headerName: t('columns.versions'), valueGetter: ({ data }) => (data ? versions(data.fromVersion, data.toVersion) : ''), minWidth: 170, flex: 1 },
    { colId: 'started', headerName: t('columns.started'), valueGetter: ({ data }) => formatDateTime(data?.grantedAt), width: 150 },
    { colId: 'renewed', headerName: t('columns.renewed'), valueGetter: ({ data }) => formatDateTime(data?.renewedAt), width: 150 },
    { colId: 'progress', headerName: t('columns.progress'), valueGetter: ({ data }) => data?.progressPercent ?? 0, cellRenderer: ProgressCell, width: 170 },
  ]
  if (onFree)
    columns.push({
      colId: 'free',
      headerName: '',
      width: 110,
      cellRenderer: (p: ICellRendererParams<LiveSlot>) =>
        p.data ? (
          <Button variant="danger-outlined" onClick={() => p.data && onFree(p.data)} data-slot-free={p.data.leaseId}>
            {t('manage.free.action')}
          </Button>
        ) : null,
    })
  return columns
}

/** A queued till's wait: `h:mm:ss`, and the flag when it reaches four hours. */
function WaitCell({ data }: ICellRendererParams<QueueRow>) {
  const { t } = useTranslation('release-queue')
  if (!data) return null
  const flagged = fourHourFlag(data)
  return (
    <span className="flex h-full items-center gap-2" data-queue-wait={data.waitSeconds} data-queue-flagged={flagged}>
      <span className="font-mono text-[12px] tabular-nums">
        <Ltr>{formatSeconds(data.waitSeconds)}</Ltr>
      </span>
      {flagged && <StatusBadge sev="bad">{t('queue.overFourHours')}</StatusBadge>}
    </span>
  )
}

function UrgentCell({ data }: ICellRendererParams<QueueRow>) {
  const { t } = useTranslation('release-queue')
  return data?.urgent ? (
    <span data-queue-urgent="">
      <StatusBadge sev="warn">{t('queue.urgent')}</StatusBadge>
    </span>
  ) : null
}

/** A queue row with its `position / length` label baked in: a new length is new row data, so the grid redraws it. */
export interface QueueRow extends SlotQueueEntry {
  positionLabel: string
}

export const queueRows = (entries: readonly SlotQueueEntry[], queueLength: number): QueueRow[] =>
  entries.map((e) => ({ ...e, positionLabel: queuePositionLabel(e.position, queueLength) }))

export function queueColumns(t: TFunction): ColDef<QueueRow>[] {
  return [
    { colId: 'position', headerName: t('columns.position'), field: 'positionLabel', width: 110 },
    { colId: 'store', headerName: t('columns.store'), field: 'storeCode', width: 110 },
    { colId: 'till', headerName: t('columns.till'), field: 'machineCode', width: 130 },
    { colId: 'package', headerName: t('columns.package'), valueGetter: ({ data }) => (data ? t(`package.${data.package}`, { defaultValue: data.package }) : ''), width: 120 },
    { colId: 'toVersion', headerName: t('columns.toVersion'), field: 'toVersion', width: 120 },
    { colId: 'urgent', headerName: t('columns.urgent'), cellRenderer: UrgentCell, width: 110 },
    { colId: 'firstAsked', headerName: t('columns.firstAsked'), valueGetter: ({ data }) => formatDateTime(data?.firstAskedAt), width: 150 },
    { colId: 'wait', headerName: t('columns.wait'), valueGetter: ({ data }) => data?.waitSeconds ?? 0, cellRenderer: WaitCell, minWidth: 190, flex: 1 },
  ]
}

const OUTCOME_SEVERITY: Record<OutcomeKind, Severity> = {
  done: 'ok',
  failed: 'bad',
  expired: 'warn',
  freed: 'mute',
  unknown: 'mute',
}

/** A finished lease's outcome; a failure carries its reason, a hand-free who did it. */
function OutcomeCell({ data }: ICellRendererParams<SlotHistoryRow>) {
  const { t } = useTranslation('release-queue')
  if (!data) return null
  const kind = outcomeKind(data.outcome)
  return (
    <span className="flex h-full min-w-0 items-center gap-2" data-history-outcome={kind}>
      <StatusBadge sev={OUTCOME_SEVERITY[kind]}>{kind === 'unknown' ? <bdi>{data.outcome}</bdi> : t(`history.outcome.${kind}`)}</StatusBadge>
      {kind === 'failed' && data.failureReason && (
        <bdi className="truncate text-xs text-muted-foreground" data-history-reason="">
          {data.failureReason}
        </bdi>
      )}
      {kind === 'freed' && data.freedBy && (
        <span className="truncate text-xs text-muted-foreground" data-history-freed-by="">
          <bdi>{data.freedBy}</bdi>
        </span>
      )}
    </span>
  )
}

export function historyColumns(t: TFunction): ColDef<SlotHistoryRow>[] {
  return [
    { colId: 'store', headerName: t('columns.store'), field: 'storeCode', width: 110 },
    { colId: 'till', headerName: t('columns.till'), field: 'machineCode', width: 130 },
    { colId: 'package', headerName: t('columns.package'), valueGetter: ({ data }) => (data ? t(`package.${data.package}`, { defaultValue: data.package }) : ''), width: 110 },
    { colId: 'versions', headerName: t('columns.versions'), valueGetter: ({ data }) => (data ? versions(data.fromVersion, data.toVersion) : ''), width: 170 },
    { colId: 'started', headerName: t('columns.started'), valueGetter: ({ data }) => formatDateTime(data?.grantedAt), width: 150 },
    { colId: 'ended', headerName: t('columns.ended'), valueGetter: ({ data }) => formatDateTime(data?.endedAt), width: 150 },
    { colId: 'duration', headerName: t('columns.duration'), valueGetter: ({ data }) => formatSeconds(data?.durationSeconds ?? Number.NaN), width: 110 },
    { colId: 'progress', headerName: t('columns.lastProgress'), valueGetter: ({ data }) => (data ? `${data.progressPercent}%` : ''), width: 100 },
    { colId: 'outcome', headerName: t('columns.outcome'), cellRenderer: OutcomeCell, minWidth: 260, flex: 1 },
  ]
}
