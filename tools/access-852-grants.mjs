// Oms 852 (BackOffice 3459): the three probes that now gate the Campaigns, engine-switch, Insurance rules and
// HQ prescription-session leaves, answered ALL-GRANTED — for drives whose subject is the page behind a leaf, not
// the gating. Each such drive asks `granted852(p)` ahead of its catch-all `/Access$/` answer.
// `tools/access-852-grants.test.mjs` pins the insurance flag list to `INSURANCE_RULES_FLAGS`.

export const INSURANCE_RULES_FLAGS_852 = [
  'canGuards', 'canTemplates', 'canLists', 'canFields', 'canApprovals', 'canSimulator', 'canEditions', 'canReview',
  'canExceptions', 'canMetrics', 'canInsurers', 'canCategories', 'canCoverage', 'canPlayground', 'canInspector',
  'canFieldProposals', 'canAliases', 'canCodeLabels', 'canIdfMasters', 'canIdfStoreLists', 'canIdfExceptions',
  'canIdfLookup', 'canIdfEvents', 'canIdfGroups',
]

export const GRANTED_852 = {
  'Rules/Access': { canAuthor: true, canApprove: true, canSupport: true, canSwitchEngine: true },
  'InsuranceRules/Access': Object.fromEntries(INSURANCE_RULES_FLAGS_852.map((f) => [f, true])),
  'PrescriptionSessionWeb/Access': { canView: true, canWriteOff: true },
}

/** The all-granted answer for one of the three 852 probes, or null for any other path. */
export const granted852 = (p) => GRANTED_852[p] ?? null
