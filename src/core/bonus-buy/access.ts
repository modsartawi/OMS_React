/**
 * The bonus-buy maintenance grants (BackOffice spec 2374, spec 2396), over the one permissions answer since oms 914.
 *
 * Graduated here from `features/pricing/bonus-buy-maintenance/api.ts` by oms 958: the bulk change screen
 * (BackOffice spec 4190 story 47) is a second feature gated by the SAME grant, and a feature may never import
 * another. Maintenance re-exports both, so its call sites are unchanged.
 */
import type { Permissions } from '@/core/permissions'

/**
 * The screen grant (`BbyMaintain:03`), for the nav leaves and the screen gates alike. These screens WRITE to every
 * till's offers: a pending or failed answer is a denial (fail closed).
 */
export const canOpenBbyMaintain = (p: Permissions): boolean => p.has('BbyMaintain:03')

/**
 * The tester grant (`BbyMaintain:04`, spec 2396) — Mark Tested — and only BESIDE the screen grant: `:04` without
 * `:03` offers nothing (brief 3995's BbyMaintain combination).
 */
export const canTestBbyMaintain = (p: Permissions): boolean => p.has('BbyMaintain:03') && p.has('BbyMaintain:04')
