import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import { useIsMutating } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { History, Loader2, Pause, Pencil, Play, RefreshCw, ScrollText, Trash2 } from 'lucide-react'
import type { HungerStationStoreRow } from '@/core/models/hungerstation'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatDateTime } from '@/core/util/date-format'
import { syncNowKey } from './api'
import { healthLabel, type HealthReading } from './store-state'

type Row = HungerStationStoreRow

/** The badge's tone: the row's highlight (one rule for both) — else ok, or neutral. */
const healthSev = (health: HealthReading, highlight: Severity | null): Severity => highlight ?? (health === 'ok' ? 'ok' : 'mute')

/** What a row's actions do — each opens its dialog (the page holds them). */
export interface StoreActions {
  onEdit: (row: Row) => void
  onRemove: (row: Row) => void
  /** Pause an active store's stock sync, or resume a paused one (553). */
  onToggleSync: (row: Row) => void
  onSyncNow: (row: Row) => void
  /** Open the store's pushes (554). */
  onLogs: (row: Row) => void
  /** Look up one material's history at the store (554). */
  onMaterial: (row: Row) => void
}

/**
 * Sync now (553). Off on a paused store — `aria-disabled`, so it stays focusable and its title says
 * why. While the store's push is in flight (its mutation, keyed by `syncNowKey`) it shows progress
 * and cannot be clicked again.
 */
function SyncNowButton({ row, t, onSyncNow }: { row: Row; t: TFunction; onSyncNow: (row: Row) => void }) {
  const running = useIsMutating({ mutationKey: syncNowKey(row.storeCode) }) > 0
  const paused = !row.sync.active
  const off = paused || running
  return (
    <Button
      variant="ghost"
      aria-disabled={off || undefined}
      aria-busy={running || undefined}
      title={paused ? t('syncNow.pausedHint') : undefined}
      onClick={() => !off && onSyncNow(row)}
      data-store-sync-now={row.storeCode}
      data-running={running ? '' : undefined}
    >
      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
      {running ? t('syncNow.running') : t('syncNow.button')}
    </Button>
  )
}

/** `null` renders blank — a `0001-01-01` stamp arrives as `null` (contract § Stores). */
const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The HungerStation stores grid (ticket 551): store, name, chain, vendor id, onboarded at/by,
 * updated at/by, then the sync block — active or paused, health (`healthLabel`: failing red, silent
 * amber, the row highlighted the same way by the page), last full, last delta, the last run in 24 h
 * with its status and error — and the row's actions: Edit, Remove (552), Pause / Resume and Sync
 * now (553), Logs and Material history (554).
 *
 * Every plain cell is isolated by the core grid base. A column with its own renderer isolates its
 * own whole value.
 */
export function storeColumns(t: TFunction, act: StoreActions): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'storeCode', headerName: t('columns.store'), width: 100, pinned: pinStart, cellClass: code, cellRenderer: LtrCell },
    { field: 'storeName', headerName: t('columns.name'), width: 220, tooltipField: 'storeName' },
    { field: 'chainKey', headerName: t('columns.chain'), width: 130, cellClass: code, cellRenderer: LtrCell },
    { field: 'vendorId', headerName: t('columns.vendorId'), width: 130, cellClass: code, cellRenderer: LtrCell },
    { field: 'onboardedAt', headerName: t('columns.onboardedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'onboardedBy', headerName: t('columns.onboardedBy'), width: 130, cellClass: code, cellRenderer: LtrCell },
    { field: 'updatedAt', headerName: t('columns.updatedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'updatedBy', headerName: t('columns.updatedBy'), width: 130, cellClass: code, cellRenderer: LtrCell },
    {
      colId: 'sync',
      headerName: t('columns.sync'),
      width: 120,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(data.sync.active ? 'sync.active' : 'sync.paused') : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span data-sync-active={String(data.sync.active)}>
            <StatusBadge sev={data.sync.active ? 'go' : 'mute'}>{t(data.sync.active ? 'sync.active' : 'sync.paused')}</StatusBadge>
          </span>
        ) : null,
    },
    {
      colId: 'health',
      headerName: t('columns.health'),
      width: 120,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(`health.${healthLabel(data.sync).health}`) : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) => {
        if (!data) return null
        const { health, highlight } = healthLabel(data.sync)
        const hint = health === 'failing' ? t('health.failingHint') : health === 'silent' ? t('health.silentHint') : undefined
        return (
          <span data-health={health} title={hint}>
            <StatusBadge sev={healthSev(health, highlight)}>{t(`health.${health}`)}</StatusBadge>
          </span>
        )
      },
    },
    {
      colId: 'lastFullRun',
      headerName: t('columns.lastFullRun'),
      width: 150,
      valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync.lastFullRun ?? null,
      valueFormatter: time,
      cellRenderer: LtrCell,
    },
    {
      colId: 'lastDeltaRun',
      headerName: t('columns.lastDeltaRun'),
      width: 150,
      valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync.lastDeltaRun ?? null,
      valueFormatter: time,
      cellRenderer: LtrCell,
    },
    {
      colId: 'lastRun',
      headerName: t('columns.lastRun'),
      width: 150,
      valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync.lastRun ?? null,
      valueFormatter: time,
      cellRenderer: LtrCell,
    },
    {
      colId: 'lastStatus',
      headerName: t('columns.lastStatus'),
      width: 110,
      valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync.lastStatus ?? null,
      // `S` / `E` in words; a value the contract does not name shows as sent.
      valueFormatter: ({ value }: ValueFormatterParams<Row, string | null>) =>
        value === 'S' || value === 'E' ? t(`pushStatus.${value}`) : (value ?? ''),
      cellRenderer: ({ data, valueFormatted }: ICellRendererParams<Row>) =>
        data?.sync.lastStatus ? (
          <span data-last-status={data.sync.lastStatus}>
            <StatusBadge sev={data.sync.lastStatus === 'S' ? 'ok' : 'bad'}>{valueFormatted}</StatusBadge>
          </span>
        ) : null,
    },
    {
      colId: 'lastError',
      headerName: t('columns.lastError'),
      width: 240,
      valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync.lastError ?? null,
      tooltipValueGetter: ({ data }) => data?.sync.lastError ?? null,
    },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 720,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
            <Button variant="ghost" onClick={() => act.onEdit(data)} data-store-edit={data.storeCode}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('edit.button')}
            </Button>
            <Button variant="ghost" onClick={() => act.onToggleSync(data)} data-store-toggle-sync={data.storeCode} data-to={data.sync.active ? 'pause' : 'resume'}>
              {data.sync.active ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
              {t(data.sync.active ? 'pause.button' : 'resume.button')}
            </Button>
            <SyncNowButton row={data} t={t} onSyncNow={act.onSyncNow} />
            <Button variant="ghost" onClick={() => act.onLogs(data)} data-store-logs={data.storeCode}>
              <ScrollText className="h-3.5 w-3.5" aria-hidden />
              {t('logs.button')}
            </Button>
            <Button variant="ghost" onClick={() => act.onMaterial(data)} data-store-material={data.storeCode}>
              <History className="h-3.5 w-3.5" aria-hidden />
              {t('material.button')}
            </Button>
            <Button variant="danger-outlined" onClick={() => act.onRemove(data)} data-store-remove={data.storeCode}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {t('remove.button')}
            </Button>
          </span>
        ) : null,
    },
  ]
}
