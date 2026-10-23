/**
 * The dispatch scorecard's access probe (ticket 543, BackOffice 2965; ruling 2950 point 5) — apart from
 * `./api` so the OMS menu leaf, which imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { DispatchScorecardAccess } from '@/core/models/dispatch-scorecard'

/** The ONE cache key the menu leaf and the page's gate share, so the probe costs one call. */
export const DISPATCH_SCORECARD_ACCESS_KEY = ['oms', 'dispatch-scorecard', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function dispatchScorecardAccessQuery() {
  return {
    queryKey: DISPATCH_SCORECARD_ACCESS_KEY,
    queryFn: () => dispatchScorecardAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's one predicate, read by BOTH the menu leaf and the page's gate (the 2949 pattern). `=== true`
 * and nothing looser, so a malformed answer is a denial. The Staff tab sits behind the same grant (2950
 * point 6), so it has no flag of its own.
 */
export const canOpenDispatchScorecard = (r: DispatchScorecardAccess | null | undefined): boolean => r?.screenAllowed === true

export const dispatchScorecardAccessApi = {
  /**
   * `GET DispatchScorecard/Access` → `{ screenAllowed }`, cookie only, not grant-gated.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: the door (BackOffice 2965) is merged but not deployed,
   * and a probe that degraded to *shown* would advertise a screen nobody can hold the grant for.
   */
  access(): Promise<DispatchScorecardAccess> {
    return api.get<DispatchScorecardAccess>('DispatchScorecard/Access')
  },
}
