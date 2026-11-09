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
 * The authoring family's screens (Promotions, Priority, Simulator, Campaign uploads) open on `[RuleAuthoring, 03]`, which
 * 3459 gives no flag of its own: author (02) OR approver (06) stands in, because the seeds bind 03 to both roles.
 * ⚠ An approver sees Simulator and is refused on Simulate (02); a DB without the approval seed would show an author
 * leaves whose reads refuse.
 */
export const canReadAuthoring = (r: Answer): boolean => flag(r, 'canAuthor') || flag(r, 'canApprove')

/** Campaign upload — a workbook becomes drafts: the author's act, not the approver's. */
export const canAuthorRules = (r: Answer): boolean => flag(r, 'canAuthor')

/**
 * Support's screens: Sessions reads `[RuleSupport, 03]`. ⚠ Coupon finder and Customers ride it too, provisionally:
 * their doors (`RuleCampaign/Coupons`, `RuleCampaign/Members`) do not exist yet, so no grant can be read for them.
 */
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
