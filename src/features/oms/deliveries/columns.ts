import type {
  CellStyle,
  ColDef,
  RowSelectionOptions,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'

type DeliveryColDef = ColDef<DeliveryDocumentModel>
type DeliveryField = keyof DeliveryDocumentModel
type GetterParams = ValueGetterParams<DeliveryDocumentModel>

/** Render a boolean as Yes/No text, blank when unset (D-13). */
export function boolText(value: unknown, t: TFunction): string {
  if (value === true) return t('common:yes')
  if (value === false) return t('common:no')
  return ''
}

/**
 * `agDateColumnFilter` comparator for the datetime columns. Cell values are ISO
 * datetime strings compared by calendar day; blank/invalid sort before any
 * filter date so they fall out of range filters.
 */
export function dateFilterComparator(filterDate: Date, cellValue: unknown): number {
  if (cellValue == null || cellValue === '') return -1
  const parsed = new Date(cellValue as string)
  if (Number.isNaN(parsed.getTime())) return -1
  const cellDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
  const diff = cellDay - filterDate.getTime()
  if (diff < 0) return -1
  return diff > 0 ? 1 : 0
}

/**
 * Failed-Jobs conditional cell style — red background, bold white text when the
 * delivery has one or more failed background jobs; the key triage signal.
 *
 * The pair is `--danger` ground with `--primary-foreground` ink, and it must
 * stay a PAIR: in dark, `--danger` is a light tonal fill (082 R2) on which
 * white measures 2.2:1, and `--primary-foreground` is the token that flips to
 * dark ink with it. Both clear AA in their own theme. These are inline styles,
 * so `var()` resolves against `:root`/`.dark` regardless of how the grid theme
 * is written.
 */
export function failedJobsCellStyle(params: { value: unknown }): CellStyle | null {
  const count = typeof params.value === 'number' ? params.value : 0
  return count > 0
    ? {
        backgroundColor: 'var(--danger)',
        color: 'var(--primary-foreground)',
        fontWeight: '700',
      }
    : null
}

/**
 * Screen 1 results-grid columns, in the WPF column order.
 *
 * Built from `t` rather than literals so the header row is translatable (the
 * zero-literal rule); the column *ids* stay English field names, so saved views
 * and column state survive a language switch.
 *
 * Two documented WPF bugs are deliberately not replicated: the broken `Address1`
 * column is replaced by `street1` ("Street"), and the Slot / Slot Day columns —
 * listed twice in the XAML — appear once.
 */
export function buildDeliveryColumns(t: TFunction): DeliveryColDef[] {
  const dateTimeFormatter = (p: ValueFormatterParams<DeliveryDocumentModel>) =>
    formatDateTime(p.value as string | null | undefined)
  const moneyFormatter = (p: ValueFormatterParams<DeliveryDocumentModel>) =>
    formatMoney(p.value as number | null | undefined)

  /** A plain text column. */
  const textCol = (key: string, field: DeliveryField, width: number): DeliveryColDef => ({
    headerName: t(`deliveries:columns.${key}`),
    field,
    width,
  })

  /** A `yyyy-MM-dd HH:mm` datetime column with a calendar-day date filter. */
  const dateCol = (key: string, field: DeliveryField, width: number): DeliveryColDef => ({
    headerName: t(`deliveries:columns.${key}`),
    field,
    width,
    valueFormatter: dateTimeFormatter,
    filter: 'agDateColumnFilter',
    filterParams: { comparator: dateFilterComparator },
  })

  /** A right-aligned 2-decimal money column with a number filter. */
  const moneyCol = (key: string, field: DeliveryField, width: number): DeliveryColDef => ({
    headerName: t(`deliveries:columns.${key}`),
    field,
    width,
    type: 'numericColumn',
    valueFormatter: moneyFormatter,
    filter: 'agNumberColumnFilter',
  })

  /** A Yes/No boolean column — the value IS the text, so filter/sort agree. */
  const boolCol = (key: string, field: DeliveryField, width: number): DeliveryColDef => ({
    headerName: t(`deliveries:columns.${key}`),
    colId: field,
    width,
    valueGetter: (p: GetterParams) => boolText(p.data?.[field], t),
  })

  /**
   * A text column whose raw value needs trimming. The API returns these
   * space-padded ("Delivery  "), so the padding would otherwise leak into sort
   * order, filter matches and the export. The cell VALUE is the trimmed text,
   * so every consumer agrees.
   *
   * These four columns arrive as DESCRIPTIONS, not codes — the API resolves them
   * server-side. `colId` stays the field name so saved views survive.
   */
  const trimmedCol = (key: string, field: DeliveryField, width: number): DeliveryColDef => ({
    headerName: t(`deliveries:columns.${key}`),
    colId: field,
    width,
    valueGetter: (p: GetterParams) => String(p.data?.[field] ?? '').trim(),
  })

  return [
    { ...textCol('deliveryNo', 'deliveryNo', 130), sort: 'desc' },
    textCol('documentNo', 'documentNo', 130),
    textCol('orderNo', 'orderNo', 120),
    {
      headerName: t('deliveries:columns.failedJobs'),
      field: 'failedJobsCount',
      width: 115,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      cellStyle: failedJobsCellStyle,
    },
    trimmedCol('documentType', 'documentType', 130),
    trimmedCol('deliveryType', 'deliveryType', 120),
    trimmedCol('deliveryDocumentType', 'deliveryDocumentType', 150),
    boolCol('dawaaNow', 'isExpressDelivery', 110),
    trimmedCol('documentSource', 'documentSource', 130),
    {
      // The API returns EITHER a description or a raw code, never both — so
      // whichever is present is the whole truth for the cell.
      headerName: t('deliveries:columns.reason'),
      colId: 'documentReason',
      width: 160,
      valueGetter: (p: GetterParams) =>
        p.data?.reasonDescription?.trim() || p.data?.documentReason?.trim() || '',
    },
    dateCol('entryTime', 'entryTime', 140),
    dateCol('documentDate', 'documentDate', 140),
    textCol('mobile', 'customerPhone', 120),
    textCol('customerName', 'customerName', 170),
    textCol('storeCode', 'storeCode', 100),
    boolCol('isActiveInStore', 'isActiveInStore', 135),
    textCol('slot', 'timeSlotDescription', 135),
    textCol('slotDay', 'timeSlotDay', 110),
    moneyCol('netTotal', 'netTotal', 110),
    moneyCol('paidAmount', 'paidAmount', 115),
    moneyCol('deliveryFees', 'deliveryFees', 115),
    moneyCol('amountDue', 'amountDue', 115),
    textCol('note', 'note', 220),
    textCol('cityName', 'cityName', 120),
    textCol('street', 'street1', 170),
    textCol('readyStatus', 'readyStatus', 115),
    textCol('clearStatus', 'clearStatus', 115),
    textCol('deliveryStatus', 'deliveryStatus', 125),
    textCol('closeStatus', 'closeStatus', 115),
    boolCol('rescheduled', 'rescheduled', 115),
    dateCol('deliverySlotFrom', 'deliveryScheduleFromTime', 150),
    dateCol('deliverySlotTo', 'deliveryScheduleToTime', 150),
    dateCol('outForDeliveryTime', 'outForDeliveryTime', 160),
    dateCol('actualDeliveryTime', 'actualDeliveryTime', 160),
    textCol('expressCourierId', 'expressCourierId', 140),
    textCol('courierCode', 'courierCode', 120),
    textCol('courierDriverId', 'courierDriverId', 135),
    textCol('courierDriverName', 'courierDriverName', 165),
    textCol('courierDriverPhone', 'courierDriverPhone', 150),
    textCol('customerOtp', 'customerOtp', 115),
    textCol('lastAction', 'lastAction', 120),
  ]
}

/**
 * Default column behaviour: every column sortable (Ctrl-click multi-sort),
 * resizable, movable, with a floating filter. `cellDataType: false` disables AG
 * Grid's type inference so booleans render as Yes/No text rather than the
 * built-in checkbox renderer (D-13).
 */
export const DELIVERY_DEFAULT_COL_DEF: DeliveryColDef = {
  sortable: true,
  resizable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  cellDataType: false,
}

/** Single-row click selection — gates the toolbar's Open Order / Open Delivery. */
export const DELIVERY_ROW_SELECTION: RowSelectionOptions<DeliveryDocumentModel> = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}
