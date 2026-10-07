/**
 * The donor request list's server call (ticket 431, spec 430 D3). The probe is the shared OMS one
 * (`@/core/oms/api`); this read has one consumer, so it stays here.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 */
import { api } from '@/core/api'
import type { DonorRequestListResponse } from '@/core/models/sd-document'
import { criteriaToParams, type DonorRequestCriteria } from './criteria'

export const donorRequestsApi = {
  /**
   * `GET SdDocumentWeb/DonorRequests` → `{ rows, limited }` — every store's donor requests that
   * match. 🚩 The door is BackOffice ask BO-2 and is NOT built: this is written against spec 430
   * D3's proposed shape, plus the `requestNo` filter ticket 431 added for 434's link. A grant
   * refusal is the usual business 403, shown with its own message.
   */
  async list(criteria: DonorRequestCriteria): Promise<DonorRequestListResponse> {
    const data = await api.get<DonorRequestListResponse | null>('SdDocumentWeb/DonorRequests', criteriaToParams(criteria))
    const rows = data?.rows ?? []
    // A one-request search carries no date bound. A server that has not learned `requestNo`
    // ignores it and answers every request it holds, so only the asked-for one is kept.
    const no = criteria.requestNo.trim()
    return { rows: no ? rows.filter((r) => (r.requestNo ?? '').trim() === no) : rows, limited: data?.limited === true }
  },
}
