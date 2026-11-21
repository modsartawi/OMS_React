/**
 * The price command center's grants (oms 934, BackOffice spec 4127), read off the one permissions answer (oms 914) — not
 * the `PriceWatch/Access` probe, which the app no longer calls:
 * `BackOfficeScreen[PriceWatch, 03]` = View (role `OMS_PRICE_WATCH_VIEWER`, every GET) and `[PriceWatch, 06]` = Manage
 * (role `OMS_PRICE_WATCH_MANAGER`, every write). Manage implies View by ROLE, not by code — so the page gates on View and
 * the buttons on Manage, and neither predicate assumes the other.
 */
import type { Permissions } from '@/core/permissions'

/** `PriceWatch:03` — the menu leaf's and the page gate's one predicate. */
export const canViewPriceWatch = (p: Permissions): boolean => p.has('PriceWatch:03')

/** `PriceWatch:06` — the decision and matching buttons. */
export const canManagePriceWatch = (p: Permissions): boolean => p.has('PriceWatch:06')

/**
 * The Index tab (938): `PriceWatch:03` AND `Analytics:03`. The price index lives in Cube, read through
 * `POST Analytics/Query`, whose door is gated `BackOfficeScreen[Analytics, 03]` — a PriceWatch-only user would get a 403
 * there, so the tab is hidden for them. 🚩 Orchestrator ruling, owner ruling owed (ticket 938 Comments): or a BO
 * PriceWatch door that proxies the index.
 */
export const canViewPriceIndex = (p: Permissions): boolean => canViewPriceWatch(p) && p.has('Analytics:03')
