import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { RulePromotionAssignBody, RulePromotionAssignment, RulePromotionBody, RulePromotionRecord } from '@/core/models/rule-promotion'
import { RULE_PROMOTIONS_KEY } from '@/core/rules/api'

// A hand-made promotion's writes (ticket 536; BackOffice 2847 renamed by 2862, the 2737 brief's
// `Promotions/Create|Update|Assign|Unassign|Delete` rows): every door POST, cookie session, the 02
// author grant on `BackOfficeScreen[RuleAuthoring, command]`. There is no access probe: a session
// without the grant is a BARE 403 with no body, said in the dialog that made the call. No promotion
// door writes a ruleset version or asks for approval: each write happens at once. The reads stay in
// `@/core/rules/promotion-api` (the workspace reads them too). Calls go through @/core/api
// (.claude/rules/api-envelope.md).
const CREATE = 'Rules/Authoring/Promotions/Create'
const UPDATE = 'Rules/Authoring/Promotions/Update'
const ASSIGN = 'Rules/Authoring/Promotions/Assign'
const UNASSIGN = 'Rules/Authoring/Promotions/Unassign'
const DELETE = 'Rules/Authoring/Promotions/Delete'

export const promotionWriteApi = {
  /** A hand-made promotion (`origin: manual`). 409 `RULES_PROMOTION_EXISTS`; 400 `RULES_PROMOTION_BAD`. */
  create(body: RulePromotionBody): Promise<RulePromotionRecord> {
    return api.post<RulePromotionRecord>(CREATE, body)
  },

  /** Names and note of any promotion (an uploaded one too); the code never changes. 404 `RULES_PROMOTION_NOT_FOUND`. */
  update(body: RulePromotionBody): Promise<RulePromotionRecord> {
    return api.post<RulePromotionRecord>(UPDATE, body)
  },

  /** Puts the campaigns in the promotion, taking each from the promotion it was in (`moved`). All or none. */
  assign(promotionCode: string, campaigns: string[]): Promise<RulePromotionAssignment> {
    const body: RulePromotionAssignBody = { promotionCode, campaigns }
    return api.post<RulePromotionAssignment>(ASSIGN, body)
  },

  /** Takes the campaigns out of their promotion: they go to no promotion. All or none. */
  unassign(campaigns: string[]): Promise<RulePromotionAssignment> {
    const body: RulePromotionAssignBody = { campaigns }
    return api.post<RulePromotionAssignment>(UNASSIGN, body)
  },

  /** A hand-made promotion with no campaigns. 409 `RULES_PROMOTION_NOT_EMPTY`, `RULES_PROMOTION_OWNED`. */
  remove(promotionCode: string): Promise<RulePromotionRecord> {
    return api.post<RulePromotionRecord>(DELETE, { promotionCode })
  },
}

/**
 * After every write, and after a refusal that may say the page is stale: the promotions list and
 * every promotion's campaign pages — both sides of a move, and no-promotion — are read afresh (all of
 * them are keyed under RULE_PROMOTIONS_KEY). A promotion write touches no draft, so core's
 * `refreshCampaignLists` (promotions + drafts) is more than it needs. Resolves once the shown ones
 * are read, for a caller that must wait for them (Create opens the new promotion's page from the list).
 */
export function refreshPromotions(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: RULE_PROMOTIONS_KEY })
}
