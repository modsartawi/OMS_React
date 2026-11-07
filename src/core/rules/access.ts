/**
 * The rule engine's access probe (BackOffice 3459, oms 852). In `@/core/` because two areas read it: the Campaigns
 * nav group (eight leaves across `features/campaigns/*`) and the store engine switch (`features/admin/engine-switch`),
 * and a feature may never import another (`.claude/rules/feature-structure.md`).
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`). Pure apart from the call: no React, no `t`.
 */
import { api } from '@/core/api'
import type { RulesAccess } from '@/core/models/rule-campaign'

/** The ONE cache key every Campaigns leaf, the engine-switch leaf and any page gate share: one call for all nine. */
export const RULES_ACCESS_KEY = ['rules', 'access'] as const

/** …and the one set of options every reader passes: a refusal is an answer, a grant does not change in a page life. */
export function rulesAccessQuery() {
  return {
    queryKey: RULES_ACCESS_KEY,
    queryFn: () => rulesAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

type Answer = Partial<RulesAccess> | null | undefined

/** 🚩 Only an explicit `true` grants: an absent flag, a missing answer or `"true"` all read as no. */
const flag = (r: Answer, key: keyof RulesAccess): boolean => typeof r === 'object' && r !== null && r[key] === true

/**
 * The authoring family's screens (Promotions, Priority, Simulator, Campaign uploads): every door behind them reads
 * `BackOfficeScreen[RuleAuthoring]`, which the author AND the approver roles both hold.
 */
export const canReadAuthoring = (r: Answer): boolean => flag(r, 'canAuthor') || flag(r, 'canApprove')

/** Campaign upload — a workbook becomes drafts: the author's act, not the approver's. */
export const canAuthorRules = (r: Answer): boolean => flag(r, 'canAuthor')

/** Support's screens (Sessions, Coupon finder, Customers): `BackOfficeScreen[RuleSupport]`. */
export const canSupportRules = (r: Answer): boolean => flag(r, 'canSupport')

/** The store engine switch: `BackOfficeScreen[RuleEngineSwitch]`. */
export const canSwitchEngine = (r: Answer): boolean => flag(r, 'canSwitchEngine')

export const rulesAccessApi = {
  /**
   * `GET Rules/Access` → `{ canAuthor, canApprove, canSupport, canSwitchEngine }`, cookie only.
   * 🚩 Fails closed: no 404-tolerant catch — until 3459 is deployed the door 404s, and a 404 hides every leaf.
   */
  access(): Promise<RulesAccess> {
    return api.get<RulesAccess>('Rules/Access')
  },
}
