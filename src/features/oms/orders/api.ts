import { api } from '@/core/api'
import type { OrderDocumentRow, OrderSearchCriteria } from '@/core/models/order-document'

// The Order / ERX search (BackOffice spec 3389, door 3391): `GET SdDocumentWeb/OrderDocumentList`,
// cookie-only, behind the OMS LIST grant (`canOpenList`). The OMS probe is `@/core/oms/api`'s.
//
// ⚠ Not built yet: stubbed in `tools/order-list-drive.mjs` until 3391 is on staging. The route
// and the PascalCase parameter names are 3391's own (`@/core/models/order-document`); a live call
// that disagrees corrects 3391 first, then the contract.
const BASE = 'SdDocumentWeb'

/** Append a text criterion, trimmed, only when it carries a value. */
function assignText(params: Record<string, unknown>, key: string, value: string | null | undefined): void {
  const trimmed = value?.trim()
  if (trimmed) params[key] = trimmed
}

/**
 * The door's query from the resolved criteria: blank criteria omitted, `FromDate`/`ToDate` only
 * when both ends are set (an identifier search has none), `HasDelivery` only when Yes or No, and
 * `Limit` always.
 */
export function buildOrderQuery(criteria: OrderSearchCriteria): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  if (criteria.fromDate && criteria.toDate) {
    params['FromDate'] = criteria.fromDate
    params['ToDate'] = criteria.toDate
  }
  assignText(params, 'OrderNo', criteria.orderNo)
  assignText(params, 'DocumentNo', criteria.documentNo)
  assignText(params, 'Approval', criteria.approval)
  assignText(params, 'PatientId', criteria.patientId)
  assignText(params, 'Mobile', criteria.mobile)
  assignText(params, 'MemberId', criteria.memberId)
  assignText(params, 'DocumentSource', criteria.documentSource)
  assignText(params, 'StoreCode', criteria.storeCode)
  assignText(params, 'DocumentType', criteria.documentType)
  assignText(params, 'Status', criteria.status)
  if (criteria.hasDelivery !== null && criteria.hasDelivery !== undefined) params['HasDelivery'] = criteria.hasDelivery
  if (criteria.moneySource) params['MoneySource'] = criteria.moneySource
  if (criteria.limit) params['Limit'] = criteria.limit
  return params
}

export const ordersApi = {
  /** The search; the server sorts newest first. */
  search(criteria: OrderSearchCriteria): Promise<OrderDocumentRow[]> {
    return api.get<OrderDocumentRow[]>(`${BASE}/OrderDocumentList`, buildOrderQuery(criteria))
  },
}
