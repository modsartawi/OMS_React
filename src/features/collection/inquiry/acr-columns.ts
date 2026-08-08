import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { AcrInquiryRow } from '@/core/models/collection'
import { formatMoneyIn } from '@/core/money'
import { formatDateTime, formatDay } from '@/core/util/date-format'

/**
 * The ACRs grid's columns (ticket 255) — 254's column shape, applied to the ACR
 * row.
 *
 * **Reordered, with a forensic tail behind a toggle.** ⚠️ **Nothing is dropped,
 * only folded** — the assertion `acr-columns.test.ts` makes and
 * [258](../../../../.issues/258-the-export-writes-a-summable-file.md) leans on:
 * every field on the wire row appears in exactly one of the two groups (or is
 * named, with its reason, in `NON_COLUMN_FIELDS`).
 *
 * 🚩 **The WPF declares 14 columns; this grid draws 15.** `AcrInquiryView.xaml`
 * shows `AcrNumber` … `DepositStatus` and never shows `depositId`. It folds into
 * the tail here rather than being dropped, for 254's reason: "nothing is dropped"
 * is a statement about the **row**, not about the WPF's column picker. Only
 * `acrId` is withheld, named with its reason.
 */

/**
 * The eight columns the supervisor lands on: which ACR and whose, then when and
 * what state, then the money. Reading order, not the WPF's declaration order.
 */
// ⚠️ `netCollectedTotal` is headed **Net Collected**, not the WPF's own
// `Cash (Deposit)`. Every other header on this grid is the XAML caption verbatim;
// this one is not, because `CONTEXT.md` reserves *deposit* for **the bank end,
// several ACRs later** and this column is Σ NetCollected — cash that left the
// store. The same grid carries three real deposit columns, so the WPF's caption
// would name the banking end twice, meaning two different things.
export const DEFAULT_FIELDS = [
  'acrNumber',
  'label',
  'collectorName',
  'acrDate',
  'status',
  'linkedCollectionCount',
  'netCollectedTotal',
  'cardTotalSum',
] as const satisfies readonly (keyof AcrInquiryRow)[]

/**
 * The forensic tail: the WPF's remaining six, then `depositId` — a wire field the
 * WPF grid never showed, folded in rather than dropped.
 */
export const MORE_FIELDS = [
  'createdAt',
  'closedAt',
  'cardTransactionCountSum',
  'collectorOperatorId',
  'depositNumber',
  'depositStatus',
  'depositId',
] as const satisfies readonly (keyof AcrInquiryRow)[]

/**
 * The wire fields that are deliberately **not** columns, each with its reason.
 *
 * Exactly one: `acrId` is the ACR's ULID — the form URL's key
 * ([257](../../../../.issues/257-a-row-opens-its-document.md) opens
 * `/collection/acr/:acrId` with it), opaque, and meaningless to read. Listed
 * rather than silently skipped so the completeness test can still prove the row
 * is fully accounted for, and so a reviewer sees an argued exclusion instead of
 * an oversight. (Exactly 254's posture on `collectionReceiptId`.)
 */
export const NON_COLUMN_FIELDS = ['acrId'] as const satisfies readonly (keyof AcrInquiryRow)[]

/**
 * Which columns are money, and therefore render through `@/core/money.ts`.
 *
 * 🚩 Neither `cardTransactionCountSum` nor `linkedCollectionCount` is here: they
 * are counts of slips and of receipts, and formatting either as money would put a
 * `.00` on a number of things.
 *
 * ⚠️ **This row carries no `currencyKey`**, so these two draw at the default two
 * decimals with **no code in the header** — the one place this screen cannot
 * honour 244 §7's "the row's own currency's decimals", because the wire has no
 * currency on it to read. `formatMoneyIn` is still what renders them: grouping
 * and **blank rather than `0.00`** are its rules too, and they hold regardless.
 * Logged as a server change in `.afk/HITL-255.md`, never guessed at here.
 */
export const MONEY_FIELDS = [
  'netCollectedTotal',
  'cardTotalSum',
] as const satisfies readonly (keyof AcrInquiryRow)[]

const MONEY = new Set<string>(MONEY_FIELDS)

/** Default per-column behaviour. `floatingFilter` is the WPF's `ShowAutoFilterRow`
 *  — ⚠️ **on by default here**, deliberately inverting BBY Inquiry's default
 *  (244 §6). The toggle still exists to reclaim the height. */
export function buildAcrsDefaultColDef(showFilters: boolean): ColDef<AcrInquiryRow> {
  return {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/**
 * A deposit number that is blank when there is no deposit.
 *
 * 🚩 `0` in a column headed **Deposit No#** reads as *the deposit whose number is
 * zero*; the server's own comment says `Empty/0` means "not yet banked". This is
 * the same misreading 254 blanked `0001-01-01` out of `salesDate` to avoid.
 * ⚠️ `linkedCollectionCount` is deliberately **not** treated this way — an idle
 * ACR really has zero collections, and that is a fact rather than an absence.
 */
function depositNumberText(value: number | null | undefined): string {
  return typeof value === 'number' && value > 0 ? String(value) : ''
}

/** Build the visible columns; `showMore` reveals the forensic tail. */
export function buildAcrsColumns(t: TFunction, showMore: boolean): ColDef<AcrInquiryRow>[] {
  const fields: (keyof AcrInquiryRow)[] = showMore
    ? [...DEFAULT_FIELDS, ...MORE_FIELDS]
    : [...DEFAULT_FIELDS]
  return fields.map((field) => column(t, field))
}

function column(t: TFunction, field: keyof AcrInquiryRow): ColDef<AcrInquiryRow> {
  const label = t(`acrs.columns.${field}`)

  if (MONEY.has(field)) {
    return {
      // No currency in the header, because the row carries no currency. A bare
      // label beats a wrong one — 254's own ruling for a mixed result, arrived at
      // here for the harder reason that there is nothing on the wire to state.
      headerName: label,
      field,
      colId: field,
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      valueFormatter: (p: ValueFormatterParams<AcrInquiryRow, number>) =>
        formatMoneyIn(p.value, undefined),
    }
  }

  switch (field) {
    case 'acrNumber':
      return {
        // The serial a supervisor holds in their hand. Monospaced so a column of
        // them scans, and left as the number it is.
        headerName: label,
        field,
        colId: field,
        width: 110,
        filter: 'agNumberColumnFilter',
        cellClass: 'font-mono text-[12px]',
      }
    case 'acrDate':
      return {
        headerName: label,
        field,
        colId: field,
        width: 120,
        valueFormatter: (p: ValueFormatterParams<AcrInquiryRow, string>) => formatDay(p.value),
        filterValueGetter: (p) => formatDay(p.data?.acrDate),
      }
    case 'createdAt':
    case 'closedAt':
      return {
        headerName: label,
        field,
        colId: field,
        width: 160,
        // ⚠️ `closedAt` is `0001-01-01` while the ACR is still OPEN — the server's
        // `DateTime` is not nullable — so a still-open ACR shows a blank Closed
        // cell rather than a year-1 date.
        valueFormatter: (p: ValueFormatterParams<AcrInquiryRow, string>) => formatDateTime(p.value),
        // 🚩 The floating filter has to match WHAT IS ON SCREEN: the raw value is
        // `2026-08-08T15:40:00`, so typing the `2026-08-08 15:40` the cell shows
        // would otherwise find nothing. Sorting still uses the raw ISO value.
        filterValueGetter: (p) => formatDateTime(p.data?.[field]),
      }
    case 'depositNumber':
      return {
        headerName: label,
        field,
        colId: field,
        width: 130,
        type: 'numericColumn',
        cellClass: 'text-end tabular-nums',
        valueFormatter: (p: ValueFormatterParams<AcrInquiryRow, number>) =>
          depositNumberText(p.value),
        filterValueGetter: (p) => depositNumberText(p.data?.depositNumber),
      }
    case 'linkedCollectionCount':
    case 'cardTransactionCountSum':
      return {
        headerName: label,
        field,
        colId: field,
        width: 120,
        type: 'numericColumn',
        filter: 'agNumberColumnFilter',
        cellClass: 'text-end tabular-nums',
      }
    case 'label':
    case 'collectorName':
      return { headerName: label, field, colId: field, width: 180 }
    case 'depositId':
      return { headerName: label, field, colId: field, width: 200, cellClass: 'font-mono text-[12px]' }
    default:
      return { headerName: label, field, colId: field, width: 120 }
  }
}
