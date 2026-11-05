/**
 * What the Order inspector shows for one list row (ticket 786). 🚩 The row, and nothing else: no
 * request, ever, so stepping through rows with J/K is free. The insurance figures are the row's
 * own; the patient and member ID appear only with the insurance-view grant.
 */
import type { OrderGuardState } from '@/core/insurance-rules/guard-check'
import { formatMoneyIn } from '@/core/money'
import type { MoneySource, OrderDocumentCategory, OrderDocumentRow } from '@/core/models/order-document'
import { formatDateTime } from '@/core/util/date-format'
import type { QueryGrants } from './query-model'

const text = (value: string | null | undefined) => (value ?? '').trim()

/** Document details for a row (Enter, a double-click, Open). */
export function documentPathOf(row: OrderDocumentRow): string | null {
  const documentNo = text(row.documentNo)
  return documentNo ? `/oms/document/${documentNo}` : null
}

/** The row's latest delivery, or `null` before it has one. */
export function deliveryPathOf(row: OrderDocumentRow): string | null {
  const deliveryNo = text(row.deliveryNo)
  return deliveryNo ? `/oms/delivery/${deliveryNo}` : null
}

export interface OrderInspectorView {
  header: {
    documentNo: string
    orderNo: string
    category: OrderDocumentCategory | null
    documentType: string
    status: string
    guardState: OrderGuardState | null
  }
  customer: { name: string; mobile: string }
  fulfilment: { storeCode: string; source: string; entryTime: string; deliveryNo: string | null }
  money: { net: string; due: string }
  /** `null` for an order that is not an insurance order. */
  insurance: {
    moneySource: MoneySource | null
    patientTotal: string
    insurerTotal: string
    /** `null` without the insurance-view grant — never shown, whatever the row carries. */
    ids: { patientId: string; memberId: string } | null
  } | null
  openTo: string | null
  deliveryTo: string | null
}

export function orderInspectorView(row: OrderDocumentRow, grants: QueryGrants): OrderInspectorView {
  const money = (value: number | null | undefined) => formatMoneyIn(value, row.currency)
  return {
    header: {
      documentNo: text(row.documentNo),
      orderNo: text(row.orderNo),
      category: row.documentCategory === 'O' || row.documentCategory === 'X' ? row.documentCategory : null,
      documentType: text(row.documentTypeDescription) || text(row.documentType),
      status: text(row.statusDescription) || text(row.status),
      guardState: row.guardState && row.guardState !== 'none' ? row.guardState : null,
    },
    customer: { name: text(row.customerName), mobile: text(row.customerPhone) },
    fulfilment: {
      storeCode: text(row.storeCode),
      source: text(row.documentSourceDescription) || text(row.documentSource),
      entryTime: formatDateTime(row.entryTime),
      deliveryNo: text(row.deliveryNo) || null,
    },
    money: { net: money(row.netTotal), due: money(row.amountDue) },
    insurance: row.isInsuranceOrder
      ? {
          moneySource: row.moneySource,
          patientTotal: money(row.patientTotal),
          insurerTotal: money(row.insurerTotal),
          ids: grants.canViewInsurance ? { patientId: text(row.patientId), memberId: text(row.memberId) } : null,
        }
      : null,
    openTo: documentPathOf(row),
    deliveryTo: deliveryPathOf(row),
  }
}
