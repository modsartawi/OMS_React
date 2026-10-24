import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'
import { RotateCw } from 'lucide-react'
import type { HungerStationOrderRow } from '@/core/models/hungerstation'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { orderMoney, storeLogsPath, storesPath } from './order-links'
import { alertLabel, outcomeLabel } from './order-outcome'

type Row = HungerStationOrderRow

/**
 * The store code, linked to its logs on the Stores page (`storeLogsPath`, the 554 deep link) when the
 * person may open that page — a removed store's history stays readable from here. Without
 * `canManageStores` the link would only reach the denied card, so it is plain text. One isolated value.
 */
export function StoreCode({ code, linked, data }: { code: string; linked: boolean; data: string }) {
  return linked ? (
    <Link to={storeLogsPath(code)} className="text-primary underline-offset-2 hover:underline" {...{ [data]: code }}>
      <Ltr>{code}</Ltr>
    </Link>
  ) : (
    <Ltr>{code}</Ltr>
  )
}

/** An outcome in words; one the contract does not name, as sent. */
export function outcomeText(t: TFunction, outcome: string): string {
  const label = outcomeLabel(outcome)
  return label.key ? t(label.key) : outcome
}

/** An outcome's badge: its words, or — for one the contract does not name — the value as sent, isolated. */
export function OutcomeBadge({ t, outcome }: { t: TFunction; outcome: string }) {
  const label = outcomeLabel(outcome)
  return <StatusBadge sev={label.sev}>{label.key ? t(label.key) : <Ltr>{outcome}</Ltr>}</StatusBadge>
}

/** An alert's badge — `unmatched` reads "Store not onboarded" on the attention ground. */
export function AlertBadge({ t, alert }: { t: TFunction; alert: string | null }) {
  const label = alertLabel(alert)
  return label ? (
    <span data-order-alert-badge={alert ?? ''}>
      <StatusBadge sev="warn">{t(label.badge)}</StatusBadge>
    </span>
  ) : null
}

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The HungerStation orders grid (ticket 556; contract § Orders monitor): received at, order code,
 * order id, chain, vendor id, store, HungerStation's own status, our document, the outcome judged on
 * our side, the reason, replaced lines, the delivery count, the total (3 decimals and its currency,
 * one value), and the alert — `unmatched` with its link to the Stores page — then Details and, for a
 * `retryable` order only, Retry.
 *
 * Every plain cell is isolated by the core grid base. A column with its own renderer isolates its
 * own whole value. `storeCode` and `documentNumber` render blank when `null`.
 */
export function orderColumns(
  t: TFunction,
  act: { onDetails: (row: Row) => void; onRetry: (row: Row) => void },
  /** `canManageStores`: the store code links to its logs on the Stores page. */
  linkStores: boolean,
): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'receivedAt', headerName: t('columns.receivedAt'), width: 150, pinned: pinStart, valueFormatter: time },
    { field: 'orderCode', headerName: t('columns.orderCode'), width: 120, cellClass: code },
    { field: 'orderId', headerName: t('columns.orderId'), width: 150, cellClass: code, tooltipField: 'orderId' },
    { field: 'chainKey', headerName: t('columns.chain'), width: 110, cellClass: code },
    { field: 'vendorId', headerName: t('columns.vendorId'), width: 110, cellClass: code },
    {
      field: 'storeCode',
      headerName: t('columns.store'),
      width: 90,
      cellClass: code,
      cellRenderer: ({ value }: ICellRendererParams<Row, string | null>) =>
        value ? <StoreCode code={value} linked={linkStores} data="data-order-store-link" /> : null,
    },
    { field: 'hsStatus', headerName: t('columns.hsStatus'), width: 150, cellClass: code },
    { field: 'documentNumber', headerName: t('columns.document'), width: 130, cellClass: code },
    {
      field: 'outcome',
      headerName: t('columns.outcome'),
      width: 120,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string>) => (value ? outcomeText(t, value) : ''),
      cellRenderer: ({ value }: ICellRendererParams<Row, string>) =>
        value ? (
          <span data-order-outcome={value}>
            <OutcomeBadge t={t} outcome={value} />
          </span>
        ) : null,
    },
    { field: 'reason', headerName: t('columns.reason'), width: 240, tooltipField: 'reason' },
    { field: 'replacedLines', headerName: t('columns.replacedLines'), width: 120, type: 'numericColumn', cellClass: 'tabular-nums' },
    { field: 'deliveries', headerName: t('columns.deliveries'), width: 100, type: 'numericColumn', cellClass: 'tabular-nums' },
    {
      // The total and its currency are ONE machine value (`18.950 SAR`), isolated whole by the grid base.
      field: 'total',
      headerName: t('columns.total'),
      width: 130,
      type: 'numericColumn',
      cellClass: 'tabular-nums',
      valueGetter: ({ data }) => (data ? orderMoney(data.total, data.currencyKey) : ''),
    },
    {
      field: 'alert',
      headerName: t('columns.alert'),
      width: 260,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string | null>) => {
        const label = alertLabel(value)
        return label ? t(label.badge) : ''
      },
      cellRenderer: ({ data }: ICellRendererParams<Row>) => {
        const label = alertLabel(data?.alert)
        if (!data || !label) return null
        return (
          <span className="flex h-full items-center gap-1.5">
            <AlertBadge t={t} alert={data.alert} />
            {label.action && (
              <Link
                to={storesPath(data.vendorId)}
                className="text-xs text-primary underline-offset-2 hover:underline"
                data-order-stores-link={data.vendorId}
              >
                {t(label.action)}
              </Link>
            )}
          </span>
        )
      },
    },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 190,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
            <Button variant="ghost" onClick={() => act.onDetails(data)} data-order-details={data.orderId}>
              {t('actions.details')}
            </Button>
            {data.retryable === true && (
              <Button variant="outlined" onClick={() => act.onRetry(data)} data-order-retry={data.orderId}>
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
                {t('actions.retry')}
              </Button>
            )}
          </span>
        ) : null,
    },
  ]
}
