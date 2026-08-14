import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { SettlementLedgerRow } from '@/core/models/settlement'
import { formatDateTime } from '@/core/util/date-format'
import { entryKindLabel, entryStatusLabel, remainingCell } from './entry-cells'
import { settlementMoney } from './money-display'

/**
 * The cross-estate ledger's grid — the account's columns re-aimed at a result that
 * **spans branches and currencies**.
 *
 * 🔑 **Not `buildAccountColumns` with a parameter.** The two grids share their cells
 * (`entry-cells.ts`, extracted for exactly this pair) and differ in the three things
 * that make them different questions:
 *
 * 1. **The branch is a column here and a heading there.** An account already knows
 *    whose entries it is drawing; a ledger's whole answer is *which branch*.
 * 2. 🚩 **The currency is per ROW, not per grid.** `buildAccountColumns` takes one
 *    `currencyKey` because *"a branch has one currency"* — true, and false of a
 *    result crossing KSA and Bahrain. A single code applied to this grid would draw
 *    a Bahraini branch's `45.750` as `45.75`, losing a fils silently, which is the
 *    exact rounding spec 267 D10 exists to forbid.
 * 3. **No journal count.** `Settlement/Ledger` answers entries and not their
 *    consumptions, so the drilldown affordance would be a column that could only ever
 *    say *"open the account to find out"*. The row click does that instead.
 *
 * ⚠️ **And no total row, on either grid.** Here the reason is sharper than the
 * account's: summing a column that holds riyals and dinars is wrong in both
 * currencies, which is why the row carries its code at all.
 *
 * 🚩 Pure: the words come in as `t`, the rows go in as data. No React, no network.
 */
export function buildLedgerColumns(
  t: TFunction,
  /** Whether the result actually mixes currencies — see the `currencyKey` column. */
  mixedCurrency: boolean,
): ColDef<SettlementLedgerRow>[] {
  return [
    {
      // 🔑 The reason this door exists, so it leads. Monospaced so a column of them
      // scans, and sorted descending by default — newest first, as the server sends.
      headerName: t('account.columns.entryNumber'),
      field: 'entryNumber',
      colId: 'entryNumber',
      width: 110,
      filter: 'agNumberColumnFilter',
      cellClass: 'font-mono text-[12px]',
    },
    {
      headerName: t('ledger.columns.storeId'),
      field: 'storeId',
      colId: 'storeId',
      width: 110,
      cellClass: 'font-mono text-[12px]',
    },
    {
      // ⚠️ The half a code cannot give: *"entry 143 — which branch is that?"* is only
      // answered by a name somebody recognises. It is why the door resolves the master
      // rather than leaving the client to.
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
      // The Arabic rides inside the value — *"Shortage · عجز"* (D9), the same cell the
      // account draws, through the same module.
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
      // 🚩 The ROW's currency. See the module docblock — this is the one line that
      // makes a mixed-currency result honest.
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, number>) =>
        settlementMoney(p.value, p.data?.currencyKey),
    },
    {
      headerName: t('account.columns.remainingAmount'),
      field: 'remainingAmount',
      colId: 'remainingAmount',
      width: 140,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      // 🚩 A CANCELLED entry draws no remaining, though the wire still carries its
      // full figure — the account's rule, in the account's module, because a branch
      // must not be shown owing money the screen has already refused to count.
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, number>) =>
        remainingCell(p.data, p.value, p.data?.currencyKey),
    },
    {
      // ⚠️ Drawn only when the RESULT actually mixes currencies (244 §7's rule): a
      // pure-SAR answer showing SAR on every row is a column of noise, and an answer
      // holding both without one is two different figures rendered as if they were
      // comparable.
      headerName: t('ledger.columns.currencyKey'),
      field: 'currencyKey',
      colId: 'currencyKey',
      width: 110,
      hide: !mixedCurrency,
    },
    {
      headerName: t('account.columns.status'),
      field: 'status',
      colId: 'status',
      width: 150,
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, string>) =>
        entryStatusLabel(t, p.value),
      filterValueGetter: (p) => entryStatusLabel(t, p.data?.status),
    },
    {
      // Free text the BRANCH reads verbatim — server data, unlocalised.
      headerName: t('account.columns.reason'),
      field: 'reason',
      colId: 'reason',
      flex: 1,
      minWidth: 200,
    },
    {
      headerName: t('account.columns.postedByName'),
      field: 'postedByName',
      colId: 'postedByName',
      width: 180,
    },
    {
      headerName: t('account.columns.postedAt'),
      field: 'postedAt',
      colId: 'postedAt',
      width: 160,
      // ⚠️ Local wall clock, rendered as it arrived — no conversion anywhere in this
      // feature (D6).
      valueFormatter: (p: ValueFormatterParams<SettlementLedgerRow, string>) =>
        formatDateTime(p.value),
      // The floating filter matches what is ON SCREEN, not the raw ISO value.
      filterValueGetter: (p) => formatDateTime(p.data?.postedAt),
    },
  ]
}

/** The grid's row identity — the entry's own id, never the row index. */
export function ledgerRowId(p: { data: SettlementLedgerRow }): string {
  return p.data.settlementEntryId
}

/** A closed entry is visibly closed, dimmed rather than tinted — the account grid's
 *  rule, for the same reason: three different endings, none of them a *problem*. */
export function ledgerRowClass(p: { data?: SettlementLedgerRow }): string | undefined {
  return p.data && p.data.status !== 'OPEN' ? 'opacity-60' : undefined
}
