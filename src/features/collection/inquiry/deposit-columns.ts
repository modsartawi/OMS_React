import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { DepositInquiryRow } from '@/core/models/collection'
import { formatMoneyIn } from '@/core/money'
import { formatDateTime } from '@/core/util/date-format'

/**
 * The Deposits grid's columns (ticket 256) — 254's column shape, applied to the
 * deposit row.
 *
 * **Reordered, with a forensic tail behind a toggle.** ⚠️ **Nothing is dropped,
 * only folded** — the assertion `deposit-columns.test.ts` makes and
 * [258](../../../../.issues/258-the-export-writes-a-summable-file.md) leans on:
 * every field on the wire row appears in exactly one of the two groups (or is
 * named, with its reason, in `NON_COLUMN_FIELDS`).
 *
 * 🚩 The two groups are declared as **field lists**, not inferred from the built
 * `ColDef`s, for 254's reason: a ColDef can carry a `colId` instead of a `field`,
 * or two can share one — either would let the completeness proof pass while a
 * field went quietly unrendered.
 */

/**
 * The nine columns the accountant lands on: which deposit and whose, then where
 * and what state, then the three money figures and why they differ. Reading order,
 * not the WPF's declaration order.
 */
export const DEFAULT_FIELDS = [
  'depositNumber',
  'depositedAt',
  'collectorName',
  'bankName',
  'status',
  'calculatedAmount',
  'realAmount',
  'diffAmount',
  'reasonCode',
] as const satisfies readonly (keyof DepositInquiryRow)[]

/**
 * The forensic tail: when the record was written, the two codes behind the two
 * resolved names, the free-text note, and the whole void trail.
 */
export const MORE_FIELDS = [
  'createdAt',
  'collectorOperatorId',
  'bankCode',
  'noteText',
  'voidedBy',
  'voidedAt',
  'voidReason',
] as const satisfies readonly (keyof DepositInquiryRow)[]

/**
 * The wire fields that are deliberately **not** columns, each with its reason.
 *
 * - `depositId` — the deposit's ULID: opaque, meaningless to read, and unlike the
 *   receipt's and the ACR's it does not even key a document, because ⚠️ **Deposit
 *   Inquiry has no printable document** (the WPF `DepositInquiry` folder has no
 *   form/printer pair). It is the row's identity and nothing else.
 * - `lines` and `attachments` — 🚩 the two fields that make this screen the one in
 *   the suite that is not a flat list. A cell cannot hold a list, and folding them
 *   into a `More columns` group would be pretending they are cells. They render in
 *   the **stacked detail region** beneath the grid instead, out of the same
 *   response, which is exactly what a modal was rejected in favour of.
 *
 * Listed rather than silently skipped so the completeness test can still prove the
 * row is fully accounted for, and so a reviewer sees an argued exclusion instead
 * of an oversight.
 */
export const NON_COLUMN_FIELDS = [
  'depositId',
  'lines',
  'attachments',
] as const satisfies readonly (keyof DepositInquiryRow)[]

/**
 * Which columns are money, and therefore render through `@/core/money.ts`.
 *
 * ⚠️ **This row carries no `currencyKey`**, exactly as `AcrInquiryRow` does not, so
 * these three draw at the default two decimals with **no code in the header** —
 * the client cannot state a currency that is not on the wire. `formatMoneyIn` is
 * still what renders them: grouping and **blank rather than `0.00`** for a missing
 * figure are its rules too, and they hold regardless. Logged as a server change in
 * `.afk/HITL-256.md`, never guessed at here.
 */
export const MONEY_FIELDS = [
  'calculatedAmount',
  'realAmount',
  'diffAmount',
] as const satisfies readonly (keyof DepositInquiryRow)[]

const MONEY = new Set<string>(MONEY_FIELDS)

/** Default per-column behaviour. `floatingFilter` is the WPF's `ShowAutoFilterRow`
 *  — ⚠️ **on by default here**, deliberately inverting BBY Inquiry's default
 *  (244 §6). The toggle still exists to reclaim the height. */
export function buildDepositsDefaultColDef(showFilters: boolean): ColDef<DepositInquiryRow> {
  return {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/** Build the visible columns; `showMore` reveals the forensic tail. */
export function buildDepositsColumns(t: TFunction, showMore: boolean): ColDef<DepositInquiryRow>[] {
  const fields: (keyof DepositInquiryRow)[] = showMore
    ? [...DEFAULT_FIELDS, ...MORE_FIELDS]
    : [...DEFAULT_FIELDS]
  return fields.map((field) => column(t, field))
}

function column(t: TFunction, field: keyof DepositInquiryRow): ColDef<DepositInquiryRow> {
  const label = t(`deposits.columns.${field}`)

  if (MONEY.has(field)) {
    return {
      headerName: label,
      field,
      colId: field,
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellClass: 'text-end tabular-nums',
      valueFormatter: (p: ValueFormatterParams<DepositInquiryRow, number>) =>
        formatMoneyIn(p.value, undefined),
    }
  }

  switch (field) {
    case 'depositNumber':
      return {
        // The serial an accountant holds in their hand. Monospaced so a column of
        // them scans, and left as the number it is.
        headerName: label,
        field,
        colId: field,
        width: 120,
        filter: 'agNumberColumnFilter',
        cellClass: 'font-mono text-[12px]',
      }
    case 'depositedAt':
    case 'createdAt':
    case 'voidedAt':
      return {
        headerName: label,
        field,
        colId: field,
        width: 160,
        // ⚠️ `voidedAt` is `0001-01-01` on a deposit that was never voided — the
        // server's `DateTime` is not nullable — so a live deposit shows a blank
        // Voided cell rather than a year-1 date.
        valueFormatter: (p: ValueFormatterParams<DepositInquiryRow, string>) =>
          formatDateTime(p.value),
        // 🚩 The floating filter has to match WHAT IS ON SCREEN: the raw value is
        // `2026-08-08T11:20:00`, so typing the `2026-08-08 11:20` the cell shows
        // would otherwise find nothing. Sorting still uses the raw ISO value.
        filterValueGetter: (p) => formatDateTime(p.data?.[field]),
      }
    case 'collectorName':
    case 'bankName':
    case 'noteText':
    case 'voidReason':
      return { headerName: label, field, colId: field, width: 180 }
    default:
      return { headerName: label, field, colId: field, width: 120 }
  }
}
