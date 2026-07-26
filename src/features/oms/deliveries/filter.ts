import { toIsoDate } from '@/core/util/date-format'

/** Default row limit for the Delivery Documents search. */
export const DEFAULT_LIMIT = 200

/**
 * The Screen 1 filter panel's value — one field per filter input.
 * Every field is nullable: `null`/blank means "no filter" and is omitted from
 * the request by {@link buildDeliveryQuery}.
 */
export interface DeliveryFilterCriteria {
  fromDate: Date | null
  toDate: Date | null
  documentType: string | null
  documentSource: string | null
  deliveryDocumentType: string | null
  documentNo: string | null
  limit: number | null
  deliveryNo: string | null
  storeCode: string | null
  customerPhone: string | null
  orderNo: string | null
  deliveryType: string | null
  documentReason: string | null
  isExpress: boolean | null
}

export const BLANK_CRITERIA: DeliveryFilterCriteria = {
  fromDate: null,
  toDate: null,
  documentType: null,
  documentSource: null,
  deliveryDocumentType: null,
  documentNo: null,
  limit: DEFAULT_LIMIT,
  deliveryNo: null,
  storeCode: null,
  customerPhone: null,
  orderNo: null,
  deliveryType: null,
  documentReason: null,
  isExpress: null,
}

/** Append a text filter, trimmed, only when it carries a non-empty value. */
function assignText(params: Record<string, unknown>, key: string, value: string | null | undefined): void {
  const trimmed = value?.trim()
  if (trimmed) params[key] = trimmed
}

/**
 * Build the `GET SdDocumentWeb/DeliveryDocumentList` query from the panel value.
 *
 * - empty/blank filters are omitted entirely;
 * - `Limit` is ALWAYS sent — a cleared/invalid value falls back to {@link DEFAULT_LIMIT};
 * - `FromDate`/`ToDate` are sent only when BOTH ends of the range are set;
 * - `IsExpress` is sent only when explicitly Yes/No (tri-state).
 *
 * ⚠ The dropdown filters send the lookup DESCRIPTION text, not the code
 * (`DeliveryType=PickInStore`) — deliberate WPF parity, open question R-3
 * (403 §3.1/§8.1). Switching to codes is a change to this function only.
 */
export function buildDeliveryQuery(criteria: DeliveryFilterCriteria): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  params['Limit'] = criteria.limit && criteria.limit > 0 ? criteria.limit : DEFAULT_LIMIT

  if (criteria.fromDate && criteria.toDate) {
    params['FromDate'] = toIsoDate(criteria.fromDate)
    params['ToDate'] = toIsoDate(criteria.toDate)
  }

  assignText(params, 'DocumentType', criteria.documentType)
  assignText(params, 'DocumentSource', criteria.documentSource)
  assignText(params, 'DeliveryDocumentType', criteria.deliveryDocumentType)
  assignText(params, 'DocumentNo', criteria.documentNo)
  assignText(params, 'DeliveryNo', criteria.deliveryNo)
  assignText(params, 'StoreCode', criteria.storeCode)
  assignText(params, 'CustomerPhone', criteria.customerPhone)
  assignText(params, 'OrderNo', criteria.orderNo)
  assignText(params, 'DeliveryType', criteria.deliveryType)
  assignText(params, 'DocumentReason', criteria.documentReason)

  if (criteria.isExpress !== null && criteria.isExpress !== undefined) {
    params['IsExpress'] = criteria.isExpress
  }

  return params
}
