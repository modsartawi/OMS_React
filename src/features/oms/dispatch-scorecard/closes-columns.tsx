import type { TFunction } from 'i18next'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Link } from 'react-router'
import type { DispatchScorecardDrillRow } from '@/core/models/dispatch-scorecard'
import { pinStart } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { afterTakeKey, itemText, itemsText } from './after-take'
import { causeKey, isFailedTakeOutcome } from './closes'
import { atpAtOfferColumn, refusedAttemptsColumn } from './columns'
import { drillPath, formatSeconds } from './figures'

/** The columns an identity or a code: written to the export as the text shown, never a number. */
export const CLOSES_TEXT_COLUMNS: ReadonlySet<string> = new Set(['subjectId', 'party', 'answeredBy', 'closedBy', 'courier'])

/** Delivery (opens it), Store, Offered, Answer time, Taken by — the head both tabs share. */
function headColumns(t: TFunction, dash: string): ColDef<DispatchScorecardDrillRow>[] {
  const text = (value: string | null | undefined) => (value ? value : dash)
  return [
    {
      colId: 'subjectId',
      field: 'subjectId',
      headerName: t('drill.column.delivery'),
      pinned: pinStart,
      minWidth: 130,
      cellClass: 'font-mono text-[12px]',
      cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardDrillRow>) => {
        if (!data) return null
        const to = drillPath(data)
        if (!to) return <Ltr>{text(data.subjectId)}</Ltr>
        return (
          <Link to={to} className="text-primary hover:underline" data-sc-delivery={data.subjectId}>
            <Ltr>{data.subjectId}</Ltr>
          </Link>
        )
      },
    },
    { colId: 'party', field: 'party', headerName: t('drill.column.store'), minWidth: 80, cellClass: 'font-mono text-[12px]' },
    { colId: 'offeredAt', field: 'offeredAt', headerName: t('drill.column.offeredAt'), minWidth: 140, valueFormatter: ({ value }) => text(formatDateTime(value)) },
    {
      colId: 'answerSeconds',
      field: 'answerSeconds',
      headerName: t('drill.column.answer'),
      type: 'numericColumn',
      minWidth: 90,
      valueFormatter: ({ value }) => (typeof value === 'number' ? formatSeconds(value) : dash),
    },
    // A fallback close has no bid, so nobody "took" it in a race: the dash.
    { colId: 'answeredBy', field: 'answeredBy', headerName: t('drill.column.takenBy'), minWidth: 110, valueFormatter: ({ value }) => text(value) },
  ]
}

/**
 * The closes tab (ticket 758): one row per delivery closed after a take. "Who caused it" is the label of
 * its outcome, nothing computed; the reason is exactly as sent (any script, isolated whole in a `<bdi>`),
 * "No reason given" when empty, whoever closed it.
 */
export function closesColumns(t: TFunction): ColDef<DispatchScorecardDrillRow>[] {
  const dash = t('dash')
  const text = (value: string | null | undefined) => (value ? value : dash)
  const reasonText = (row: DispatchScorecardDrillRow) => {
    const reason = row.afterTakeReason ?? ''
    return reason.trim() !== '' ? reason : t('drill.noReason')
  }
  return [
    ...headColumns(t, dash),
    { colId: 'closedBy', field: 'closedBy', headerName: t('drill.column.closedBy'), minWidth: 110, valueFormatter: ({ value }) => text(value) },
    { colId: 'closedAt', field: 'closedAt', headerName: t('drill.column.closedAt'), minWidth: 140, valueFormatter: ({ value }) => text(formatDateTime(value)) },
    {
      colId: 'cause',
      headerName: t('closes.column.cause'),
      minWidth: 240,
      wrapText: true,
      autoHeight: true,
      valueGetter: ({ data }) => (data ? t(causeKey(data.afterTakeOutcome ?? '')) : dash),
    },
    {
      colId: 'afterTake',
      headerName: t('drill.column.afterTake'),
      minWidth: 190,
      valueGetter: ({ data }) => {
        const key = afterTakeKey(data?.afterTakeOutcome)
        return key ? t(key, { defaultValue: data?.afterTakeOutcome }) : dash
      },
    },
    {
      colId: 'failedTake',
      headerName: t('closes.column.failedTake'),
      minWidth: 90,
      valueGetter: ({ data }) => (data ? t(isFailedTakeOutcome(data.afterTakeOutcome ?? '') ? 'closes.failedTake.yes' : 'closes.failedTake.no') : dash),
    },
    {
      // The reason exactly as sent (the courier's own words, maybe Arabic): no translation, no mapping.
      colId: 'reason',
      headerName: t('drill.column.reason'),
      minWidth: 220,
      wrapText: true,
      autoHeight: true,
      valueGetter: ({ data }) => (data ? reasonText(data) : dash),
      cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardDrillRow>) => {
        if (!data) return null
        const reason = data.afterTakeReason ?? ''
        if (reason.trim() !== '')
          return (
            <bdi className="leading-5" data-sc-reason="text">
              {reason}
            </bdi>
          )
        return (
          <span className="text-muted-foreground" data-sc-reason="noReason">
            {t('drill.noReason')}
          </span>
        )
      },
    },
    { colId: 'courier', field: 'afterTakeCourier', headerName: t('drill.column.courier'), minWidth: 130, valueFormatter: ({ value }) => text(value) },
    {
      colId: 'items',
      headerName: t('drill.column.items'),
      minWidth: 160,
      autoHeight: true,
      valueGetter: ({ data }) => itemsText(data?.items, dash),
      cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardDrillRow>) =>
        data?.items?.length ? (
          <ul className="flex flex-col py-1 leading-5" data-sc-items={data.items.length}>
            {data.items.map((item, i) => (
              <li key={`${item.itemNumber}-${i}`}>
                <Ltr>{itemText(item)}</Ltr>
              </li>
            ))}
          </ul>
        ) : (
          <span>{dash}</span>
        ),
    },
    atpAtOfferColumn(t, dash),
  ]
}

/**
 * The refused-closes tab: deliveries a store won and then tried to close, refused by the lock. They were
 * not cancelled; each lists its refused attempts (the 714 note once they are swept after 6 months).
 */
export function refusedColumns(t: TFunction): ColDef<DispatchScorecardDrillRow>[] {
  const dash = t('dash')
  return [
    ...headColumns(t, dash),
    { colId: 'cause', headerName: t('closes.column.cause'), minWidth: 240, wrapText: true, autoHeight: true, valueGetter: () => t('closes.cause.refused') },
    refusedAttemptsColumn(t, dash),
    atpAtOfferColumn(t, dash),
  ]
}
