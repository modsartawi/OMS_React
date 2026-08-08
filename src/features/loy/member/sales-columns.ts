import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { LoySalesRow } from '@/core/models/loy'
import { distinctCurrencies, formatMoneyIn } from '@/core/money'
import { formatShortDate } from '@/core/util/date-format'

/**
 * The Sales tab's eight columns, plus a conditional ninth (ticket 237, settled
 * by 226 §4).
 *
 * **Item is the headline** — "what did they buy" is answered by scanning one
 * column, so the description is the flexing column and everything else is sized
 * around it.
 *
 * Three source facts this file renders faithfully rather than tidily:
 *
 * - 🚩 **Date-only, never a stamp.** `TrxTime` is a separate column the report
 *   does not select, so a `HH:mm` here would be a fabricated `00:00` on every
 *   row, implying a midnight purchase the data never claimed.
 * - 🚩 **`qty` and `amount` are signed on a return; `unitPrice` is not.** A
 *   return line reads `-1.00 · 12.00 · -12.00`. Matching the receipt beats
 *   tidying it, so no column forces or strips a sign.
 * - 🚩 **Money is multi-currency.** Each figure formats per **its own row's**
 *   currency through `@/core/money`'s `formatMoneyIn` — 2 dp for SAR, 3 for BHD.
 *   The app's `formatMoney` is fixed at 2 dp and stays that way.
 *
 * 🚩 **Nothing on this tab is summed, and nothing may be** — the report selects
 * no exchange rate, so a total over a mixed-currency window would be an addition
 * of unlike things. There is no total row and no `aggFunc` anywhere below.
 *
 * **Sort and filter are on**, as on Activities and for the same reason: the
 * whole 500-line window is already in the browser and the caption above the grid
 * says which window it is, so sorting reorders the *result* and not a page. On
 * 500 lines a filter is the difference between answering "did they ever buy X"
 * and scrolling.
 *
 * 🚩 **No row links.** No route accepts a retail transaction number, and
 * `oms/document/:documentNo` is a different identifier space that would 404 on
 * every row (226 §9).
 */
export const SALES_DEFAULT_COL_DEF: ColDef<LoySalesRow> = {
  sortable: true,
  filter: true,
  resizable: true,
  cellDataType: false,
}

/**
 * The distinct currencies a fetched window actually holds, upper-cased.
 *
 * The rule (and the 🚩 about a blank currency not being a second one) lives in
 * `@/core/money`: this screen and the collection screens wrote it independently,
 * and it graduated up on that second consumer at ticket 254's review. All that
 * is feature-local is which field on the wire carries the code.
 */
export function salesCurrencies(rows: readonly LoySalesRow[]): string[] {
  return distinctCurrencies(rows, (row) => row.currency)
}

/**
 * The columns for one fetched window.
 *
 * 🚩 **The Currency column appears iff the rows hold MORE THAN ONE distinct
 * currency.** The SAR-only member — the overwhelming case — spends no width on a
 * constant; the Bahrain member has the currency stated rather than implied. It
 * is derived from the rows on screen rather than from the member, because the
 * member has no currency: their lines do.
 */
export function buildSalesColumns(t: TFunction, rows: readonly LoySalesRow[]): ColDef<LoySalesRow>[] {
  const money = (p: ValueFormatterParams<LoySalesRow, number>) =>
    formatMoneyIn(p.value, p.data?.currency)

  const columns: ColDef<LoySalesRow>[] = [
    {
      headerName: t('tabs.sales.columns.date'),
      field: 'trxDate',
      width: 120,
      // 🚩 `formatShortDate`, not `formatDateTime` — see the date note above.
      valueFormatter: (p: ValueFormatterParams<LoySalesRow, string>) => formatShortDate(p.value),
    },
    {
      // Plain selectable text — the receipt number leads nowhere (no-links note).
      headerName: t('tabs.sales.columns.receipt'),
      field: 'trxNumber',
      width: 140,
      cellClass: 'font-mono text-[12px]',
    },
    {
      // A bare code. The report joins no store name and the door carries no
      // lookup, so the label says "code" and the cell shows one (229).
      headerName: t('tabs.sales.columns.store'),
      field: 'storeCode',
      width: 100,
    },
    {
      headerName: t('tabs.sales.columns.itemNumber'),
      field: 'itemNumber',
      width: 120,
      cellClass: 'font-mono text-[12px]',
    },
    {
      // 🚩 The headline. Server-supplied English joined from `Item.Description`:
      // data, not a literal, so it passes through untranslated.
      headerName: t('tabs.sales.columns.item'),
      colId: 'item',
      field: 'itemDescription',
      flex: 1,
      minWidth: 220,
    },
    {
      headerName: t('tabs.sales.columns.qty'),
      field: 'qty',
      width: 100,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      // Signed on a return, and always two decimals — a fractional quantity is
      // ordinary in a pharmacy basket, and trimming zeros would ragged the
      // column. Not currency-aware: a quantity is not money.
      valueFormatter: (p: ValueFormatterParams<LoySalesRow, number>) => formatQty(p.value),
    },
    {
      headerName: t('tabs.sales.columns.unitPrice'),
      field: 'unitPrice',
      width: 120,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      // 🚩 Unsigned even on a return line, because the source is. Nothing here
      // re-derives it from the amount.
      valueFormatter: money,
    },
    {
      headerName: t('tabs.sales.columns.amount'),
      field: 'amount',
      width: 130,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums font-medium',
      valueFormatter: money,
    },
  ]

  if (salesCurrencies(rows).length > 1) {
    columns.push({
      headerName: t('tabs.sales.columns.currency'),
      colId: 'currency',
      field: 'currency',
      width: 110,
    })
  }

  return columns
}

/**
 * A quantity as the column draws it: **exactly two decimals**, grouped, and
 * carrying the value's own sign so a return reads `-1.00` against a sale's
 * `2.00`. A missing quantity renders blank rather than as a zero that would read
 * as a fact about the line.
 */
export function formatQty(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
