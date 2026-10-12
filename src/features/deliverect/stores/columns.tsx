import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { DeliverectStoreRow, DeliverectStoreState } from '@/core/models/deliverect'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatDateTime } from '@/core/util/date-format'
import { storeState } from './store-state'

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

/** A machine value (a code, a key, a time) isolated left-to-right once, as the formatter shaped it. */
function LtrCell({ value, valueFormatted }: ICellRendererParams) {
  const text = valueFormatted ?? (value == null ? '' : String(value))
  return text === '' ? null : <Ltr>{text}</Ltr>
}

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The Deliverect stores grid (ticket 477): store, name, account, the link state, the Deliverect
 * location, onboarded at/by, linked at, and the direct-HungerStation badge — then the stock sync
 * and store status columns ONLY when the data carries them (`optionalColumns`; 480/481 fill them),
 * and the row's Move / Remove.
 *
 * Every plain cell is isolated by the core grid base. A column with its own renderer isolates its
 * own whole value.
 */
export function storeColumns(
  t: TFunction,
  shown: { sync: boolean; status: boolean },
  act: { onMove: (row: Row) => void; onRemove: (row: Row) => void },
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
        ]
      : []),
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 180,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
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
