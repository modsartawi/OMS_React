import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { CollectionInquiryRow } from '@/core/models/collection'
import { distinctCurrencies, formatMoneyIn } from '@/core/money'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { slipCountColumn } from './SlipCountColumn'
import { withSlipColumn, type SlipDay } from './slips'

/**
 * The Cash Collections grid's columns (ticket 254), and the shape 255 and 256
 * copy.
 *
 * **Finance's sheet, with a forensic tail behind a toggle.** The WPF shows all 19 of
 * its fields at once; the web leads with the columns of finance's sheet (ticket
 * 335) and folds the rest behind **More columns**. ⚠️ **Nothing is dropped, only folded** — which
 * is not a slogan but the assertion `collections-columns.test.ts` makes: every
 * field on the wire row appears in exactly one of the two groups (or is named,
 * with its reason, in `NON_COLUMN_FIELDS`). The export is the grid as shown
 * (ticket 336), so a folded column is in the file when the toggle is on.
 *
 * 🚩 The two groups are declared as **field lists**, not inferred from the built
 * `ColDef`s. A ColDef can carry a `colId` instead of a `field`, or two ColDefs can
 * share one — either would let the completeness proof pass while a field went
 * quietly unrendered.
 */

/**
 * **Saud's order** (spec 2423, ticket 423): the 31 headers of finance's
 * `collection-collections- Sortable.xlsx`, verbatim and in order. The first 13,
 * Receipt No# through Business Date, are the columns the accountant lands on; the
 * other 18 follow behind **More columns** in the same sheet order (`MORE_FIELDS`).
 * Each header is an existing field and its existing `collections.columns.*` label —
 * no field is added. The order is the sheet's, not a reading order of ours.
 *
 * 🚩 **Collector is the collector's id** (`collectorOperatorId`) and Collector
 * Name its own column right after it (both default since 2423).
 *
 * 🚩 **Profit Center** is the raw `profitCenter` (`PH-019`), not `storeText`: the
 * composed `PH-019 (P019)` is the sheet's last column, *Profit Center (Store)*.
 *
 * 🚩 **Sales Date** (`salesDate`) is the sheet's fourth column — the receipt's
 * voucher denormal, blank (year 1) on a settlement row. *Business Date* is still
 * `businessDay`, the day the toolbar's business range filters on.
 *
 * 🚩 **No column here carries a sort.** The server sends the rows in finance's
 * order (collection date, store, business date) and the grid shows them as
 * received; a header click is the user's own sort.
 */
export const DEFAULT_FIELDS = [
  'collectionReceiptNo',
  'storeId',
  'profitCenter',
  'salesDate',
  'amount',
  'surplus',
  'netCollected',
  'collectorOperatorId',
  'collectorName',
  'collectionType',
  'description',
  'collectedAt',
  'businessDay',
] as const satisfies readonly (keyof CollectionInquiryRow)[]

/**
 * The tail behind **More columns**: Saud's columns 14–31, in the sheet's order.
 * "Nothing is dropped" is a statement about the **row**, not about the sheet — the
 * wire fields no column shows are argued one by one in `NON_COLUMN_FIELDS`.
 *
 * 🚩 Saud's **Card Slips** (24th) is `cardTransactionCount`, the count of card
 * slips the till recorded — the field whose label that header already was. The
 * slip-probe count (`SLIP_FIELDS`, the attached slip images) is a different
 * figure, drawn only for a session that may see slips, and placed right after it.
 */
export const MORE_FIELDS = [
  'storeName',
  'variance',
  'cardTotal',
  'varianceReasonCode',
  'openedAt',
  'closedAt',
  'systemCash',
  'countedCash',
  'openingFloat',
  'countedCashNet',
  'cardTransactionCount',
  'varianceReasonText',
  'zReportIds',
  'retainedFloat',
  'closerOperatorId',
  'closerName',
  'currencyKey',
  'storeText',
] as const satisfies readonly (keyof CollectionInquiryRow)[]

/**
 * The column the slip probe gates (ticket 320, BackOffice 2034): drawn only when
 * `AttachmentWeb/Access` holds `CASH_CLOSE`, right after Saud's *Card Slips*
 * (`cardTransactionCount`, `COLLECTIONS_SLIP_ANCHOR`) since spec 2423. That column is in the
 * tail, so with the tail folded the count is the last column. Drawn or not, the
 * 31 sheet columns keep their order around it.
 *
 * 🚩 Its own group rather than a member of the two above: a count the session may
 * not see is not drawn, and so — the export being the grid as shown (ticket 336) —
 * does not leave in its file either. The completeness proof still accounts for it.
 * Each row's count is keyed by that row's OWN `businessDay`: the rows of one
 * multi-shift receipt are drawn as sent, never merged or summed.
 */
export const SLIP_FIELDS = ['slipCount'] as const satisfies readonly (keyof CollectionInquiryRow)[]

/** The column the slip count follows on this grid: Saud's *Card Slips*. */
export const COLLECTIONS_SLIP_ANCHOR = 'cardTransactionCount' satisfies keyof CollectionInquiryRow

/**
 * The wire fields that are deliberately **not** columns, each with its reason. They
 * are listed rather than silently skipped so that the completeness test can still
 * prove the row is fully accounted for, and so that a reviewer sees an argued
 * exclusion instead of an oversight.
 *
 * - `collectionReceiptId` is the receipt's ULID — the document URL's key
 *   ([257](../../../../.issues/257-a-row-opens-its-document.md) opens it), opaque,
 *   and meaningless to read.
 * - `hasSurplus`, `hasTheft`, `isSettlement` and `isOffSystem` are what the server
 *   builds the Type label from. The Type column already says them, and a column
 *   beside it would invite reading the label back out of its parts.
 * - The rest were on the wire before ticket 335, which declared them on the model
 *   and asked for no column (the owner's call — `.afk/HITL-335.md`):
 *   - `cashSales`, `settlement` and `theftAmount` are what *Amount* and *Surplus* are
 *     built from, and `settlementDescription` is the raw copy behind *Description* —
 *     a second set of near-identical figures beside finance's.
 *   - `settlementAdjustmentTotal`, `settlementEntryNumber` and the `shift…` pair
 *     (and `shiftCardTotal`) restate the receipt's deduction and card total for one
 *     shift — the voucher's detail, which the receipt document already prints.
 *   - `receiptKind` and `collectionStatus` are what *Type* says in finance's words
 *     (`Short`, `Outside system`).
 *   - `zNumber`, `amendmentCount`, `lastAmendedBy` and the four `offSystem…` fields
 *     are audit detail no grid of this screen has shown; each would need a header
 *     nobody has ruled on.
 */
export const NON_COLUMN_FIELDS = [
  'collectionReceiptId',
  'hasSurplus',
  'hasTheft',
  'isSettlement',
  'isOffSystem',
  'theftAmount',
  'cashSales',
  'settlement',
  'settlementAdjustmentTotal',
  'settlementEntryNumber',
  'settlementDescription',
  'shiftSettlementAdjustment',
  'shiftSettlementEntryNumber',
  'shiftCardTotal',
  'receiptKind',
  'collectionStatus',
  'offSystemAt',
  'offSystemBy',
  'offSystemReasonCode',
  'offSystemReasonText',
  'zNumber',
  'amendmentCount',
  'lastAmendedBy',
] as const satisfies readonly (keyof CollectionInquiryRow)[]

/**
 * Which columns are money, and therefore render through `@/core/money.ts` to the
 * **row's own** currency's decimals — 2 for SAR, 3 for BHD (244 §7).
 *
 * 🚩 `surplus` is drawn **as sent**: the server sends the deductions as a negative
 * figure and a zero when there are none, and `formatMoneyIn` draws a real zero as
 * `0.00`, never blank.
 *
 * 🚩 `cardTransactionCount` is **not** here: it is a count of slips, not an amount,
 * and formatting it as money would put a `.00` on a number of pieces of paper.
 */
export const MONEY_FIELDS = [
  'amount',
  'surplus',
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
 * The distinct currencies a result actually holds, upper-cased — the condition
 * 244 §7 attaches to per-cell currency.
 *
 * The rule itself (and the 🚩 about a blank currency not being a second one)
 * lives in `@/core/money`: this screen and the Loy member screen wrote it
 * independently, and it graduated up on that second consumer. All that is
 * feature-local is which field on the wire carries the code.
 */
export function resultCurrencies(rows: readonly CollectionInquiryRow[]): string[] {
  return distinctCurrencies(rows, (row) => row.currencyKey)
}

/** Default per-column behaviour. `floatingFilter` is the WPF's `ShowAutoFilterRow`
 *  — ⚠️ **on by default here**, deliberately inverting BBY Inquiry's default: with
 *  an HQ-wide result and only four server filters, the per-column row is how you
 *  find one store's variance without re-querying (244 §6). The toggle still exists
 *  to reclaim the height. */
export function buildCollectionsDefaultColDef(showFilters: boolean): ColDef<CollectionInquiryRow> {
  return {
    ...OMS_GRID_BASE_COL_DEF,
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/**
 * Build the visible columns.
 *
 * `showMore` reveals the tail; `showSlips` (the slip probe's answer,
 * fail-closed) places the Slips column after `COLLECTIONS_SLIP_ANCHOR`, and `onOpenSlips` makes a
 * known count open that row's own store day in the drawer (ticket 321). The currency
 * handling is the one piece of
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
  showSlips = false,
  onOpenSlips?: (day: SlipDay) => void,
): ColDef<CollectionInquiryRow>[] {
  const currencies = resultCurrencies(rows)
  const headerCurrency = currencies.length === 1 ? currencies[0] : ''
  const mixed = currencies.length > 1

  const fields: (keyof CollectionInquiryRow)[] = showMore
    ? [...DEFAULT_FIELDS, ...MORE_FIELDS]
    : mixed
      ? [...DEFAULT_FIELDS, 'currencyKey']
      : [...DEFAULT_FIELDS]

  return withSlipColumn(fields, showSlips, COLLECTIONS_SLIP_ANCHOR).map((field) =>
    field === 'slipCount' ? slipCountColumn<CollectionInquiryRow>(t, onOpenSlips) : column(t, field, headerCurrency),
  )
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
    case 'businessDay':
    case 'salesDate':
      return {
        headerName: label,
        field,
        colId: field,
        width: 120,
        valueFormatter: (p: ValueFormatterParams<CollectionInquiryRow, string>) => formatDay(p.value),
        // The date part only; `null` (a settlement receipt, a pre-049 day) and the
        // year-1 sentinel both render blank, never 0001-01-01.
        filterValueGetter: (p) => formatDay(p.data?.[field]),
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
    case 'profitCenter':
    case 'storeText':
      // As the server sent it — no valueFormatter, by ruling (BackOffice 1990).
      // Ready's width, so the one column reads alike on the three grids.
      return { headerName: label, field, colId: field, width: 170 }
    case 'collectionType':
      // 🚩 Finance's words, exactly as the server sent them (BackOffice 2151, 2152):
      // `Regular`, `Short`, `Regular+Surplus`, `Regular+Stolen`,
      // `Regular+Surplus+Stolen`, `Outside system`. No valueGetter and no
      // valueFormatter — the label is not derived here and not translated.
      return { headerName: label, field, colId: field, width: 190 }
    case 'description':
      // As sent: two entries' descriptions arrive joined (`A | B`) and stay joined.
      return { headerName: label, field, colId: field, width: 240 }
    case 'storeName':
    case 'collectorName':
    case 'closerName':
    case 'varianceReasonText':
      return { headerName: label, field, colId: field, width: 180 }
    case 'zReportIds':
      return { headerName: label, field, colId: field, width: 200, cellClass: 'font-mono text-[12px]' }
    case 'storeId':
      // A store code is an ID: Plex Mono (spec 380, 359).
      return { headerName: label, field, colId: field, width: 120, cellClass: 'font-mono' }
    default:
      return { headerName: label, field, colId: field, width: 120 }
  }
}
