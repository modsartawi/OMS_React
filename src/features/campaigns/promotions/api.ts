import { api } from '@/core/api'
import type { RulePromotionSummary } from '@/core/models/rule-promotion'

// The rule engine's promotion doors (BackOffice ADR 0097, tickets 2846-2847 renamed by 2862; the 2737
// brief's section "HQ contract: promotions (2846-2847)"): every door POST, cookie session, each with
// its OWN grant on `BackOfficeScreen[RuleAuthoring, command]` — 03 reader for the list and a
// promotion's campaigns, 02 author for the writes. There is no access probe: a session without the
// grant is a BARE 403 with no body, which the page names through `isBareDenial`. No promotion door
// writes a ruleset version or asks for approval. Calls go through @/core/api
// (.claude/rules/api-envelope.md).
const LIST = 'Rules/Authoring/Promotions/List'

export const promotionApi = {
  /**
   * POST Rules/Authoring/Promotions/List (the door reads no body; an empty one is sent) — every promotion, newest first (a pending upload
   * not yet activated is already its promotion), then the no-promotion row (`promotionCode: null`).
   */
  list(): Promise<RulePromotionSummary[]> {
    return api.post<RulePromotionSummary[]>(LIST, {})
  },
}

/** Every promotion query. A refusal is final (a bare 403), so the list does not retry it. */
export const RULE_PROMOTIONS_KEY = ['rule-promotions'] as const

export const promotionsQuery = () => ({
  queryKey: [...RULE_PROMOTIONS_KEY, 'list'] as const,
  queryFn: promotionApi.list,
  retry: false,
})
