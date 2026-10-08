/**
 * What a payment row opens (ticket 433, spec 430 D10). Pure.
 *
 * Its document always, its delivery only when the row names one — a row without a delivery offers
 * no action rather than a dead link. Both are Document Details' existing routes: this feature never
 * imports the `document` feature, it navigates to it.
 */
import type { DocumentPaymentModel } from '@/core/models/document-payment'

export interface PaymentRowOffers {
  /** Document Details' document route; `null` for a row with no document number. */
  document: string | null
  /** Document Details' delivery route; `null` when the row has no delivery. */
  delivery: string | null
}

const route = (base: string, no: string | null | undefined): string | null => {
  const trimmed = typeof no === 'string' ? no.trim() : ''
  return trimmed ? `${base}/${encodeURIComponent(trimmed)}` : null
}

export function paymentRowOffers(row: Pick<DocumentPaymentModel, 'documentNo'> & { deliveryNo?: string | null }): PaymentRowOffers {
  return { document: route('/oms/document', row.documentNo), delivery: route('/oms/delivery', row.deliveryNo) }
}
