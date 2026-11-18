/**
 * The payer-month screen's grant (oms 896, BackOffice 1628; oms 909: off the one permissions answer). In the
 * feature, not `@/core/`: its only readers are this page and the nav leaf, and `layout/` may reach into a feature.
 * It is NOT the Insurance rules area's grant — the screen has its own one grant (D36), `InsurancePayerMonth:03`.
 */
import type { Permissions } from '@/core/permissions'

/** The ONE reading of the grant: the nav leaf and the page's gate both pass this. */
export const canManagePayerMonths = (p: Permissions): boolean => p.has('InsurancePayerMonth:03')
