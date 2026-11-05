/**
 * The analytics probe (spec 766 §C, ticket 767) — apart from `./api` so the menu group, which imports it
 * eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { AnalyticsAccess } from '@/core/models/analytics'

/** The ONE cache key the menu leaf and every analytics page's gate share, so the probe costs one call. */
export const ANALYTICS_ACCESS_KEY = ['analytics', 'access'] as const

/** The options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function analyticsAccessQuery() {
  return {
    queryKey: ANALYTICS_ACCESS_KEY,
    queryFn: () => analyticsAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's one predicate, read by the menu and the pages' gates. `=== true` and nothing looser, so
 * an absent or malformed answer is a denial (766 §C: absent or unreachable means denied).
 */
export const canViewAnalytics = (r: AnalyticsAccess | null | undefined): boolean => r?.canView === true

/** The curator grant (`AnalyticsCurate`, working name) — read by 778's certify actions. */
export const canCurateAnalytics = (r: AnalyticsAccess | null | undefined): boolean => r?.canCurate === true

export const analyticsAccessApi = {
  /**
   * `GET Analytics/Access` → `{ canView, canCurate }`.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: the door (BackOffice 3378) is not built, and a probe
   * that degraded to *shown* would advertise a screen nobody can hold the grant for.
   */
  access(): Promise<AnalyticsAccess> {
    return api.get<AnalyticsAccess>('Analytics/Access')
  },
}
