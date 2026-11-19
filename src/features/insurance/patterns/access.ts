/**
 * The pattern screens' grants (oms 922-924, BackOffice spec 4050, 4053), read off the ONE permissions answer (oms 914).
 * In the feature, not `@/core/`: their only readers are this feature's pages and the nav leaves, and `layout/` may reach
 * into a feature.
 *
 * 🚩 GUESSED keys: BackOffice 4053 names a CONTROLLER `InsurancePattern` with three roles, seeded like 3965 and given to
 * no one, but neither the seed nor its codes exist yet. Reconcile when 4053 lands. The roles nest on the server (an
 * investigator is also an analyst); each predicate reads its one key, and a caller that needs two asks both.
 */
import type { Permissions } from '@/core/permissions'

/** `INSURANCE_PATTERN_ANALYST`: the case list, a case's screen and its marks, and the nav leaf. */
export const canOpenPatternCases = (p: Permissions): boolean => p.has('InsurancePattern:03')

/** `INSURANCE_PATTERN_INVESTIGATOR`: "Show patient" on a case (923), and half of "Add to blocked-patient list" (924). */
export const canRevealPatient = (p: Permissions): boolean => p.has('InsurancePattern:06')

/** `INSURANCE_PATTERN_MANAGER`: the thresholds and the reveal log (924). */
export const canManagePatterns = (p: Permissions): boolean => p.has('InsurancePattern:02')

/** `INSURANCE_PATIENT_BLOCK` Change (3965's own key): the other half of "Add to blocked-patient list" (924). */
export const canBlockPatient = (p: Permissions): boolean => p.has('InsurancePatientBlock:02')
