/**
 * The expired approval picks report's access probe (BackOffice ticket 3874) — apart from `./api` so the OMS menu leaf,
 * which imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { ExpiredApprovalPickAccess } from '@/core/models/expired-approval-pick'

/** The ONE cache key the menu leaf and the page's gate share, so the probe costs one call. */
export const EXPIRED_APPROVAL_PICK_ACCESS_KEY = ['oms', 'expired-approval-picks', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function expiredApprovalPickAccessQuery() {
  return {
    queryKey: EXPIRED_APPROVAL_PICK_ACCESS_KEY,
    queryFn: () => expiredApprovalPickAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The probe's one predicate, read by BOTH the menu leaf and the page's gate. `=== true`, so a malformed answer is a denial. */
export const canOpenExpiredApprovalPicks = (r: ExpiredApprovalPickAccess | null | undefined): boolean =>
  r?.screenAllowed === true

export const expiredApprovalPickAccessApi = {
  /**
   * `GET ExpiredApprovalPick/Access` → `{ screenAllowed }`, cookie only, not grant-gated.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: a probe that degraded to *shown* would advertise a screen nobody can
   * hold the grant for (`BackOfficeScreen[ExpiredApprovalPick, 03]`, the insurance team's role).
   */
  access(): Promise<ExpiredApprovalPickAccess> {
    return api.get<ExpiredApprovalPickAccess>('ExpiredApprovalPick/Access')
  },
}
