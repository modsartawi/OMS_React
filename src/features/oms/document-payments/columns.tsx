import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { FileText, Truck } from 'lucide-react'
import type { DocumentPaymentModel } from '@/core/models/document-payment'
import { formatMoneyIn } from '@/core/money'
import { formatDateTime } from '@/core/util/date-format'
import { paymentRowOffers } from './row-offers'

type Row = DocumentPaymentModel

/** The row-actions column: it holds buttons, not a value, so the export leaves it out. */
export const ACTIONS_COL_ID = 'actions'

/** Identities the export writes as text, so Excel never totals or reshapes a number or a code. */
export const EXPORT_AS_TEXT: ReadonlySet<string> = new Set([
  'documentNo',
  'orderNo',
  'referenceNumber',
  'storeCode',
  'customerPhone',
  'deliveryNo',
])

/**
 * The Document payments grid (ticket 433, spec 430 D4/D15): the WPF inquiry's columns, the
 * document number first because it is what "Open document" opens.
 *
 * Every cell is isolated by the core grid base; the amount is money in its own row's currency
 * through the core formatter, and the export keeps it a number Excel can total. The actions column
 * has its own renderer and holds no value.
 */
export function paymentColumns(t: TFunction, onOpen: (to: string) => void): ColDef<Row>[] {
  const code = 'font-mono text-[12px]'
  const when = ({ value }: ValueFormatterParams<Row, string>) => formatDateTime(value)
  const action =
    'inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted'

  return [
    { field: 'documentNo', headerName: t('columns.documentNo'), width: 130, cellClass: code },
    { field: 'orderNo', headerName: t('columns.orderNo'), width: 130, cellClass: code },
    { field: 'documentTypeDescription', headerName: t('columns.documentType'), width: 140 },
    { field: 'conditionTypeDescription', headerName: t('columns.payment'), width: 150 },
    { field: 'paymentType', headerName: t('columns.paymentType'), width: 120 },
    { field: 'paymentMethod', headerName: t('columns.paymentMethod'), width: 120 },
    { field: 'cardType', headerName: t('columns.cardType'), width: 110 },
    {
      field: 'conditionRate',
      headerName: t('columns.amount'),
      width: 120,
      type: 'numericColumn',
      cellClass: 'text-end tabular-nums',
      valueFormatter: ({ value, data }: ValueFormatterParams<Row, number>) => formatMoneyIn(value, data?.conditionRateUnit),
    },
    { field: 'conditionRateUnit', headerName: t('columns.currency'), width: 95, cellClass: code },
    { field: 'referenceNumber', headerName: t('columns.reference'), width: 150, cellClass: code },
    { field: 'storeCode', headerName: t('columns.store'), width: 90, cellClass: code },
    { field: 'documentDate', headerName: t('columns.entryTime'), width: 145, valueFormatter: when },
    { field: 'customerPhone', headerName: t('columns.mobile'), width: 140, cellClass: code },
    { field: 'deliveryTypeDescription', headerName: t('columns.deliveryType'), width: 140 },
    { field: 'deliveryNo', headerName: t('columns.deliveryNo'), width: 130, cellClass: code },
    { field: 'deliveryNote', headerName: t('columns.deliveryNote'), width: 200, tooltipField: 'deliveryNote' },
    { field: 'deliveryDeliveryStatus', headerName: t('columns.deliveryStatus'), width: 130 },
    {
      colId: ACTIONS_COL_ID,
      headerName: t('columns.actions'),
      width: 250,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Row>) => {
        if (!data) return null
        const offers = paymentRowOffers(data)
        return (
          <span className="inline-flex items-center gap-1.5">
            {offers.document && (
              <button type="button" className={action} data-payment-open="document" onClick={() => onOpen(offers.document!)}>
                <FileText className="h-3 w-3" aria-hidden />
                {t('actions.openDocument')}
              </button>
            )}
            {offers.delivery && (
              <button type="button" className={action} data-payment-open="delivery" onClick={() => onOpen(offers.delivery!)}>
                <Truck className="h-3 w-3" aria-hidden />
                {t('actions.openDelivery')}
              </button>
            )}
          </span>
        )
      },
    },
  ]
}
