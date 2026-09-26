import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { CollectionReadyRow } from '@/core/models/collection'
import { distinctCurrencies } from '@/core/money'
import { formatDateTime } from '@/core/util/date-format'
import {
  readyBusinessDay,
  readyEntryNumber,
  readyKindKey,
  readyMoney,
  readyZNumber,
} from './ready-projection'
import { slipCountColumn } from './SlipCountColumn'
import { withSlipColumn } from './slips'

/**
 * The Ready for collection grid's columns (ticket 317) — the siblings' column shape
 * over BackOffice 1994's row. ⚠️ **Nothing is dropped, only folded**: every wire
 * field is on the landing grid or in the More-columns tail.
 *
 * Every absent value draws the dash (`ready-projection.ts`), never a blank and
 * never a zero.
 */

/**
 * The landing grid: **what** waits (a closed day or a prepared receipt), **where**,
 * **which day** and its handle, **how much** the collector takes, and **how long**
 * it has waited — the ticket's columns in reading order.
 *
 * 🚩 The store column is `storeText` — `PH-019 (P019)`, or the code alone — the
 * SERVER's shared formatter, rendered exactly as sent (the contract: "render this
 * in the store / profit-center column"). Nothing here prefixes or re-derives it.
 *
 * `entryNumber` sits beside `zNumber` because it is a receipt's handle as the Z is
 * a day's: without it a receipt row would carry no identity but its store.
 *
 * `cardTotal` (ticket 320, BackOffice 2034 F9) closes the set: the day's card
 * figure, the one a missing or wrong ECR slip is checked against, so the Slips
 * column lands right after it when the session may see slips.
 */
export const DEFAULT_FIELDS = [
  'kind',
  'storeText',
  'storeName',
  'businessDay',
  'zNumber',
  'entryNumber',
  'cashToHandOver',
  'surplusDeducted',
  'readySince',
  'daysWaiting',
  'cardTotal',
] as const satisfies readonly (keyof CollectionReadyRow)[]

/**
 * The column the slip probe gates (ticket 320): drawn after `cardTotal` only when
 * `AttachmentWeb/Access` holds `CASH_CLOSE`. Its own group, so the completeness
 * proof still accounts for it without either list carrying a column the session
 * may not see.
 */
export const SLIP_FIELDS = ['slipCount'] as const satisfies readonly (keyof CollectionReadyRow)[]

/** The forensic tail: the raw parts `storeText` is made of, the currency, and the two row keys. */
export const MORE_FIELDS = [
  'storeId',
  'profitCenter',
  'currencyKey',
  'shiftId',
  'settlementDocumentId',
] as const satisfies readonly (keyof CollectionReadyRow)[]

/** No wire field is withheld: there is no document to open and no act on this screen. */
export const NON_COLUMN_FIELDS = [] as const satisfies readonly (keyof CollectionReadyRow)[]

/**
 * The money fields, drawn to the **row's own** currency's decimals (244 §7) — and
 * `cardTotal` under the currency header on the same terms as its neighbours.
 */
export const MONEY_FIELDS = [
  'cashToHandOver',
  'surplusDeducted',
  'cardTotal',
] as const satisfies readonly (keyof CollectionReadyRow)[]

const MONEY = new Set<string>(MONEY_FIELDS)

/** Default per-column behaviour — the siblings': sortable, text filter, filter row on. */
export function buildReadyDefaultColDef(showFilters: boolean): ColDef<CollectionReadyRow> {
  return {
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/**
 * Build the visible columns; `showMore` reveals the tail, and `showSlips` (the
 * slip probe's answer, fail-closed) places the Slips column after `cardTotal`.
 *
 * The currency handling is Cash Collections': one currency in the result puts the
 * code in each money column's **header**; a mixed result leaves the headers bare
 * and promotes the Currency column into the landing set, because figures in two
 * currencies with the currency folded away are unreadable.
 */
export function buildReadyColumns(
  t: TFunction,
  rows: readonly CollectionReadyRow[],
  showMore: boolean,
  showSlips = false,
): ColDef<CollectionReadyRow>[] {
  const currencies = distinctCurrencies(rows, (row) => row.currencyKey)
  const headerCurrency = currencies.length === 1 ? currencies[0] : ''
  const mixed = currencies.length > 1

  const fields: (keyof CollectionReadyRow)[] = showMore
    ? [...DEFAULT_FIELDS, ...MORE_FIELDS]
    : mixed
      ? [...DEFAULT_FIELDS, 'currencyKey']
      : [...DEFAULT_FIELDS]

  return withSlipColumn(fields, showSlips).map((field) =>
    field === 'slipCount' ? slipCountColumn<CollectionReadyRow>(t) : column(t, field, headerCurrency),
  )
}

/** A right-aligned number column that filters as a number. */
const NUMERIC: ColDef<CollectionReadyRow> = {
  type: 'numericColumn',
  filter: 'agNumberColumnFilter',
  cellClass: 'text-end tabular-nums',
}

function column(
  t: TFunction,
  field: keyof CollectionReadyRow,
  headerCurrency: string,
): ColDef<CollectionReadyRow> {
  const label = t(`ready.columns.${field}`)

  if (MONEY.has(field)) {
    return {
      ...NUMERIC,
      headerName: headerCurrency ? t('ready.moneyHeader', { label, currency: headerCurrency }) : label,
      field,
      colId: field,
      width: 150,
      // 🚩 The row's own currency, not the header's — and the dash for a null.
      valueFormatter: (p: ValueFormatterParams<CollectionReadyRow, number | null>) =>
        readyMoney(p.value, p.data?.currencyKey),
    }
  }

  switch (field) {
    case 'kind': {
      const kindText = (kind: string | null | undefined) => {
        const key = readyKindKey(kind)
        return key ? t(key) : (kind ?? '')
      }
      return {
        headerName: label,
        field,
        colId: field,
        width: 150,
        valueFormatter: (p: ValueFormatterParams<CollectionReadyRow, string>) => kindText(p.value),
        filterValueGetter: (p) => kindText(p.data?.kind),
      }
    }
    case 'storeText':
      // As the server sent it — no valueFormatter, by ruling.
      return { headerName: label, field, colId: field, width: 170 }
    case 'storeName':
      return { headerName: label, field, colId: field, width: 200 }
    case 'businessDay':
      return {
        headerName: label,
        field,
        colId: field,
        width: 130,
        valueFormatter: (p: ValueFormatterParams<CollectionReadyRow, string | null>) =>
          p.data ? readyBusinessDay(p.data) : '',
        // The filter matches what is on screen, as on the siblings' date columns.
        filterValueGetter: (p) => (p.data ? readyBusinessDay(p.data) : ''),
      }
    case 'zNumber':
      return {
        ...NUMERIC,
        headerName: label,
        field,
        colId: field,
        width: 110,
        valueFormatter: (p: ValueFormatterParams<CollectionReadyRow, number | null>) =>
          p.data ? readyZNumber(p.data) : '',
      }
    case 'entryNumber':
      return {
        ...NUMERIC,
        headerName: label,
        field,
        colId: field,
        width: 130,
        valueFormatter: (p: ValueFormatterParams<CollectionReadyRow, number>) =>
          p.data ? readyEntryNumber(p.data) : '',
      }
    case 'readySince':
      return {
        headerName: label,
        field,
        colId: field,
        width: 160,
        valueFormatter: (p: ValueFormatterParams<CollectionReadyRow, string>) => formatDateTime(p.value),
        filterValueGetter: (p) => formatDateTime(p.data?.readySince),
      }
    case 'daysWaiting':
      return { ...NUMERIC, headerName: label, field, colId: field, width: 120 }
    case 'shiftId':
    case 'settlementDocumentId':
      return { headerName: label, field, colId: field, width: 240, cellClass: 'font-mono text-[12px]' }
    default:
      return { headerName: label, field, colId: field, width: 130 }
  }
}
