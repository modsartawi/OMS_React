import type { Permissions } from '@/core/permissions'

/**
 * The Nphies area's grants (spec 209 §1; oms 914, BackOffice spec 4002), read off the one permissions answer.
 *
 * It lives in `@/core/` because the menu leaves and every screen in the `features/nphies/*` features read it, and a
 * feature may never import another. The whole area sits behind ONE grant, `Nphies:03`; the release and undispense
 * grants count only beside it. Neither is the gate — each act's own filter on the server is.
 */

/** The area's grant: the menu leaves and every page gate. */
export const canOpenNphies = (p: Permissions): boolean => p.has('Nphies:03')

/** Shows the Release button (contract 1.1, BackOffice 3342): the area grant AND the release grant. */
export const canReleaseApprovalNumber = (p: Permissions): boolean =>
  p.has('Nphies:03') && p.has('NphiesReleaseApproval:03')

/** Shows Retry and the manual Undispense (contract 1.2, BackOffice 3208): the area grant AND the undispense grant. */
export const canUndispense = (p: Permissions): boolean => p.has('Nphies:03') && p.has('NphiesUndispense:03')
