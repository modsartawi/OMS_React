import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import { formatMoneyIn } from '@/core/money'
import { formatDateTime } from '@/core/util/date-format'
import type { AccountEntryRow } from './account-projection'
import { entryKindLabel, entryStatusLabel, remainingCell } from './entry-cells'

/**
 * The branch account's entries grid (ticket 269) — 254's column shape applied to a
 * settlement entry.
 *
 * The eight columns are the ticket's own list, in its own order: *number, kind,
 * amount, remaining, reason, status, posted by / at*. The ninth — the journal count
 * — is the **affordance for the drilldown**: an entry with four consumptions behind
 * it and an entry with none look identical until the row is opened, and a reader
 * cannot be expected to click every row to find out which is which.
 *
 * ⚠️ **Nothing here computes a variance** (spec D3, the ticket's rule 3). Both money
 * columns render a figure the server sent; neither subtracts the other, and the
 * grid has no total row. A settlement receipt carries `SystemCashTotal = 0`, so a
 * cross-kind difference reads as a full overage — the rule is written at the file a
 * "helpful" Consumed column would be added to.
 */

/**
 * `currencyKey` is the **account's**, not the row's (spec D10).
 *
 * A branch has one currency and a settlement entry carries none, so it is passed in
 * once rather than read per row — which is also the only shape in which a Bahraini
 * branch can draw at three decimals while the other five draw at two.
 */
export function buildAccountColumns(
  t: TFunction,
  currencyKey: string,
): ColDef<AccountEntryRow>[] {
  const money = (value: number | null | undefined) => formatMoneyIn(value, currencyKey)

  return [
    {
      // The phone-call reference — *"entry 143"* — and the only id a human quotes.
      // Monospaced so a column of them scans.
      headerName: t('account.columns.entryNumber'),
      field: 'entryNumber',
      colId: 'entryNumber',
      width: 110,
      filter: 'agNumberColumnFilter',
      cellClass: 'font-mono text-[12px]',
    },
    {
      headerName: t('account.columns.entryKind'),
      field: 'entryKind',
      colId: 'entryKind',
      width: 170,
      // 🚩 The Arabic rides INSIDE the English namespace's value — *"Shortage ·
      // عجز"* (spec D9). عجز and فائض are domain vocabulary, not a translation, and
      // they are what the branch's own till screen says; a second locale would be
      // the wrong tool for a word this app needs in one language at a time.
      valueFormatter: (p: ValueFormatterParams<AccountEntryRow, string>) =>
        entryKindLabel(t, p.value),
      // The filter row has to match what is on screen, not the wire's enum.
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
      valueFormatter: (p: ValueFormatterParams<AccountEntryRow, number>) => money(p.value),
    },
    {
      headerName: t('account.columns.remainingAmount'),
      // 🚩 `displayRemaining`, not `remainingAmount` — a CANCELLED entry keeps its
      // full figure on the wire, and drawing it here would claim a branch owes money
      // the headline has already (correctly) refused to count. See the projection.
      field: 'displayRemaining',
      colId: 'remainingAmount',
      width: 140,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      valueFormatter: (p: ValueFormatterParams<AccountEntryRow, number | null>) =>
        remainingCell(p.data, p.value, currencyKey),
    },
    {
      // Free text the BRANCH reads verbatim at a till — server data, so it passes
      // through unlocalised. Wide, because it is a sentence and not a code.
      headerName: t('account.columns.reason'),
      field: 'reason',
      colId: 'reason',
      flex: 1,
      minWidth: 240,
    },
    {
      headerName: t('account.columns.status'),
      field: 'status',
      colId: 'status',
      width: 150,
      // ⚠️ "Closed visibly closed" starts here: each status gets its own sentence,
      // and CLOSED_OUT reads as **written off** rather than as consumed — a
      // different fact about where the money went, and the one the branch will ask
      // about. The row's own dimming (see `BranchAccount`) is the second half.
      valueFormatter: (p: ValueFormatterParams<AccountEntryRow, string>) =>
        entryStatusLabel(t, p.value),
      filterValueGetter: (p) => entryStatusLabel(t, p.data?.status),
    },
    {
      headerName: t('account.columns.postedByName'),
      field: 'postedByName',
      colId: 'postedByName',
      width: 200,
    },
    {
      headerName: t('account.columns.postedAt'),
      field: 'postedAt',
      colId: 'postedAt',
      width: 160,
      // ⚠️ Local wall clock, rendered as it arrived. No timezone conversion happens
      // anywhere in this feature (spec D6).
      valueFormatter: (p: ValueFormatterParams<AccountEntryRow, string>) =>
        formatDateTime(p.value),
      // The floating filter has to match WHAT IS ON SCREEN: the raw value is
      // `2026-08-09T11:14:00`, so typing the `2026-08-09 11:14` the cell shows would
      // otherwise find nothing. Sorting still uses the raw value.
      filterValueGetter: (p) => formatDateTime(p.data?.postedAt),
    },
    {
      // The drilldown's affordance. A count, not a chevron: it says both *there is
      // something here* and *how much of it*, which is the difference between a
      // one-row journal and 0455's four.
      headerName: t('account.columns.journalCount'),
      field: 'journalCount',
      colId: 'journalCount',
      width: 150,
      type: 'numericColumn',
      // ⚠️ **No `filterValueGetter` here**, deliberately: it is a count, and a
      // number filter has to receive a number. A string getter feeding
      // `agNumberColumnFilter` reaches the scalar comparator uncoerced, at which
      // point `equals 4` matches nothing and `lessThan 4` matches everything —
      // a filter that is confidently wrong rather than merely unhelpful.
      filter: 'agNumberColumnFilter',
      // 🔑 Rule 1 at the ENTRY level. The journal names an undocumented consumption
      // in words, but a reader would have to open every entry to find which one has
      // it — so the count carries the flag too, and the cell says so in its own ink.
      // Without this the entry-level half of the rule is invisible until 270's
      // *wrong money* lane arrives.
      cellClass: (p) =>
        `text-end tabular-nums${p.data?.hasOrphan ? ' font-medium text-attention-800' : ''}`,
      // An entry no till has touched says so in words rather than showing a `0` a
      // reader has to interpret — the same instinct as rule 1 one column over.
      valueFormatter: (p: ValueFormatterParams<AccountEntryRow, number>) =>
        p.data?.hasOrphan
          ? t('account.columns.journalWithOrphan', { count: p.value ?? 0 })
          : p.value
            ? String(p.value)
            : t('account.journal.none'),
    },
  ]
}

/** Default per-column behaviour. `floatingFilter` is the WPF's `ShowAutoFilterRow`
 *  — on by default here, as on all four neighbours (244 §6). */
export function buildAccountDefaultColDef(showFilters: boolean): ColDef<AccountEntryRow> {
  return {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/**
 * The one thing the grid says about a row without being asked: **a closed entry is
 * visibly closed** (the ticket's words).
 *
 * Dimmed rather than coloured, and deliberately so: `CONSUMED`, `CANCELLED` and
 * `CLOSED_OUT` are three different endings and none of them is a *problem*, so a
 * severity tint would be shouting. What the reader needs is to be able to see, at a
 * glance down the column, which entries are still live — and the status column
 * still says which ending each closed one had.
 */
export function accountRowClass(p: { data?: AccountEntryRow }): string | undefined {
  return p.data && !p.data.isOpen ? 'opacity-60' : undefined
}

/** The grid's row identity — a settlement entry's own id, never the row index, so
 *  a refetch that reorders cannot move the journal out from under a selection. */
export function accountRowId(p: { data: AccountEntryRow }): string {
  return p.data.settlementEntryId
}
