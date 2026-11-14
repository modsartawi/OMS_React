/**
 * The Bupa line outcomes probe (oms 899, BackOffice 3889) — apart from `./api` so the OMS menu leaf, which imports it
 * eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { BupaOutcomeAccess } from '@/core/models/bupa-line-outcome'

/** The ONE cache key the menu leaf and the page's gate share, so the probe costs one call. */
export const BUPA_OUTCOME_ACCESS_KEY = ['oms', 'bupa-line-outcomes', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function bupaOutcomeAccessQuery() {
  return {
    queryKey: BUPA_OUTCOME_ACCESS_KEY,
    queryFn: () => bupaOutcomeAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The probe's one predicate, read by BOTH the menu leaf and the page's gate. `=== true`, so a malformed answer is a denial. */
export const canViewBupaOutcomes = (r: BupaOutcomeAccess | null | undefined): boolean => r?.canView === true

export const bupaOutcomeAccessApi = {
  /**
   * `GET BupaLineOutcomes/Access` → `{ canView }`, cookie only, not grant-gated (`BupaLineOutcomes.View`,
   * `[BupaLineOutcomes, 03]`).
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: a probe that degraded to *shown* would advertise a screen nobody
   * can hold the grant for.
   */
  access(): Promise<BupaOutcomeAccess> {
    return api.get<BupaOutcomeAccess>('BupaLineOutcomes/Access')
  },
}
