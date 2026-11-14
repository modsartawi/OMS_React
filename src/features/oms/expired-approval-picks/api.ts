/**
 * The expired approval picks report's server call (BackOffice ticket 3874). Cookie-only and behind
 * `BackOfficeScreen[ExpiredApprovalPick, 03]`; the probe lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * 🚩 The report is read from the weekly fill, never computed on the request. Only a missing list is read as empty, so a
 * bare answer draws an empty grid, not a crash.
 */
import { api } from '@/core/api'
import type { ExpiredApprovalPickQuery, ExpiredApprovalPickReport } from '@/core/models/expired-approval-pick'

export const expiredApprovalPickApi = {
  /** `GET ExpiredApprovalPick/Report` → one filled week, per store and pharmacist and pick by pick. */
  async report(query: ExpiredApprovalPickQuery): Promise<ExpiredApprovalPickReport> {
    const data = await api.get<Partial<ExpiredApprovalPickReport> | null>('ExpiredApprovalPick/Report', { ...query })
    return {
      asOf: data?.asOf ?? '',
      weekStart: data?.weekStart ?? '',
      weekEnd: data?.weekEnd ?? '',
      filledAt: data?.filledAt ?? null,
      pharmacists: data?.pharmacists ?? [],
      rows: data?.rows ?? [],
    }
  },
}
