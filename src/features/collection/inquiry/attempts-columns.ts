import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { CollectionAttemptRow } from '@/core/models/collection'
import { formatDateTime, formatDay } from '@/core/util/date-format'

/**
 * The Collection Attempts grid's columns (ticket 255) — 254's column shape,
 * applied to the smallest row in the suite.
 *
 * All **nine** the WPF declares, split five/four: ⚠️ **nothing is dropped, only
 * folded**, and `attemptId` is the single argued non-column.
 *
 * 🚩 **There are no money columns here at all**, and so no `MONEY_FIELDS` and no
 * `@/core/money.ts` import. A collection attempt collected nothing by definition
 * — that is what makes it an attempt. Its absence is the screen, not an omission.
 */

/**
 * The five columns the supervisor lands on: **when** the collector came, **where**,
 * **who**, and **why** nothing was collected. Reading order — the visit moment
 * leads, because the question this screen answers is "what happened today".
 */
export const DEFAULT_FIELDS = [
  'attemptTime',
  'storeCode',
  'storeName',
  'collectorName',
  'reasonCode',
] as const satisfies readonly (keyof CollectionAttemptRow)[]

/** The forensic tail: the WPF's remaining four. */
export const MORE_FIELDS = [
  'reasonText',
  'businessDay',
  'shiftId',
  'collectorStaffId',
] as const satisfies readonly (keyof CollectionAttemptRow)[]

/**
 * The wire fields that are deliberately **not** columns, each with its reason.
 *
 * Exactly one: `attemptId` is the attempt's ULID, opaque — and ⚠️ **there is no
 * document to open with it and no row action on this screen**. The WPF withholds
 * one on purpose: an attempt is immutable evidence, not a voucher (244 §8, spec
 * 249 story 39). So unlike 254's `collectionReceiptId` and 255's `acrId`, this
 * ULID is not even a URL key — it is here so the completeness test can prove the
 * row is fully accounted for.
 */
export const NON_COLUMN_FIELDS = [
  'attemptId',
] as const satisfies readonly (keyof CollectionAttemptRow)[]

/** Default per-column behaviour. `floatingFilter` is the WPF's `ShowAutoFilterRow`
 *  — ⚠️ **on by default here**, deliberately inverting BBY Inquiry's default
 *  (244 §6). The toggle still exists to reclaim the height. */
export function buildAttemptsDefaultColDef(showFilters: boolean): ColDef<CollectionAttemptRow> {
  return {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/** Build the visible columns; `showMore` reveals the forensic tail. */
export function buildAttemptsColumns(
  t: TFunction,
  showMore: boolean,
): ColDef<CollectionAttemptRow>[] {
  const fields: (keyof CollectionAttemptRow)[] = showMore
    ? [...DEFAULT_FIELDS, ...MORE_FIELDS]
    : [...DEFAULT_FIELDS]
  return fields.map((field) => column(t, field))
}

function column(t: TFunction, field: keyof CollectionAttemptRow): ColDef<CollectionAttemptRow> {
  const label = t(`attempts.columns.${field}`)

  switch (field) {
    case 'attemptTime':
      return {
        headerName: label,
        field,
        colId: field,
        width: 160,
        valueFormatter: (p: ValueFormatterParams<CollectionAttemptRow, string>) =>
          formatDateTime(p.value),
        // 🚩 The floating filter has to match WHAT IS ON SCREEN — the raw value is
        // `2026-08-08T09:12:00`, and with the filter row on by default, typing the
        // `2026-08-08 09:12` the cell shows is the first thing a supervisor tries.
        // Sorting still uses the raw ISO value, which keeps it chronological.
        filterValueGetter: (p) => formatDateTime(p.data?.attemptTime),
      }
    case 'businessDay':
      return {
        headerName: label,
        field,
        colId: field,
        width: 130,
        valueFormatter: (p: ValueFormatterParams<CollectionAttemptRow, string>) => formatDay(p.value),
        filterValueGetter: (p) => formatDay(p.data?.businessDay),
      }
    case 'storeName':
    case 'collectorName':
    case 'reasonText':
      return { headerName: label, field, colId: field, width: 200 }
    case 'shiftId':
      return { headerName: label, field, colId: field, width: 180, cellClass: 'font-mono text-[12px]' }
    default:
      return { headerName: label, field, colId: field, width: 130 }
  }
}
