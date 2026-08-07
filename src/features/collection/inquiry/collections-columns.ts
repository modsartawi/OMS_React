import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { CollectionInquiryRow } from '@/core/models/collection'
import { formatMoneyIn } from '@/core/money'
import { formatDateTime, isBlankDate, toIsoDate } from '@/core/util/date-format'

/**
 * The Cash Collections grid's columns (ticket 254), and the shape 255 and 256
 * copy.
 *
 * **Reordered, with a forensic tail behind a toggle.** The WPF shows all 19 of its
 * fields at once; the web leads with identity and money in reading order and folds
 * the rest behind **More columns**. ⚠️ **Nothing is dropped, only folded** — which
 * is not a slogan but the assertion `collections-columns.test.ts` makes and
 * [258](../../../../.issues/258-the-export-writes-a-summable-file.md) leans on:
 * every field on the wire row appears in exactly one of the two groups (or is
 * named, with its reason, in `NON_COLUMN_FIELDS`), and the export writes the
 * union regardless of the toggle.
 *
 * 🚩 The two groups are declared as **field lists**, not inferred from the built
 * `ColDef`s. A ColDef can carry a `colId` instead of a `field`, or two ColDefs can
 * share one — either would let the completeness proof pass while a field went
 * quietly unrendered.
 */

/**
 * The nine columns the supervisor lands on: who and where, then the money, then
 * why it differs (244 §6). Reading order, not the WPF's declaration order.
 */
export const DEFAULT_FIELDS = [
  'collectionReceiptNo',
  'storeId',
  'storeName',
  'collectorName',
  'collectedAt',
  'netCollected',
  'variance',
  'cardTotal',
  'varianceReasonCode',
] as const satisfies readonly (keyof CollectionInquiryRow)[]

/**
 * The forensic tail. The first ten are the WPF's remaining ten, in the ticket's
 * order; the last five are wire fields the WPF grid never showed at all
 * (`retainedFloat`, the closer pair, `salesDate`, `currencyKey`) and which fold in
 * here rather than being dropped — "nothing is dropped" is a statement about the
 * **row**, not about the WPF's column picker.
 */
export const MORE_FIELDS = [
  'openedAt',
  'closedAt',
  'systemCash',
  'countedCash',
  'openingFloat',
  'countedCashNet',
  'cardTransactionCount',
  'varianceReasonText',
  'collectorOperatorId',
  'zReportIds',
  'retainedFloat',
  'closerOperatorId',
  'closerName',
  'salesDate',
  'currencyKey',
] as const satisfies readonly (keyof CollectionInquiryRow)[]

/**
 * The wire fields that are deliberately **not** columns, each with its reason.
 *
 * Exactly one today: `collectionReceiptId` is the receipt's ULID — the document
 * URL's key ([257](../../../../.issues/257-a-row-opens-its-document.md) opens it),
 * opaque, and meaningless to read. It is listed rather than silently skipped so
 * that the completeness test can still prove the row is fully accounted for, and
 * so that a reviewer sees an argued exclusion instead of an oversight.
 */
export const NON_COLUMN_FIELDS = ['collectionReceiptId'] as const satisfies readonly (keyof CollectionInquiryRow)[]

/**
 * Which columns are money, and therefore render through `@/core/money.ts` to the
 * **row's own** currency's decimals — 2 for SAR, 3 for BHD (244 §7).
 *
 * 🚩 `cardTransactionCount` is **not** here: it is a count of slips, not an amount,
 * and formatting it as money would put a `.00` on a number of pieces of paper.
 */
export const MONEY_FIELDS = [
  'netCollected',
  'variance',
  'cardTotal',
  'systemCash',
  'countedCash',
  'openingFloat',
  'countedCashNet',
  'retainedFloat',
] as const satisfies readonly (keyof CollectionInquiryRow)[]

const MONEY = new Set<string>(MONEY_FIELDS)

/**
 * The distinct currencies a result actually holds, upper-cased.
 *
 * The estate is HQ-wide across KSA **and** Bahrain, so a result genuinely can mix
 * — which is the condition 244 §7 attaches to per-cell currency. An empty
 * `currencyKey` is not a currency: counting it as one would strip the header code
 * off a pure-SAR day because of a single old row. (The `loy/member/sales-columns`
 * precedent, arrived at independently for the same reason.)
 */
export function resultCurrencies(rows: readonly CollectionInquiryRow[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const code = row.currencyKey?.trim().toUpperCase()
    if (code) seen.add(code)
  }
  return [...seen]
}

/** Default per-column behaviour. `floatingFilter` is the WPF's `ShowAutoFilterRow`
 *  — ⚠️ **on by default here**, deliberately inverting BBY Inquiry's default: with
 *  an HQ-wide result and only four server filters, the per-column row is how you
 *  find one store's variance without re-querying (244 §6). The toggle still exists
 *  to reclaim the height. */
export function buildCollectionsDefaultColDef(showFilters: boolean): ColDef<CollectionInquiryRow> {
  return {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/** A day-only value that is blank when the server sent its unset sentinel —
 *  `salesDate` really is `0001-01-01` on pre-shift-day rows. */
function dayText(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return isBlankDate(date) ? '' : toIsoDate(date)
}

/**
 * Build the visible columns.
 *
 * `showMore` reveals the forensic tail. The currency handling is the one piece of
 * conditional logic:
 *
 * - **One currency in the result** (the ordinary day) → the code goes in each
 *   money column's **header**, not in every cell (244 §7).
 * - **A mixed result** → the headers stay bare and the `Currency` column is
 *   promoted into the default set even with the toggle off, because a column of
 *   figures in two currencies with the currency folded away is unreadable.
 */
export function buildCollectionsColumns(
  t: TFunction,
  rows: readonly CollectionInquiryRow[],
  showMore: boolean,
): ColDef<CollectionInquiryRow>[] {
  const currencies = resultCurrencies(rows)
  const headerCurrency = currencies.length === 1 ? currencies[0] : ''
  const mixed = currencies.length > 1

  const fields: (keyof CollectionInquiryRow)[] = showMore
    ? [...DEFAULT_FIELDS, ...MORE_FIELDS]
    : mixed
      ? [...DEFAULT_FIELDS, 'currencyKey']
      : [...DEFAULT_FIELDS]

  return fields.map((field) => column(t, field, headerCurrency))
}

function column(
  t: TFunction,
  field: keyof CollectionInquiryRow,
  headerCurrency: string,
): ColDef<CollectionInquiryRow> {
  const label = t(`collections.columns.${field}`)

  if (MONEY.has(field)) {
    return {
      // The currency is stated once, in the header — `Net Collected (SAR)` — rather
      // than repeated down 2,000 cells. Blank when the result mixes currencies.
      headerName: headerCurrency ? t('collections.moneyHeader', { label, currency: headerCurrency }) : label,
      field,
      colId: field,
      width: 140,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      // 🚩 The row's own currency, not the header's: a mixed result must still
      // draw each figure to ITS currency's decimals, and a BHD line rendered at
      // 2 dp is a misstated amount rather than an untidy one.
      valueFormatter: (p: ValueFormatterParams<CollectionInquiryRow, number>) =>
        formatMoneyIn(p.value, p.data?.currencyKey),
    }
  }

  switch (field) {
    case 'collectionReceiptNo':
      return {
        // Per-store `SequentialNumber`. Monospaced so a column of them scans, and
        // left as the number it is — the zero-padded `0000000005` form is the
        // *document's* stamp, composed server-side, not this grid's business.
        headerName: label,
        field,
        colId: field,
        width: 130,
        filter: 'agNumberColumnFilter',
        cellClass: 'font-mono text-[12px]',
      }
    case 'openedAt':
    case 'closedAt':
    case 'collectedAt':
      return {
        headerName: label,
        field,
        colId: field,
        width: 160,
        valueFormatter: (p: ValueFormatterParams<CollectionInquiryRow, string>) =>
          formatDateTime(p.value),
        // 🚩 The floating filter has to match WHAT IS ON SCREEN. The raw value is
        // `2026-08-08T15:40:00`, so typing the `2026-08-08 15:40` the cell shows
        // would find nothing — and with the filter row on by default that is the
        // first thing a supervisor tries. Sorting still uses the raw ISO value,
        // which is what keeps it chronological.
        filterValueGetter: (p) => formatDateTime(p.data?.[field]),
      }
    case 'salesDate':
      return {
        headerName: label,
        field,
        colId: field,
        width: 120,
        valueFormatter: (p: ValueFormatterParams<CollectionInquiryRow, string>) => dayText(p.value),
        filterValueGetter: (p) => dayText(p.data?.salesDate),
      }
    case 'cardTransactionCount':
      return {
        headerName: label,
        field,
        colId: field,
        width: 110,
        type: 'numericColumn',
        filter: 'agNumberColumnFilter',
        cellClass: 'text-end tabular-nums',
      }
    case 'storeName':
    case 'collectorName':
    case 'closerName':
    case 'varianceReasonText':
      return { headerName: label, field, colId: field, width: 180 }
    case 'zReportIds':
      return { headerName: label, field, colId: field, width: 200, cellClass: 'font-mono text-[12px]' }
    default:
      return { headerName: label, field, colId: field, width: 120 }
  }
}
