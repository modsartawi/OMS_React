/**
 * `GET InsuranceRules/Access` (BackOffice 3459, oms 852): one flag per leaf of the Insurance rules nav group, each
 * read by the server off the grant that leaf's doors check — so the client never learns a grant name.
 *
 * Each flag is `can` + the leaf's `menu.*` key, as 3459 shipped them (`InsuranceRulesAccessWebEndpoints`); the
 * flag is the grant on the door the leaf's page OPENS on (so a read-only role sees Simulator and is refused on Simulate).
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
