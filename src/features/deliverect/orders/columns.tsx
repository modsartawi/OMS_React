import type { ColDef, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'
import { RotateCw } from 'lucide-react'
import type { DeliverectOrderRow } from '@/core/models/deliverect'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney3 } from '@/core/util/number-format'
import { documentPath, needsPerson, outcomeLabel, retryOffered, statusLabel } from './order-status'

type Row = DeliverectOrderRow

/** A status code in words — `20 · Accepted` — one string (bidi rule); an unnamed code alone, raw. */
export function statusText(t: TFunction, code: number): string {
  const label = statusLabel(code)
  return label.key ? formatPair(code, t(label.key)) : String(code)
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

/** The "needs a person" badge a 126 carries, wherever the status shows. */
export function NeedsPerson({ t }: { t: TFunction }) {
  return (
    <span data-needs-person="">
      <StatusBadge sev="bad">{t('alert.badge')}</StatusBadge>
    </span>
  )
}

const time = ({ value }: ValueFormatterParams<Row, string | null>) => formatDateTime(value)

/**
 * The Deliverect orders grid (ticket 478; contract § Orders monitor): received at, delivery
 * platform, display id, store, our document (a link), outcome, reason, dropped lines, the last
 * status sent and whether that call was OK, when it was sent, and the total (3 decimals) beside
 * its currency — then the row's Details and, for a refused or status-failed order only, Retry.
 *
 * Every plain cell is isolated by the core grid base. A column with its own renderer isolates its
 * own whole value. Each value getter / formatter is the text the export writes.
 */
export function orderColumns(
  t: TFunction,
  act: { onDetails: (row: Row) => void; onRetry: (row: Row) => void },
): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  return [
    { field: 'receivedAt', headerName: t('columns.receivedAt'), width: 150, pinned: pinStart, valueFormatter: time },
    { field: 'platformKey', headerName: t('columns.platform'), width: 140, cellClass: code },
    { field: 'channelDisplayId', headerName: t('columns.displayId'), width: 130, cellClass: code },
    { field: 'storeCode', headerName: t('columns.store'), width: 90, cellClass: code },
    {
      field: 'documentNumber',
      headerName: t('columns.document'),
      width: 140,
      cellClass: code,
      cellRenderer: ({ value }: ICellRendererParams<Row, string | null>) =>
        value ? (
          <Link to={documentPath(value)} className="text-primary underline-offset-2 hover:underline" data-order-document={value}>
            <Ltr>{value}</Ltr>
          </Link>
        ) : null,
    },
    {
      field: 'outcome',
      headerName: t('columns.outcome'),
      width: 140,
      valueFormatter: ({ value }: ValueFormatterParams<Row, string>) => (value ? outcomeText(t, value) : ''),
      cellRenderer: ({ value }: ICellRendererParams<Row, string>) =>
        value ? (
          <span data-order-outcome={value}>
            <OutcomeBadge t={t} outcome={value} />
          </span>
        ) : null,
    },
    { field: 'reason', headerName: t('columns.reason'), width: 240, tooltipField: 'reason' },
    { field: 'droppedLines', headerName: t('columns.droppedLines'), width: 120, type: 'numericColumn', cellClass: 'tabular-nums' },
    {
      colId: 'lastStatus',
      headerName: t('columns.lastStatus'),
      width: 260,
      valueGetter: ({ data }: ValueGetterParams<Row>) => (data?.lastStatusSent != null ? statusText(t, data.lastStatusSent) : ''),
      cellRenderer: ({ data, value }: ICellRendererParams<Row, string>) => {
        if (data?.lastStatusSent == null) return null
        const label = statusLabel(data.lastStatusSent)
        return (
          <span className="flex h-full items-center gap-1.5" data-order-status={data.lastStatusSent}>
            <StatusBadge sev={label.sev}>
              <Ltr>{value}</Ltr>
            </StatusBadge>
            {needsPerson(data.lastStatusSent) && <NeedsPerson t={t} />}
          </span>
        )
      },
    },
    {
      field: 'lastStatusOk',
      headerName: t('columns.lastStatusOk'),
      width: 110,
      valueFormatter: ({ value }: ValueFormatterParams<Row, boolean | null>) =>
        value == null ? '' : t(value ? 'statusCall.ok' : 'statusCall.failed'),
      cellRenderer: ({ value, valueFormatted }: ICellRendererParams<Row, boolean | null>) =>
        value == null ? null : (
          <span data-order-status-ok={String(value)}>
            <StatusBadge sev={value ? 'ok' : 'bad'}>{valueFormatted}</StatusBadge>
          </span>
        ),
    },
    { field: 'lastStatusAt', headerName: t('columns.lastStatusAt'), width: 150, valueFormatter: time },
    {
      field: 'total',
      headerName: t('columns.total'),
      width: 120,
      type: 'numericColumn',
      cellClass: 'tabular-nums',
      valueFormatter: ({ value }: ValueFormatterParams<Row, number>) => formatMoney3(value),
    },
    { field: 'currencyKey', headerName: t('columns.currency'), width: 90, cellClass: code },
    {
      colId: 'actions',
      headerName: t('columns.actions'),
      width: 200,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) =>
        data ? (
          <span className="flex h-full items-center gap-1.5">
            <Button variant="ghost" onClick={() => act.onDetails(data)} data-order-details={data.deliverectOrderId}>
              {t('actions.details')}
            </Button>
            {retryOffered(data.outcome) && (
              <Button variant="outlined" onClick={() => act.onRetry(data)} data-order-retry={data.deliverectOrderId}>
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
                {t('actions.retry')}
              </Button>
            )}
          </span>
        ) : null,
    },
  ]
}
