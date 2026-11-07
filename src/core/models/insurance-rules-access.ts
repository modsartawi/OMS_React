/**
 * `GET InsuranceRules/Access` (BackOffice 3459, oms 852): one flag per leaf of the Insurance rules nav group, each
 * read by the server off the grant that leaf's doors check — so the client never learns a grant name.
 *
 * 🚩 The flag NAMES are this repo's guess: 3459 left "one flag per leaf, or one per grant" open and preferred per
 * leaf. Each is `can` + the leaf's `menu.*` key; `INSURANCE_RULES_FLAGS` (`@/core/insurance-rules/access`) is the
 * one list to re-point if the door spells them otherwise.
 */
export interface InsuranceRulesAccess {
  canGuards: boolean
  canTemplates: boolean
  canLists: boolean
  canFields: boolean
  canApprovals: boolean
  canSimulator: boolean
  canEditions: boolean
  canReview: boolean
  canExceptions: boolean
  canMetrics: boolean
  canInsurers: boolean
  canCategories: boolean
  canCoverage: boolean
  canPlayground: boolean
  canInspector: boolean
  canFieldProposals: boolean
  canAliases: boolean
  canCodeLabels: boolean
  canIdfMasters: boolean
  canIdfStoreLists: boolean
  canIdfExceptions: boolean
  canIdfLookup: boolean
  canIdfEvents: boolean
  canIdfGroups: boolean
}
