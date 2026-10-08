/**
 * The Document payments screen's server call (ticket 433, spec 430 D4). The probe is the shared OMS
 * one (`@/core/oms/api`); the document-type list is the cookie-open lookup (`@/core/services/lookups`).
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 */
import { api } from '@/core/api'
import type { DocumentPaymentListResponse } from '@/core/models/document-payment'
import { criteriaToParams, type PaymentsCriteria } from './criteria'

/** The door's refusal when the two number lists name more than 1,000 values (D4, proposed). */
export const TOO_MANY_VALUES = 'TOO_MANY_VALUES'

export const documentPaymentsApi = {
  /**
   * `GET SdDocumentWeb/DocumentPayments` → `{ rows, limited }`. 🚩 The door is BackOffice ask BO-3
   * and is NOT built: this is written against spec 430 D4's proposed shape. A grant refusal is the
   * usual business 403, and `TOO_MANY_VALUES` a business refusal, each shown with its own message.
   */
  async list(criteria: PaymentsCriteria): Promise<DocumentPaymentListResponse> {
    const data = await api.get<DocumentPaymentListResponse | null>('SdDocumentWeb/DocumentPayments', criteriaToParams(criteria))
    return { rows: data?.rows ?? [], limited: data?.limited === true }
  },
}
