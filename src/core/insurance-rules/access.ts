/**
 * The Insurance rules area's grants (BackOffice 3459, oms 852; oms 909: off the one permissions answer). In `@/core/`
 * because every leaf of the group is a different feature under `features/insurance-rules/*`, and a feature may never
 * import another.
 *
 * Each leaf keeps its 3459 flag name (`can` + the leaf's `menu.*` key) as the handle; the flag names the
 * `BackOfficeScreen` key on the door the leaf's page OPENS on (BackOffice brief 3995, row 14), so a read-only role
 * sees Simulator and is refused on Simulate.
 */
import type { Permissions, ScreenKey } from '@/core/permissions'

/** Each leaf's flag → the key it reads, in the menu's order. */
export const INSURANCE_RULES_GRANTS = {
  canGuards: 'InsuranceRuleAuthoring:03',
  canTemplates: 'InsuranceRuleAuthoring:03',
  canLists: 'InsuranceRuleAuthoring:03',
  // BackOffice 3982: the patient lists (blocked patients) are the insurance managers' own grant, never the authors'.
  canPatientLists: 'InsurancePatientBlock:03',
  canFields: 'InsuranceRuleAuthoring:03',
  canApprovals: 'InsuranceRuleAuthoring:03',
  canSimulator: 'InsuranceRuleAuthoring:03',
  canEditions: 'InsuranceReferenceEdition:03',
  canReview: 'InsuranceRuleAuthoring:03',
  canExceptions: 'InsuranceGuardException:03',
  canMetrics: 'InsuranceRuleAuthoring:03',
  // BackOffice 3980: the month's rule hits; no rules grant lights it.
  canRuleHits: 'InsuranceRuleHits:03',
  canInsurers: 'InsurerSettings:03',
  canCategories: 'InsuranceRuleAuthoring:03',
  canCoverage: 'InsuranceRuleAuthoring:03',
  canPlayground: 'InsuranceRulePlayground:01',
  canInspector: 'InsuranceRuleInspection:03',
  canFieldProposals: 'InsuranceRuleAuthoring:03',
  canAliases: 'InsuranceRuleAuthoring:03',
  canCodeLabels: 'InsuranceRuleAuthoring:03',
  canIdfMasters: 'IdfPriority:03',
  canIdfStoreLists: 'IdfPriority:03',
  canIdfExceptions: 'IdfPriority:03',
  canIdfLookup: 'IdfPriority:03',
  canIdfEvents: 'IdfPriority:03',
  canIdfGroups: 'IdfPriority:03',
} as const satisfies Record<string, ScreenKey>

export type InsuranceRulesFlag = keyof typeof INSURANCE_RULES_GRANTS

/** Every flag, in the menu's order. */
export const INSURANCE_RULES_FLAGS = Object.keys(INSURANCE_RULES_GRANTS) as InsuranceRulesFlag[]

/** The one predicate builder every reader takes: the leaf's flag → a predicate over the permissions answer. */
export const canOpenInsuranceRules =
  (flag: InsuranceRulesFlag) =>
  (p: Permissions): boolean =>
    p.has(INSURANCE_RULES_GRANTS[flag])
