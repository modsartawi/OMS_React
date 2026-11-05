import type { ColDef, RowSelectionOptions, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { GuardStateCell } from '@/core/insurance-rules/GuardStateCell'
import { formatMoneyIn } from '@/core/money'
import type { OrderDocumentRow } from '@/core/models/order-document'
import { pinStart } from '@/core/theme/direction'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { formatDateTime } from '@/core/util/date-format'
import type { QueryGrants } from './query-model'

type OrderColDef = ColDef<OrderDocumentRow>
type OrderField = keyof OrderDocumentRow

/**
 * `agDateColumnFilter` comparator for the entry time: ISO datetime strings compared by calendar
 * day; blank or invalid sort before any filter date so they fall out of range filters.
 */
function dateFilterComparator(filterDate: Date, cellValue: unknown): number {
  if (cellValue == null || cellValue === '') return -1
  const parsed = new Date(cellValue as string)
  if (Number.isNaN(parsed.getTime())) return -1
  const diff = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime() - filterDate.getTime()
  if (diff < 0) return -1
  return diff > 0 ? 1 : 0
}

const text = (value: string | null | undefined) => (value ?? '').trim()

/**
 * The Order / ERX grid's columns (ticket 786; 3389 user story 22). Built from `t` (zero-literal);
 * the column ids stay the field names, so saved views survive a language switch.
 *
 * 🚩 The patient ID and member ID columns exist only with the insurance-view grant. Money reads in
 * the 2-decimal default (`formatMoneyIn`): the search row carries no currency.
 */
export function buildOrderColumns(t: TFunction, grants: QueryGrants): OrderColDef[] {
  const header = (key: string) => t(`orders:columns.${key}`)
  // The row carries no currency (the server sends none): money reads in the 2-decimal default.
  const money = (p: ValueFormatterParams<OrderDocumentRow>) => formatMoneyIn(p.value as number | null, null)

  const textCol = (field: OrderField, width: number): OrderColDef => ({ headerName: header(field), field, width })
  /** IDs and codes in mono (spec 380, 359) — never money or quantities. */
  const idCol = (field: OrderField, width: number): OrderColDef => ({ ...textCol(field, width), cellClass: 'font-mono' })
  const moneyCol = (field: OrderField, width: number): OrderColDef => ({
    headerName: header(field),
    field,
    width,
    type: 'numericColumn',
    valueFormatter: money,
    filter: 'agNumberColumnFilter',
  })
  /** A coded value shown as its description; the value IS the text, so filter, sort and export agree. */
  const describedCol = (colId: string, width: number, get: (row: OrderDocumentRow) => string): OrderColDef => ({
    headerName: header(colId),
    colId,
    width,
    valueGetter: (p: ValueGetterParams<OrderDocumentRow>) => (p.data ? get(p.data) : ''),
  })

  return [
    // The row's own key reads heaviest, pinned at the reading start (L10). Newest first is the
    // server's order (3391), so the grid adds no sort of its own.
    { ...idCol('documentNo', 130), cellClass: 'font-mono font-semibold', pinned: pinStart },
    idCol('orderNo', 150),
    describedCol('category', 90, (row) => (row.documentCategory ? t(`orders:category.${row.documentCategory}`) : '')),
    describedCol('documentType', 140, (row) => text(row.documentTypeDescription) || text(row.documentType)),
    describedCol('documentSource', 130, (row) => text(row.documentSourceDescription) || text(row.documentSource)),
    // The server sends the overall status code only, no description. The colId stays `status` for saved views.
    describedCol('status', 130, (row) => text(row.overallStatus)),
    {
      headerName: t('insurance-order-guards:column.header'),
      colId: 'guardState',
      width: 190,
      valueGetter: (p: ValueGetterParams<OrderDocumentRow>) =>
        p.data?.guardState && p.data.guardState !== 'none' ? t(`insurance-order-guards:state.${p.data.guardState}`) : '',
      cellRenderer: GuardStateCell,
    },
    // Blank before the order has a delivery: the "No delivery yet" lens finds those.
    {
      headerName: header('deliveryNo'),
      colId: 'deliveryNo',
      width: 130,
      cellClass: 'font-mono',
      valueGetter: (p: ValueGetterParams<OrderDocumentRow>) => text(p.data?.latestDeliveryNo),
    },
    {
      headerName: header('entryTime'),
      field: 'entryTime',
      width: 150,
      valueFormatter: (p) => formatDateTime(p.value as string | null),
      filter: 'agDateColumnFilter',
      filterParams: { comparator: dateFilterComparator },
    },
    idCol('storeCode', 90),
    textCol('customerName', 170),
    textCol('customerPhone', 120),
    moneyCol('netTotal', 110),
    moneyCol('amountDue', 115),
    describedCol('moneySource', 130, (row) => (row.moneySource ? t(`orders:moneySource.${row.moneySource}`) : '')),
    moneyCol('patientTotal', 115),
    moneyCol('insurerTotal', 115),
    ...(grants.canViewInsurance ? [idCol('patientId', 130), idCol('memberId', 130)] : []),
    textCol('closeStatus', 105),
  ]
}

/** Every column sortable, resizable, movable, with a floating filter; no type inference. */
export const ORDER_DEFAULT_COL_DEF: OrderColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  cellDataType: false,
}

/** Single-row click selection — the current row the inspector shows. */
export const ORDER_ROW_SELECTION: RowSelectionOptions<OrderDocumentRow> = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}
