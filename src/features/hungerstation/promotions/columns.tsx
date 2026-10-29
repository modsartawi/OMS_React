import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { HungerStationPromotionRow } from '@/core/models/hungerstation'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { windowText } from './promotion-display'
import { promotionStatusLabel, promotionStatusText } from './promotion-status'
import { typeText } from './promotion-words'

type Row = HungerStationPromotionRow

/** A promotion (or a part's) status badge: its words, or — for one the contract does not name —
 *  the value as sent, isolated. Never blank. */
export function PromotionStatusBadge({ t, status }: { t: TFunction; status: string }) {
  const label = promotionStatusLabel(status)
  return (
    <span data-promotion-status={status}>
      <StatusBadge sev={label.sev}>{label.key ? t(label.key) : <Ltr>{status || '—'}</Ltr>}</StatusBadge>
    </span>
  )
}

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The promotions grid (ticket 665; contract § `GET Promotions`): name, chain, type, status, the
 * window (local start and end as ONE range), store count, item count, sent at, updated at and by,
 * then Details. Every plain cell is isolated by the core grid base; the status column draws its own
 * badge.
 */
export function promotionColumns(t: TFunction, act: { onDetails: (row: Row) => void }): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'name', headerName: t('columns.name'), width: 240, pinned: pinStart, tooltipField: 'name' },
    { field: 'chainKey', headerName: t('columns.chain'), width: 110, cellClass: code },
    {
      field: 'type',
      headerName: t('columns.type'),
      width: 150,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string>) => (value ? typeText(t, value) : ''),
    },
    {
      field: 'status',
      headerName: t('columns.status'),
      width: 160,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string>) => promotionStatusText(t, value ?? ''),
      cellRenderer: ({ value }: ICellRendererParams<Row, string>) => <PromotionStatusBadge t={t} status={value ?? ''} />,
    },
    {
      colId: 'window',
      headerName: t('columns.window'),
      width: 290,
      cellClass: 'tabular-nums',
      valueGetter: ({ data }) => (data ? windowText(data.startAt, data.endAt) : ''),
      // Sorts by start, which local wall-clock text does as time does.
      comparator: (_a, _b, na, nb) => (na.data?.startAt ?? '').localeCompare(nb.data?.startAt ?? ''),
    },
    { field: 'storeCount', headerName: t('columns.stores'), width: 90, type: 'numericColumn', cellClass: 'tabular-nums' },
    { field: 'itemCount', headerName: t('columns.items'), width: 90, type: 'numericColumn', cellClass: 'tabular-nums' },
    { field: 'sentAt', headerName: t('columns.sentAt'), width: 150, valueFormatter: time },
    { field: 'updatedAt', headerName: t('columns.updatedAt'), width: 150, valueFormatter: time },
    { field: 'updatedBy', headerName: t('columns.updatedBy'), width: 130, cellClass: code },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center">
            <Button variant="ghost" onClick={() => act.onDetails(data)} data-promotion-details={data.promotionId}>
              {t('actions.details')}
            </Button>
          </span>
        ) : null,
    },
  ]
}
