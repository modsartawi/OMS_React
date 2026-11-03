/**
 * The sourcing advisor's server calls (ticket 738, spec 734 D20; door BackOffice BO-2, unbuilt — every
 * drive stubs exactly the D20 wire). Read-only. The probe lives in `@/core/sourcing-advisor/access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. The door's
 * refusals (`SOURCING-401` … `404`) are read by `./refusal`.
 *
 * 🚩 The reply is passed through as sent; only a missing list is read as empty (`./explain-model`).
 */
import { api } from '@/core/api'
import type { SourcingExplainReply } from '@/core/models/sourcing-advisor'

export const sourcingAdvisorApi = {
  /** `GET SourcingAdvisor/Explain?orderNo=` → one scored order's explanation. */
  explain(orderNo: string): Promise<Partial<SourcingExplainReply> | null> {
    return api.get<Partial<SourcingExplainReply> | null>('SourcingAdvisor/Explain', { orderNo })
  },
}
