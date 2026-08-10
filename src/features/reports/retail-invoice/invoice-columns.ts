import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { InvoiceCandidate } from '@/core/models/retail-invoice'
import { formatMoneyIn } from '@/core/money'
import { joinDayAndTime } from '@/core/util/date-format'

/**
 * The candidate grid's columns (ticket 264).
 *
 * **Identity first, then the two that answer "is this a real receipt", then the
 * money** (spec 261 §Columns). Every field on the wire row is rendered — the
 * three stored `*Code` ints are named, with their reason, in
 * `NON_COLUMN_FIELDS`, and the completeness test proves the union is the whole
 * row, so a field added to the contract cannot go quietly unrendered.
 *
 * ⚠️ **Copied, not extracted.** `collection/inquiry/collections-columns.ts` is
 * the shape; it is not imported, and nothing here graduates to `core/` — a
 * feature may not import a feature.
 *
 * 🚩 **No floating filter, no paging, no export**, all three inverting what
 * collection's screens do: an exact transaction number is near-unique by
 * construction (contract §3), so there is essentially one row, and there is
 * nothing to filter, page or write out.
 */

/**
 * The wire fields that get a column, in the order they are read.
 *
 * 🚩 `storeCode` leads and **`storeName` follows it as a secondary column** —
 * measured, not assumed. `Store.Description` reads `صيدلية الدواء <storecode>`,
 * the company name with the store number appended, 1508 distinct values over
 * 1540 stores (spec 261 §6.3): it carries no branch identity the code column
 * does not already give. It stays on the row because it is on the wire and
 * hiding a server field to make a point is worse — but the code is what a user
 * reads to know which shop this was.
 */
export const COLUMN_FIELDS = [
  'storeCode',
  'storeName',
  'machineCode',
  'trxNumber',
  'receiptNumber',
  'trxDate',
  'trxType',
  'trxStatus',
  'documentType',
  'amount',
  'itemLinesCount',
  'customerId',
  'customerName',
] as const satisfies readonly (keyof InvoiceCandidate)[]

/**
 * The wire field that is rendered **inside another field's column** rather than
 * in one of its own.
 *
 * 🚩 `trxDate` and `trxTime` arrive as **two raw strings** (`yyyy-MM-dd` +
 * `HH:mm:ss`, contract §6.1) and are **joined for display** into one Date/Time
 * cell (spec 261 §Columns). So the row's 14 fields draw 13 columns, and this
 * list is what keeps that a stated fact rather than a field quietly lost: the
 * completeness test counts it as rendered, because it is.
 *
 * ⚠️ They stay two fields on the wire, and no `Date` is built from them — see
 * `joinDayAndTime`.
 */
export const JOINED_FIELDS = ['trxTime'] as const satisfies readonly (keyof InvoiceCandidate)[]

/**
 * The wire fields that are deliberately **not** rendered at all, each with its
 * reason.
 *
 * All three are the stored ints behind an enum name — `trxTypeCode` 100/110/700,
 * `documentTypeCode`, `trxStatusCode`. The **name** is the column, because the
 * name is what tells an operator a candidate is not a customer receipt, and
 * ⚠️ when no C# member carries a stored code **the server sends the number as
 * the name** anyway (contract §2). So the code is never information the name is
 * missing, and a second column of raw ints beside it would be noise.
 *
 * Listed rather than silently skipped so the completeness test can still prove
 * the row is fully accounted for, and so a reviewer sees an argued exclusion
 * instead of an oversight.
 */
export const NON_COLUMN_FIELDS = [
  'trxTypeCode',
  'documentTypeCode',
  'trxStatusCode',
] as const satisfies readonly (keyof InvoiceCandidate)[]

/**
 * The three fields whose value is a **C# enum identifier, not a label** —
 * `"CashClearance"`, never "Cash clearance" (contract §2).
 *
 * They are prettified through `t()` against `invoice.enums.<field>.<value>`.
 */
export const ENUM_FIELDS = ['trxType', 'trxStatus', 'documentType'] as const

/** The same list as a membership test, so which columns prettify is decided in
 *  ONE place rather than restated as a `case` arm that could drift from it. */
const ENUMS = new Set<string>(ENUM_FIELDS)

/**
 * 🚩 **The wire row carries no currency**, so an amount draws the footprint's
 * default 2 decimals.
 *
 * Stated as a named constant rather than a bare `null` at the call site so the
 * absence is visible: `RetailInvoice/Search` has no currency field (contract
 * §2), and the estate is KSA **and** Bahrain, where BHD is 3 dp. The day the
 * contract grows one, this is the line that changes and `@/core/money` already
 * knows what to do with it — which is exactly why the figure goes through
 * `formatMoneyIn` (currency-aware, graduated at ticket 250) rather than through
 * `number-format`'s fixed-2dp `formatMoney`.
 */
export const INVOICE_AMOUNT_CURRENCY: string | null = null

/**
 * One C# enum identifier, prettified — or **itself**, unchanged, when nothing
 * knows it.
 *
 * 🔑 **The lists are not closed and must not be treated as closed.**
 * `RetailDocumentType` has 18+ members and grows, and when no member carries a
 * stored code the server sends **the number as the name** — so `documentType`
 * genuinely arrives as `"37"`. Falling back to the raw value renders that as
 * `37`; falling back to blank would hide exactly the case the field exists for,
 * on exactly the row someone is trying to explain.
 *
 * The lookup is `t(key, { defaultValue: '' })` and a `''` answer means "no key" —
 * i18next's own miss signal, rather than a hand-rolled `exists()` check that
 * would be a second reading of the same bundle.
 */
export function enumLabel(t: TFunction, field: (typeof ENUM_FIELDS)[number], value: string): string {
  const raw = (value ?? '').trim()
  if (raw === '') return ''
  return t(`invoice.enums.${field}.${raw}`, { defaultValue: '' }) || raw
}

/**
 * Default per-column behaviour.
 *
 * ⚠️ **No `floatingFilter`**, deliberately inverting collection's default: an
 * exact-number search returns essentially one row, and a per-column filter row
 * over one row is height spent on nothing (ticket 264's departure table).
 */
export function buildInvoiceDefaultColDef(): ColDef<InvoiceCandidate> {
  return {
    sortable: true,
    resizable: true,
    filter: false,
    cellDataType: false,
  }
}

/** Build the candidate grid's columns. */
export function buildInvoiceColumns(t: TFunction): ColDef<InvoiceCandidate>[] {
  return COLUMN_FIELDS.map((field) => column(t, field))
}

function column(t: TFunction, field: (typeof COLUMN_FIELDS)[number]): ColDef<InvoiceCandidate> {
  const label = t(`invoice.columns.${field}`)

  if (ENUMS.has(field)) {
    const enumField = field as (typeof ENUM_FIELDS)[number]
    return {
      headerName: label,
      colId: field,
      width: 140,
      // The enum name, prettified — or itself when the list has grown past what
      // this bundle knows. `valueGetter` rather than `valueFormatter` so the
      // prettified text is what sorts, which is what the reader sees.
      valueGetter: (p: ValueGetterParams<InvoiceCandidate>) =>
        enumLabel(t, enumField, p.data?.[enumField] ?? ''),
    }
  }

  switch (field) {
    case 'trxNumber':
      return {
        headerName: label,
        field,
        colId: field,
        width: 170,
        // Monospaced so a column of 14-digit numbers scans, and left exactly as
        // it arrived: it is key part 4 and goes back to Download unmodified.
        cellClass: 'font-mono text-[12px]',
      }
    case 'trxDate':
      return {
        // 🚩 The date column shows the date AND the time — the two raw wire
        // fields joined for display (spec 261 §Columns), which is why it is the
        // date's colId that carries the pair and `trxTime` is not a second
        // column. ⚠️ A string join, never a `Date`: the server does not format
        // by estate convention and the two strings already sort lexically, so
        // reconstructing an instant is the drift the convention exists to
        // prevent. Sorting on the joined string is still chronological.
        headerName: t('invoice.columns.trxDateTime'),
        colId: 'trxDate',
        width: 170,
        valueGetter: (p: ValueGetterParams<InvoiceCandidate>) =>
          joinDayAndTime(p.data?.trxDate, p.data?.trxTime),
      }
    case 'amount':
      return {
        headerName: label,
        field,
        colId: field,
        width: 130,
        type: 'numericColumn',
        cellClass: 'text-end tabular-nums',
        valueFormatter: (p: ValueFormatterParams<InvoiceCandidate, number>) =>
          formatMoneyIn(p.value, INVOICE_AMOUNT_CURRENCY),
      }
    case 'itemLinesCount':
      return {
        headerName: label,
        field,
        colId: field,
        width: 110,
        type: 'numericColumn',
        cellClass: 'text-end tabular-nums',
        // 🚩 No money formatter. It is a count of lines, not an amount, and a
        // `.00` on a number of items is a fact about the receipt that is not
        // true.
      }
    case 'storeName':
    case 'customerName':
      return { headerName: label, field, colId: field, width: 200 }
    default:
      return { headerName: label, field, colId: field, width: 130 }
  }
}
