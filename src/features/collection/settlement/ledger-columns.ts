import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import { formatMoneyIn } from '@/core/money'
import type { SettlementLedgerRow } from '@/core/models/settlement'
import { formatDateTime } from '@/core/util/date-format'
import { entryKindLabel, entryStatusLabel, remainingCell } from './entry-cells'

/**
 * The flat cross-estate ledger's columns (ticket 270).
 *
 * 269's account grid with **two changes**, and both follow from the one difference
 * between the two views: a row here has been torn out of its branch.
 *
 * 1. **The branch is a column**, first after the entry number — on the account it
 *    is the heading, here it is the answer (*"entry 143 is at 0142"*).
 * 2. 🚩 **Money renders at the ROW's currency, not the screen's.** The account has
 *    one branch and therefore one currency; this view holds Bahraini and Saudi
 *    branches on the same page, so a screen-level `currencyKey` would round a
 *    Bahraini branch's fils away on every row (D10). `formatMoneyIn` is called per
 *    row for exactly that reason.
 *
 * ⚠️ Like the account's, this grid computes nothing: no variance, no total row.
 * The report figures under it are sums of like figures, per currency, in
 * `ledger.ts`.
 */
export function buildLedgerColumns(t: TFunction): ColDef<SettlementLedgerRow>[] {
  const money = (p: ValueFormatterParams<SettlementLedgerRow, number | null | undefined>) =>
    formatMoneyIn(p.value, p.data?.currencyKey)

  return [
    {
      headerName: t('account.columns.entryNumber'),
      field: 'entryNumber',
      colId: 'entryNumber',
      width: 110,
      filter: 'agNumberColumnFilter',
      cellClass: 'font-mono text-[12px]',
    },
    {
      headerName: t('ledger.columns.store'),
      field: 'storeId',
      colId: 'storeId',
      width: 110,
      cellClass: 'font-mono text-[12px]',
    },
    {
      headerName: t('ledger.columns.storeName'),
      field: 'storeName',
      colId: 'storeName',
      flex: 1,
      minWidth: 200,
    },
    {
      headerName: t('account.columns.entryKind'),
      field: 'entryKind',
      colId: 'entryKind',
      width: 170,
      // The Arabic rides inside the English value — *"Shortage · عجز"* (D9). Both
      // grids read it through `entry-cells`, so they cannot come to disagree about
      // what a kind or a status means.
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, string>) =>
        entryKindLabel(t, p.value),
      filterValueGetter: (p) => entryKindLabel(t, p.data?.entryKind),
    },
    {
      headerName: t('account.columns.amount'),
      field: 'amount',
      colId: 'amount',
      width: 140,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      valueFormatter: money,
    },
    {
      headerName: t('account.columns.remainingAmount'),
      field: 'remainingAmount',
      colId: 'remainingAmount',
      width: 140,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      // 🚩 A CANCELLED entry keeps its full remaining on the wire (269's finding),
      // so the same refusal the account grid makes is made here — literally the same,
      // through `entry-cells`: a figure nobody owes is not drawn under a Remaining
      // header.
      valueFormatter: (p) => remainingCell(p.data, p.value, p.data?.currencyKey),
    },
    {
      headerName: t('account.columns.status'),
      field: 'status',
      colId: 'status',
      width: 160,
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, string>) =>
        entryStatusLabel(t, p.value),
      filterValueGetter: (p) => entryStatusLabel(t, p.data?.status),
    },
    {
      headerName: t('account.columns.reason'),
      field: 'reason',
      colId: 'reason',
      flex: 1,
      minWidth: 220,
    },
    {
      // 🔑 273's handle, on the row that carries it. An entry posted singly has an
      // empty one and reads as *posted singly* rather than as a blank cell — the
      // same rule this feature applies to an undocumented consumption, and the
      // reason a batch is findable at all: a reader who has an entry can get to the
      // file that posted it, and from there withdraw the whole thing.
      headerName: t('ledger.columns.batchId'),
      field: 'batchId',
      colId: 'batchId',
      width: 150,
      cellClass: 'font-mono text-[12px]',
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, string>) =>
        p.value || t('ledger.columns.postedSingly'),
    },
    {
      headerName: t('account.columns.postedAt'),
      field: 'postedAt',
      colId: 'postedAt',
      width: 160,
      // Local wall clock, rendered as it arrived — no conversion anywhere in this
      // feature (D6).
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, string>) =>
        formatDateTime(p.value),
      filterValueGetter: (p) => formatDateTime(p.data?.postedAt),
    },
  ]
}
