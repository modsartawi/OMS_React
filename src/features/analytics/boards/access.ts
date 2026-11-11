/**
 * The analytics probe (spec 766 §C, ticket 767) — apart from `./api` so the menu group, which imports it
 * eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api, apiErrorCode } from '@/core/api'
import type { AnalyticsAccess } from '@/core/models/analytics'
import { renderTicket } from './render-ticket'

/** The ONE cache key the menu leaf and every analytics page's gate share, so the probe costs one call. */
export const ANALYTICS_ACCESS_KEY = ['analytics', 'access'] as const

/** The options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function analyticsAccessQuery() {
  return {
    queryKey: ANALYTICS_ACCESS_KEY,
    // 835: under a render ticket (the PDF's print page, no session) the run is its owner's; the page is read as a
    // runner's and the probe is never asked (it would answer 401 and send the renderer to the login page).
    queryFn: (): Promise<AnalyticsAccess> =>
      renderTicket() ? Promise.resolve({ canView: true, canAuthor: false, canCurate: false }) : analyticsAccessApi.access(),
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

/**
 * 822 (spec 819 §C/§E): the author grant — the builder and editor routes, "New view / board", edit, copy, Save as
 * my copy, share, certify and the ask box. On `canView`, and `=== true` like the others, so a v1 answer without
 * `canAuthor` is a runner. Curate implies author.
 */
export const canAuthorAnalytics = (r: AnalyticsAccess | null | undefined): boolean =>
  canViewAnalytics(r) && (r?.canAuthor === true || r?.canCurate === true)

/** `ANALYTICS-415` "needs the author grant": a stale probe offered an author's action. */
export const needsAuthor = (err: unknown): boolean => apiErrorCode(err) === 'ANALYTICS-415'

/**
 * The cached probe after an `ANALYTICS-415`: no author grant, so no curate either (curate implies author). Written
 * back under `ANALYTICS_ACCESS_KEY`, it hides the author's actions next time (§C's "hides the action next time").
 */
export const withoutAuthor = (r: AnalyticsAccess | undefined): AnalyticsAccess | undefined =>
  r ? { ...r, canAuthor: false, canCurate: false } : r

export const analyticsAccessApi = {
  /**
   * `GET Analytics/Access` → `{ canView, canAuthor, canCurate }` (822 adds `canAuthor`, spec 819 §C).
   *
   * 🚩 **Fails closed** — no 404-tolerant catch: the door (BackOffice 3378) is not built, and a probe
   * that degraded to *shown* would advertise a screen nobody can hold the grant for.
   */
  access(): Promise<AnalyticsAccess> {
    return api.get<AnalyticsAccess>('Analytics/Access')
  },
}

/**
 * 886 (BackOffice spec 3631 S30, contract 3662): the "My schedules" leaf's probe. Its own key, apart from the page's
 * list (`ANALYTICS_MY_SCHEDULES_KEY` in `./api`, which holds the READ rows): this one caches only whether the page is
 * offered, so the menu stays off `./api`'s bundle.
 */
export const MY_SCHEDULES_OFFERED_KEY = ['analytics', 'mySchedules', 'offered'] as const

/**
 * Whether the page is offered: the list door answers (any reader with the view grant). `ANALYTICS-424` — the
 * personal-schedules switch is off — is a plain no; any other failure is thrown, and the menu fails closed on it.
 */
export async function mySchedulesOffered(): Promise<boolean> {
  try {
    await api.get<unknown>('Analytics/MySchedules')
    return true
  } catch (err) {
    if (apiErrorCode(err) === 'ANALYTICS-424') return false
    throw err
  }
}
