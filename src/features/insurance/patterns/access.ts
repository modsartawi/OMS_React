/**
 * The pattern screens' grants (oms 922-924, BackOffice spec 4050, 4053), read off the ONE permissions answer (oms 914).
 * In the feature, not `@/core/`: their only readers are this feature's pages and the nav leaves, and `layout/` may reach
 * into a feature.
 *
 * Reconciled with BackOffice 4053/4055/4056's seed: the CONTROLLER `InsurancePattern` — 03 view (the list and a case), 02
 * mark, 06 reveal, 01 manage (the settings and the reveal log). Each predicate reads its one key, and a caller that needs
 * two asks both.
 */
import type { Permissions } from '@/core/permissions'

/** `InsurancePattern:03` (view): the case list, a case's screen and its marks as read, and the nav leaf. */
export const canOpenPatternCases = (p: Permissions): boolean => p.has('InsurancePattern:03')

/** `InsurancePattern:02` (mark): the form that sets a case's status with a note. The marks list shows without it. */
export const canMarkCase = (p: Permissions): boolean => p.has('InsurancePattern:02')

/** `InsurancePattern:06` (reveal): "Show patient" on a case (923), and half of "Add to blocked-patient list" (924). */
export const canRevealPatient = (p: Permissions): boolean => p.has('InsurancePattern:06')

/** `InsurancePattern:01` (manage): the thresholds and the reveal log (924). */
export const canManagePatterns = (p: Permissions): boolean => p.has('InsurancePattern:01')

/** `INSURANCE_PATIENT_BLOCK` Change (3965's own key): the other half of "Add to blocked-patient list" (924). */
export const canBlockPatient = (p: Permissions): boolean => p.has('InsurancePatientBlock:02')
