/**
 * The Insurance rules area's access probe (BackOffice 3459, oms 852). In `@/core/` because every leaf of the group
 * is a different feature under `features/insurance-rules/*`, and a feature may never import another.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { InsuranceRulesAccess } from '@/core/models/insurance-rules-access'

/** The ONE cache key every leaf of the group and any page gate share: one call draws the whole group. */
export const INSURANCE_RULES_ACCESS_KEY = ['insurance-rules', 'access'] as const

/** …and the one set of options every reader passes. */
export function insuranceRulesAccessQuery() {
  return {
    queryKey: INSURANCE_RULES_ACCESS_KEY,
    queryFn: () => insuranceRulesAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** Every flag, in the menu's order. As 3459 ships them — see `InsuranceRulesAccess`. */
export const INSURANCE_RULES_FLAGS = [
  'canGuards',
  'canTemplates',
  'canLists',
  'canFields',
  'canApprovals',
  'canSimulator',
  'canEditions',
  'canReview',
  'canExceptions',
  'canMetrics',
  'canInsurers',
  'canCategories',
  'canCoverage',
  'canPlayground',
  'canInspector',
  'canFieldProposals',
  'canAliases',
  'canCodeLabels',
  'canIdfMasters',
  'canIdfStoreLists',
  'canIdfExceptions',
  'canIdfLookup',
  'canIdfEvents',
  'canIdfGroups',
] as const satisfies readonly (keyof InsuranceRulesAccess)[]

export type InsuranceRulesFlag = (typeof INSURANCE_RULES_FLAGS)[number]

/**
 * The one predicate builder every reader takes: the leaf's flag, and 🚩 only an explicit `true` grants — an absent
 * flag, a missing answer or a malformed value all read as no, so the group keeps failing closed.
 */
export const canOpenInsuranceRules =
  (key: InsuranceRulesFlag) =>
  (r: Partial<InsuranceRulesAccess> | null | undefined): boolean =>
    typeof r === 'object' && r !== null && r[key] === true

export const insuranceRulesAccessApi = {
  /**
   * `GET InsuranceRules/Access` → one boolean per leaf, cookie only.
   * 🚩 Fails closed: no 404-tolerant catch — until 3459 is deployed the door 404s and the whole group hides.
   */
  access(): Promise<InsuranceRulesAccess> {
    return api.get<InsuranceRulesAccess>('InsuranceRules/Access')
  },
}
