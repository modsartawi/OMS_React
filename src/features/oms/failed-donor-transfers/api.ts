/**
 * The Failed donor transfers screen's server call (ticket 434, spec 430 D5). The probe is the shared
 * OMS one (`@/core/oms/api`). The re-run door is 435's.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 */
import { api } from '@/core/api'
import type { FailedDonorTransferRow } from '@/core/models/failed-donor-transfer'

export const failedDonorTransfersApi = {
  /**
   * `GET SdDocumentWeb/FailedDonorTransfers` → `FailedDonorTransferRow[]` — the whole queue, no
   * filters (a work queue, not a history). 🚩 The door is BackOffice ask BO-4 and is NOT built:
   * this is written against spec 430 D5's proposed shape. A grant refusal is the usual business
   * 403, shown with its own message.
   */
  async list(): Promise<FailedDonorTransferRow[]> {
    const data = await api.get<FailedDonorTransferRow[] | null>('SdDocumentWeb/FailedDonorTransfers')
    return Array.isArray(data) ? data : []
  },
}
