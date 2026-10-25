import type { TFunction } from 'i18next'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type {
  SerialRefusalArticleRow,
  SerialRefusalBasket,
  SerialRefusalDayRow,
  SerialRefusalHeldByRow,
  SerialRefusalOffenderRow,
  SerialRefusalRow,
  SerialRefusalSerialRow,
  SerialRefusalStaffRow,
  SerialRefusalStoreRow,
} from '@/core/models/serial-refusal'
import { pinStart } from '@/core/theme/direction'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'

/**
 * The serial refusal report's columns, one set per tab (ticket 573). Counts are the door's, sorted as sent; a row of
 * any tab but Refusals opens the refusals behind it (the page's `onRowClicked`), so no cell carries its own link.
 *
 * Codes (store, staff id, GTIN, serial, article, till, receipt) are machine values: monospace, and exported as text so a
 * spreadsheet never turns `0628…` into a number.
 */

const CODE = 'font-mono text-[12px]'
const COUNT: Partial<ColDef> = { type: 'numericColumn', cellClass: 'text-end tabular-nums', minWidth: 90, flex: 1 }

/** Every code column id, exported as text. */
export const TEXT_COLUMNS = new Set([
  'store', 'staff', 'gtin', 'serial', 'itemNumber', 'heldStore', 'last', 'storeCode', 'staffId', 'tillCode',
  'trxNumber', 'soldStoreCode', 'soldMachineCode', 'soldTrxNumber', 'heldDocumentNo', 'heldStoreCode', 'tillVersion',
])

/** A blank staff id is a till that sent none: many people, not one. */
function StaffCell({ staff, t }: { staff: string | undefined; t: TFunction }) {
  return staff ? (
    <span className={CODE}>{staff}</span>
  ) : (
    <span className="italic text-muted-foreground" data-sr-unknown-staff="">
      {t('unknownStaff')}
    </span>
  )
}

const staffText = (t: TFunction, staff: string | undefined) => (staff ? staff : t('unknownStaff'))

const basketText = (b: SerialRefusalBasket | undefined, dash: string) =>
  b ? [b.store, b.till, b.trxNumber || dash].filter(Boolean).join(' · ') : dash

const when = (value: string | undefined, dash: string) => formatDateTime(value) || dash

function count<R>(t: TFunction, field: string, header = field): ColDef<R> {
  return { colId: field, field: field as ColDef<R>['field'], headerName: t(`column.${header}`), ...(COUNT as Partial<ColDef<R>>) }
}

export function staffColumns(t: TFunction): ColDef<SerialRefusalStaffRow>[] {
  const dash = t('dash')
  return [
    {
      colId: 'staff',
      headerName: t('column.staff'),
      pinned: pinStart,
      minWidth: 150,
      valueGetter: ({ data }) => staffText(t, data?.staff),
      cellRenderer: ({ data }: ICellRendererParams<SerialRefusalStaffRow>) => <StaffCell staff={data?.staff} t={t} />,
    },
    count(t, 'refusals'),
    count(t, 'sold'),
    count(t, 'held'),
    count(t, 'serials'),
    { colId: 'stores', headerName: t('column.stores'), minWidth: 140, flex: 1, cellClass: CODE, valueGetter: ({ data }) => (data?.stores ?? []).join(', ') },
    { colId: 'lastRefusedAt', headerName: t('column.lastRefusedAt'), minWidth: 150, valueGetter: ({ data }) => when(data?.lastRefusedAt, dash) },
  ]
}

export function offenderColumns(t: TFunction): ColDef<SerialRefusalOffenderRow>[] {
  const dash = t('dash')
  return [
    { colId: 'staff', field: 'staff', headerName: t('column.staff'), pinned: pinStart, minWidth: 120, cellClass: CODE },
    { colId: 'serial', field: 'serial', headerName: t('column.serial'), minWidth: 150, cellClass: CODE },
    { colId: 'gtin', field: 'gtin', headerName: t('column.gtin'), minWidth: 140, cellClass: CODE },
    { colId: 'itemNumber', field: 'itemNumber', headerName: t('column.itemNumber'), minWidth: 110, cellClass: CODE },
    count(t, 'times'),
    count(t, 'stores', 'storeCount'),
    { ...count(t, 'baskets'), headerTooltip: t('columnHint.baskets') },
    { colId: 'firstRefusedAt', headerName: t('column.firstRefusedAt'), minWidth: 150, valueGetter: ({ data }) => when(data?.firstRefusedAt, dash) },
    { colId: 'lastRefusedAt', headerName: t('column.lastRefusedAt'), minWidth: 150, valueGetter: ({ data }) => when(data?.lastRefusedAt, dash) },
    { colId: 'last', headerName: t('column.lastBasket'), headerTooltip: t('columnHint.lastBasket'), minWidth: 170, cellClass: CODE, valueGetter: ({ data }) => basketText(data?.last, dash) },
  ]
}

export function serialColumns(t: TFunction): ColDef<SerialRefusalSerialRow>[] {
  const dash = t('dash')
  return [
    { colId: 'serial', field: 'serial', headerName: t('column.serial'), pinned: pinStart, minWidth: 150, cellClass: CODE },
    { colId: 'gtin', field: 'gtin', headerName: t('column.gtin'), minWidth: 140, cellClass: CODE },
    { colId: 'itemNumber', field: 'itemNumber', headerName: t('column.itemNumber'), minWidth: 110, cellClass: CODE },
    count(t, 'refusals'),
    count(t, 'stores', 'storeCount'),
    { ...count(t, 'baskets'), headerTooltip: t('columnHint.baskets') },
    { colId: 'firstRefusedAt', headerName: t('column.firstRefusedAt'), minWidth: 150, valueGetter: ({ data }) => when(data?.firstRefusedAt, dash) },
    { colId: 'lastRefusedAt', headerName: t('column.lastRefusedAt'), minWidth: 150, valueGetter: ({ data }) => when(data?.lastRefusedAt, dash) },
    { colId: 'last', headerName: t('column.lastBasket'), headerTooltip: t('columnHint.lastBasket'), minWidth: 170, cellClass: CODE, valueGetter: ({ data }) => basketText(data?.last, dash) },
  ]
}

export function storeColumns(t: TFunction): ColDef<SerialRefusalStoreRow>[] {
  return [
    {
      colId: 'store',
      headerName: t('column.store'),
      pinned: pinStart,
      minWidth: 200,
      valueGetter: ({ data }) => formatPair(data?.store, data?.name),
    },
    count(t, 'refusals'),
    count(t, 'sold'),
    count(t, 'held'),
    { ...count(t, 'crossStore'), headerTooltip: t('columnHint.crossStore') },
    count(t, 'staff', 'staffCount'),
    count(t, 'unknownStaff'),
  ]
}

export function articleColumns(t: TFunction): ColDef<SerialRefusalArticleRow>[] {
  return [
    { colId: 'itemNumber', field: 'itemNumber', headerName: t('column.itemNumber'), pinned: pinStart, minWidth: 140, cellClass: CODE },
    count(t, 'refusals'),
    count(t, 'serials'),
    count(t, 'stores', 'storeCount'),
  ]
}

export function heldByColumns(t: TFunction): ColDef<SerialRefusalHeldByRow>[] {
  const dash = t('dash')
  return [
    { colId: 'heldStore', headerName: t('column.heldStore'), pinned: pinStart, minWidth: 140, cellClass: CODE, valueGetter: ({ data }) => data?.heldStore || dash },
    count(t, 'refusals'),
    count(t, 'documents'),
    count(t, 'askingStores'),
  ]
}

export function dayColumns(t: TFunction): ColDef<SerialRefusalDayRow>[] {
  return [
    { colId: 'day', headerName: t('column.day'), pinned: pinStart, minWidth: 120, valueGetter: ({ data }) => formatDay(data?.day) },
    { colId: 'store', field: 'store', headerName: t('column.store'), minWidth: 100, cellClass: CODE },
    count(t, 'refusals'),
    count(t, 'sold'),
    count(t, 'held'),
  ]
}

/** One recorded refusal: when, who asked (store, staff, till, receipt), what, and what it collided with. */
export function refusalColumns(t: TFunction): ColDef<SerialRefusalRow>[] {
  const dash = t('dash')
  const text = (value: string | undefined) => value || dash
  return [
    { colId: 'refusedAt', headerName: t('column.refusedAt'), pinned: pinStart, minWidth: 150, valueGetter: ({ data }) => when(data?.refusedAt, dash) },
    {
      colId: 'status',
      headerName: t('column.status'),
      minWidth: 90,
      valueGetter: ({ data }) => (data ? t(`status.${data.status}`, { defaultValue: data.status }) : dash),
    },
    { colId: 'storeCode', field: 'storeCode', headerName: t('column.store'), minWidth: 90, cellClass: CODE },
    {
      colId: 'staffId',
      headerName: t('column.staff'),
      minWidth: 120,
      valueGetter: ({ data }) => staffText(t, data?.staffId),
      cellRenderer: ({ data }: ICellRendererParams<SerialRefusalRow>) => <StaffCell staff={data?.staffId} t={t} />,
    },
    { colId: 'tillCode', headerName: t('column.till'), minWidth: 90, cellClass: CODE, valueGetter: ({ data }) => text(data?.tillCode) },
    { colId: 'trxNumber', headerName: t('column.trxNumber'), headerTooltip: t('columnHint.trxNumber'), minWidth: 110, cellClass: CODE, valueGetter: ({ data }) => text(data?.trxNumber) },
    { colId: 'serial', field: 'serial', headerName: t('column.serial'), minWidth: 150, cellClass: CODE },
    { colId: 'gtin', field: 'gtin', headerName: t('column.gtin'), minWidth: 140, cellClass: CODE },
    { colId: 'itemNumber', headerName: t('column.itemNumber'), minWidth: 110, cellClass: CODE, valueGetter: ({ data }) => text(data?.itemNumber) },
    {
      colId: 'collision',
      headerName: t('column.collision'),
      headerTooltip: t('columnHint.collision'),
      minWidth: 220,
      flex: 1,
      cellClass: CODE,
      valueGetter: ({ data }) => {
        if (!data) return dash
        if (data.status === 'HELD') return [data.heldDocumentNo, data.heldStoreCode].filter(Boolean).join(' · ') || dash
        return [data.soldStoreCode, data.soldMachineCode, data.soldTrxNumber].filter(Boolean).join(' · ') || dash
      },
    },
    { colId: 'tillVersion', headerName: t('column.tillVersion'), minWidth: 100, cellClass: CODE, valueGetter: ({ data }) => text(data?.tillVersion) },
  ]
}
