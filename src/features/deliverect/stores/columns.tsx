import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Clock, History, PackageSearch, Pause, Play, ScrollText, Store } from 'lucide-react'
import type { DeliverectStoreRow, DeliverectStoreState } from '@/core/models/deliverect'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { storeState } from './store-state'
import { DELTA_OVERDUE_MINUTES, FULL_SYNC_HOUR, syncHealth, syncHighlight, type SyncHealth } from './sync-health'

type Row = DeliverectStoreRow

const STATUS_SEV: Record<DeliverectStoreState, Severity> = { open: 'ok', busy: 'warn', closed: 'bad' }

/**
 * A store status as words — a state the contract does not name (2625 is unbuilt) shows as sent,
 * neutral, and `raw` so the cell isolates it as the machine value it is.
 */
function statusLabel(t: TFunction, state: string): { text: string; sev: Severity; raw: boolean } {
  return state in STATUS_SEV
    ? { text: t(`status.${state}`), sev: STATUS_SEV[state as DeliverectStoreState], raw: false }
    : { text: state, sev: 'mute', raw: true }
}

/** The hour the full run is due, as the overdue sentence names it. */
const FULL_SYNC_DUE = `${String(FULL_SYNC_HOUR).padStart(2, '0')}:00`

/** The badge's tone: the row's highlight (`syncHighlight`, one rule for both) — else ok, or neutral. */
const healthSev = (health: SyncHealth): Severity => syncHighlight(health) ?? (health === 'ok' ? 'ok' : 'mute')

/** The health's words, and — for an overdue store — which run is behind, in words (a `title`). */
function healthLabel(t: TFunction, row: Row, now: Date): { health: SyncHealth; text: string; why: string } | null {
  const reading = syncHealth(row, now)
  if (!reading) return null
  const why = [
    reading.fullOverdue && t('syncHealth.fullOverdue', { time: fsi(FULL_SYNC_DUE) }),
    reading.deltaOverdue && t('syncHealth.deltaOverdue', { count: DELTA_OVERDUE_MINUTES, minutes: fsi(String(DELTA_OVERDUE_MINUTES)) }),
  ]
    .filter(Boolean)
    .join(' ')
  return { health: reading.health, text: t(`syncHealth.${reading.health}`), why }
}

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The Deliverect stores grid (ticket 477): store, name, account, the link state, the Deliverect
 * location, onboarded at/by, linked at, and the direct-HungerStation badge — then the stock sync
 * and store status columns ONLY when the data carries them (`optionalColumns`; 480/481 fill them),
 * and the row's Move / Remove.
 *
 * The stock sync (ticket 480): active or paused, its health (`syncHealth` at `now()` — failed red,
 * overdue amber, the row highlighted the same way by the page), the last full and delta runs, the
 * last status and error; and the row's Pause / Resume and Logs, on a row that carries a sync block.
 *
 * The store status (ticket 481): open / busy / closed, since when and why; and the row's Set status,
 * Push hours and Status history, on a row that carries a status block.
 *
 * Every plain cell is isolated by the core grid base. A column with its own renderer isolates its
 * own whole value.
 */
export function storeColumns(
  t: TFunction,
  shown: { sync: boolean; status: boolean },
  act: {
    onMove: (row: Row) => void
    onRemove: (row: Row) => void
    onSyncActive: (row: Row) => void
    onLogs: (row: Row) => void
    /** 550: one material's sync history at the store. */
    onMaterial: (row: Row) => void
    onStatus: (row: Row) => void
    onHours: (row: Row) => void
    onHistory: (row: Row) => void
  },
  /** The page's clock — read on every render, so a store turns overdue without a refetch. */
  now: () => Date,
): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'storeCode', headerName: t('columns.store'), width: 100, pinned: pinStart, cellClass: code, cellRenderer: LtrCell },
    { field: 'storeName', headerName: t('columns.name'), width: 220, tooltipField: 'storeName' },
    { field: 'accountKey', headerName: t('columns.account'), width: 160, cellClass: code, cellRenderer: LtrCell },
    {
      colId: 'state',
      headerName: t('columns.state'),
      width: 190,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? t(`state.${storeState(data)}`) : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span data-store-state={storeState(data)}>
            <StatusBadge sev={storeState(data) === 'linked' ? 'ok' : 'warn'}>{t(`state.${storeState(data)}`)}</StatusBadge>
          </span>
        ) : null,
    },
    { field: 'deliverectLocationId', headerName: t('columns.location'), width: 170, cellClass: code, cellRenderer: LtrCell },
    { field: 'onboardedAt', headerName: t('columns.onboardedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    { field: 'onboardedBy', headerName: t('columns.onboardedBy'), width: 130, cellClass: code, cellRenderer: LtrCell },
    { field: 'linkedAt', headerName: t('columns.linkedAt'), width: 150, valueFormatter: time, cellRenderer: LtrCell },
    {
      field: 'onDirectHungerStation',
      headerName: t('columns.directHungerStation'),
      width: 170,
      valueFormatter: ({ value }: ValueFormatterParams<Row, boolean>) => (value === true ? t('badges.directHungerStation') : ''),
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data?.onDirectHungerStation ? (
          <span data-direct-hs="">
            <StatusBadge sev="warn">{t('badges.directHungerStation')}</StatusBadge>
          </span>
        ) : null,
    },
    ...(shown.sync
      ? [
          {
            colId: 'sync',
            headerName: t('columns.sync'),
            width: 130,
            valueGetter: ({ data }: ValueGetterParams<Row>) =>
              data?.sync ? t(data.sync.active ? 'sync.active' : 'sync.paused') : '',
            cellRenderer: ({ data }: ICellRendererParams<Row>) =>
              data?.sync ? (
                <StatusBadge sev={data.sync.active ? 'go' : 'mute'}>{t(data.sync.active ? 'sync.active' : 'sync.paused')}</StatusBadge>
              ) : null,
          } satisfies ColDef<Row>,
          {
            colId: 'syncHealth',
            headerName: t('columns.syncHealth'),
            width: 130,
            valueGetter: ({ data }: ValueGetterParams<Row>) => (data ? (healthLabel(t, data, now())?.text ?? '') : ''),
            cellRenderer: ({ data }: ICellRendererParams<Row>) => {
              const label = data ? healthLabel(t, data, now()) : null
              return label ? (
                <span data-sync-health={label.health} title={label.why || undefined}>
                  <StatusBadge sev={healthSev(label.health)}>{label.text}</StatusBadge>
                </span>
              ) : null
            },
          } satisfies ColDef<Row>,
          {
            colId: 'lastFullRun',
            headerName: t('columns.lastFullRun'),
            width: 150,
            valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync?.lastFullRun ?? null,
            valueFormatter: time,
            cellRenderer: LtrCell,
          } satisfies ColDef<Row>,
          {
            colId: 'lastDeltaRun',
            headerName: t('columns.lastDeltaRun'),
            width: 150,
            valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync?.lastDeltaRun ?? null,
            valueFormatter: time,
            cellRenderer: LtrCell,
          } satisfies ColDef<Row>,
          {
            colId: 'lastStatus',
            headerName: t('columns.lastStatus'),
            width: 110,
            cellClass: code,
            valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync?.lastStatus ?? null,
            cellRenderer: LtrCell,
          } satisfies ColDef<Row>,
          {
            colId: 'lastError',
            headerName: t('columns.lastError'),
            width: 240,
            valueGetter: ({ data }: ValueGetterParams<Row>) => data?.sync?.lastError ?? null,
            tooltipValueGetter: ({ data }) => data?.sync?.lastError ?? null,
          } satisfies ColDef<Row>,
        ]
      : []),
    ...(shown.status
      ? [
          {
            colId: 'status',
            headerName: t('columns.status'),
            width: 120,
            valueGetter: ({ data }: ValueGetterParams<Row>) => (data?.status ? statusLabel(t, data.status.state).text : ''),
            cellRenderer: ({ data }: ICellRendererParams<Row>) => {
              if (!data?.status) return null
              const { text, sev, raw } = statusLabel(t, data.status.state)
              return <StatusBadge sev={sev}>{raw ? <Ltr>{text}</Ltr> : text}</StatusBadge>
            },
          } satisfies ColDef<Row>,
          {
            colId: 'statusSince',
            headerName: t('columns.statusSince'),
            width: 150,
            valueGetter: ({ data }: ValueGetterParams<Row>) => data?.status?.since ?? null,
            valueFormatter: time,
            cellRenderer: LtrCell,
          } satisfies ColDef<Row>,
          {
            colId: 'statusReason',
            headerName: t('columns.statusReason'),
            width: 200,
            valueGetter: ({ data }: ValueGetterParams<Row>) => data?.status?.reason ?? null,
            tooltipValueGetter: ({ data }) => data?.status?.reason ?? null,
          } satisfies ColDef<Row>,
        ]
      : []),
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 180 + (shown.sync ? 310 : 0) + (shown.status ? 360 : 0),
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
            {data.sync && (
              <>
                <Button variant="ghost" onClick={() => act.onSyncActive(data)} data-sync-toggle={data.storeCode}>
                  {data.sync.active ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                  {t(data.sync.active ? 'pause.button' : 'resume.button')}
                </Button>
                <Button variant="ghost" onClick={() => act.onLogs(data)} data-sync-logs={data.storeCode}>
                  <ScrollText className="h-3.5 w-3.5" aria-hidden />
                  {t('logs.button')}
                </Button>
                <Button variant="ghost" onClick={() => act.onMaterial(data)} data-material-history={data.storeCode}>
                  <PackageSearch className="h-3.5 w-3.5" aria-hidden />
                  {t('material.button')}
                </Button>
              </>
            )}
            {data.status && (
              <>
                <Button variant="ghost" onClick={() => act.onStatus(data)} data-status-set={data.storeCode}>
                  <Store className="h-3.5 w-3.5" aria-hidden />
                  {t('statusAction.button')}
                </Button>
                <Button variant="ghost" onClick={() => act.onHours(data)} data-status-hours={data.storeCode}>
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {t('hours.button')}
                </Button>
                <Button variant="ghost" onClick={() => act.onHistory(data)} data-status-history={data.storeCode}>
                  <History className="h-3.5 w-3.5" aria-hidden />
                  {t('history.button')}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => act.onMove(data)} data-store-move={data.storeCode}>
              {t('move.button')}
            </Button>
            <Button variant="danger-outlined" onClick={() => act.onRemove(data)} data-store-remove={data.storeCode}>
              {t('remove.button')}
            </Button>
          </span>
        ) : null,
    },
  ]
}
