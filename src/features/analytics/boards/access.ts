/**
 * The analytics boards' reading of the one permissions answer (oms 909, BackOffice spec 4002). The four grants are
 * named in `@/core/analytics-access` (the copilot reads them too); this module adds what only the boards need — the
 * render-ticket reading and the lost-grant refusal — and stays apart from `./api` so the menu group, which imports it
 * eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api, apiErrorCode } from '@/core/api'
import { PERMISSIONS_KEY, permissionsFromQuery, permissionsOf, permissionsQuery, type Permissions } from '@/core/permissions'
import { renderTicket } from './render-ticket'

/**
 * 835: under a render ticket (the PDF's print page, no session) the run is its owner's, and the page reads as a
 * runner's: the view grant and nothing more, with no call (`Auth/Permissions` would only answer 401).
 */
export const RENDER_TICKET_PERMISSIONS: Permissions = permissionsOf({ screens: ['Analytics:03'] })

/** The permissions every analytics reader takes: the one answer, or the runner's under a render ticket. */
export function useAnalyticsPermissions(): Permissions {
  const ticketed = renderTicket() !== null
  const q = useQuery({ ...permissionsQuery(), enabled: !ticketed })
  return ticketed ? RENDER_TICKET_PERMISSIONS : permissionsFromQuery(q)
}

/** `ANALYTICS-415` "needs the author grant": a stale answer offered an author's action. */
export const needsAuthor = (err: unknown): boolean => apiErrorCode(err) === 'ANALYTICS-415'

/**
 * After a lost-grant refusal (`ANALYTICS-415`, or the curator's), the one permissions answer is asked again, so the
 * actions it no longer covers hide next time (§C's "hides the action next time"). A 403 does this by itself
 * (`@/core/api`); this covers a refusal answered under another status.
 */
export function refreshAfterLostGrant(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: PERMISSIONS_KEY, exact: true })
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
