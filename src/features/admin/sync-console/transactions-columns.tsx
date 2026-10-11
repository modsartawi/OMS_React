import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { StoreTransaction } from '@/core/models/sync-console'
import { formatMoney3 } from '@/core/util/number-format'
import { MONO, formatTime } from './console-columns'
import CodeBadgeView from './CodeBadgeView'
import ViewJsonButton from './ViewJsonButton'
import { counterBadge, counterTip, txKindLabel, txStatusLabel } from './transactions-helpers'

/**
 * The Transactions tab's list (spec 2586, ticket 467): one NewPos receipt per row, as
 * HQ's mirror holds it. As on every console grid, nothing sorts or filters on the
 * client — the door orders and pages the list, and its filters are the tab's own.
 *
 * 🚩 No lines, tenders or customer data: the door sends none. `transactionId` stays on
 * the row (468 opens the JSON with it) but is not a column.
 *
 * With `onView` (an operator's, ticket 468) a last column offers **View JSON** per row; it
 * only opens the drawer, which reads the snapshot itself. Without it the column is absent.
 */

/** The door's signed total, to 3 decimals — never re-signed, never `Math.abs`. Plain text: the base cell isolates it. */
const formatTotal = (p: ValueFormatterParams) => formatMoney3(p.value as number | null)

export function buildTransactionColumns(t: TFunction, onView?: (row: StoreTransaction) => void): ColDef<StoreTransaction>[] {
  const columns: ColDef<StoreTransaction>[] = [
    { headerName: t('transactionsTab.columns.receiptNumber'), field: 'receiptNumber', flex: 1, minWidth: 190, cellClass: MONO },
    { headerName: t('transactionsTab.columns.registerId'), field: 'registerId', width: 110, cellClass: MONO },
    { headerName: t('transactionsTab.columns.operatorId'), field: 'operatorId', width: 120, cellClass: MONO },
    {
      // The stored status's word; one this bundle does not know shows raw.
      headerName: t('transactionsTab.columns.status'),
      field: 'status',
      width: 120,
      valueFormatter: (p: ValueFormatterParams<StoreTransaction, string>) => {
        if (p.value == null) return ''
        const { labelKey } = txStatusLabel(p.value)
        return labelKey ? t(labelKey) : p.value
      },
    },
    {
      headerName: t('transactionsTab.columns.kind'),
      field: 'isReturn',
      width: 130,
      valueFormatter: (p: ValueFormatterParams<StoreTransaction, boolean>) => (p.value == null ? '' : t(txKindLabel(p.value))),
    },
    { headerName: t('transactionsTab.columns.total'), field: 'total', width: 140, type: 'rightAligned', valueFormatter: formatTotal },
    { headerName: t('transactionsTab.columns.openedAt'), field: 'openedAt', width: 160, valueFormatter: formatTime },
    { headerName: t('transactionsTab.columns.completedAt'), field: 'completedAt', width: 160, valueFormatter: formatTime },
    {
      // The door's flag in its token; the counter total in the tooltip, a string-only sink.
      headerName: t('transactionsTab.columns.counter'),
      field: 'counter',
      width: 150,
      cellRenderer: (p: ICellRendererParams<StoreTransaction>) => {
        if (!p.data) return null
        const tip = counterTip(p.data)
        return (
          <span title={t(tip.key, { total: tip.total })} data-counter={p.data.counter}>
            <CodeBadgeView badge={counterBadge(p.data.counter)} code={p.data.counter} />
          </span>
        )
      },
    },
  ]
  if (!onView) return columns
  return [
    ...columns,
    {
      // The action, not a value: nothing to sort, filter, resize or copy.
      colId: 'view',
      headerName: t('transactionsTab.columns.view'),
      width: 120,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (p: ICellRendererParams<StoreTransaction>) => (p.data ? <ViewJsonButton row={p.data} onView={onView} /> : null),
    },
  ]
}
