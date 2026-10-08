import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
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
import { withSlipColumn, type SlipDay } from './slips'

/**
 * The Ready for collection grid's columns (ticket 317) — the siblings' column shape
 * over BackOffice 1994's row. ⚠️ **Nothing is dropped, only folded**: every wire
 * field is on the landing grid or in the More-columns tail.
 *
 * Every absent value draws the dash (`ready-projection.ts`), never a blank and
 * never a zero.
 */

/**
 * The landing grid: **the owner-approved mapping of Saud's order** (spec 2423,
 * ticket 424). Ready follows Cash Collections' sheet wherever it has a matching
 * column — Entry No (a receipt's handle, standing for Receipt No#), Store Code,
 * Profit Center, Cash to hand over (Amount), Surplus deducted (Surplus), Type,
 * Business Day, Store Name, Card Total, Currency — then its own columns: Z No,
 * Ready since, Days waiting. Sheet columns Ready does not have are skipped. The
 * order is the mapping's, not a reading order of ours.
 *
 * 🚩 **Store Code and Profit Center are the raw fields** (`storeId`,
 * `profitCenter`), as on Cash Collections since 423. The server's composed
 * `storeText` (`PH-019`) moves to the tail, as it did there.
 *
 * 🚩 **Currency is always a column** now: the mapping places it tenth, so the
 * mixed-currency promotion this grid used to do has nothing left to promote.
 *
 * The mapping's fourteenth column, **Card slips**, is the slip-probe count
 * (`SLIP_FIELDS`), drawn right after Days waiting and only when the session may
 * see slips — hidden, it shifts none of the thirteen.
 */
export const DEFAULT_FIELDS = [
  'entryNumber',
  'storeId',
  'profitCenter',
  'cashToHandOver',
  'surplusDeducted',
  'kind',
  'businessDay',
  'storeName',
  'cardTotal',
  'currencyKey',
  'zNumber',
  'readySince',
  'daysWaiting',
] as const satisfies readonly (keyof CollectionReadyRow)[]

/**
 * The column the slip probe gates (ticket 320): drawn only when
 * `AttachmentWeb/Access` holds `CASH_CLOSE`, right after `READY_SLIP_ANCHOR` — the
 * mapping's last column (spec 2423). Its own group, so the completeness proof
 * still accounts for it without either list carrying a column the session may not
 * see.
 */
export const SLIP_FIELDS = ['slipCount'] as const satisfies readonly (keyof CollectionReadyRow)[]

/** The column the slip count follows on this grid: the mapping's *Days waiting*. */
export const READY_SLIP_ANCHOR = 'daysWaiting' satisfies keyof CollectionReadyRow

/** The forensic tail: the server's composed store text and the two row keys. */
export const MORE_FIELDS = [
  'storeText',
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
    ...OMS_GRID_BASE_COL_DEF,
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: showFilters,
    cellDataType: false,
  }
}

/**
 * Build the visible columns; `showMore` reveals the tail, and `showSlips` (the
 * slip probe's answer, fail-closed) places the Slips column after Days waiting;
 * `onOpenSlips` makes a known count open that store day's drawer (ticket 321).
 *
 * One currency in the result puts the code in each money column's **header**; a
 * mixed result leaves the headers bare, and the Currency column (on the landing
 * grid since spec 2423) says which is which.
 */
export function buildReadyColumns(
  t: TFunction,
  rows: readonly CollectionReadyRow[],
  showMore: boolean,
  showSlips = false,
  onOpenSlips?: (day: SlipDay) => void,
): ColDef<CollectionReadyRow>[] {
  const currencies = distinctCurrencies(rows, (row) => row.currencyKey)
  const headerCurrency = currencies.length === 1 ? currencies[0] : ''

  const fields: (keyof CollectionReadyRow)[] = showMore
    ? [...DEFAULT_FIELDS, ...MORE_FIELDS]
    : [...DEFAULT_FIELDS]

  return withSlipColumn(fields, showSlips, READY_SLIP_ANCHOR).map((field) =>
    field === 'slipCount' ? slipCountColumn<CollectionReadyRow>(t, onOpenSlips) : column(t, field, headerCurrency),
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
      // Wide enough for the longest label with its currency under Plex (ticket 391).
      width: 160,
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
    case 'storeId':
      // A store code is an ID: Plex Mono (spec 380, 359).
      return { headerName: label, field, colId: field, width: 130, cellClass: 'font-mono' }
    default:
      return { headerName: label, field, colId: field, width: 130 }
  }
}
