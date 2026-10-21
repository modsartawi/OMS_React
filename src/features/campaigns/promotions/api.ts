import { keepPreviousData } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { RulePromotionCampaignPage, RulePromotionCampaignsBody, RulePromotionSummary } from '@/core/models/rule-promotion'
import { RULE_PROMOTIONS_KEY } from '@/core/rules/api'

// The rule engine's promotion doors (BackOffice ADR 0097, tickets 2846-2847 renamed by 2862; the 2737
// brief's section "HQ contract: promotions (2846-2847)"): every door POST, cookie session, each with
// its OWN grant on `BackOfficeScreen[RuleAuthoring, command]` — 03 reader for the list and a
// promotion's campaigns, 02 author for the writes. There is no access probe: a session without the
// grant is a BARE 403 with no body, which the page names through `isBareDenial`. No promotion door
// writes a ruleset version or asks for approval. Calls go through @/core/api
// (.claude/rules/api-envelope.md).
const LIST = 'Rules/Authoring/Promotions/List'
const CAMPAIGNS = 'Rules/Authoring/Promotions/Campaigns'

export const promotionApi = {
  /**
   * POST Rules/Authoring/Promotions/List (the door reads no body; an empty one is sent) — every promotion, newest first (a pending upload
   * not yet activated is already its promotion), then the no-promotion row (`promotionCode: null`).
   */
  list(): Promise<RulePromotionSummary[]> {
    return api.post<RulePromotionSummary[]>(LIST, {})
  },

  /**
   * POST Rules/Authoring/Promotions/Campaigns — one page of a promotion's campaigns (`promotionCode`
   * null = the campaigns in no promotion), filtered and paged by HQ, rows by id. 404
   * `RULES_PROMOTION_NOT_FOUND` for a code that is neither a record nor an upload.
   */
  campaigns(body: RulePromotionCampaignsBody): Promise<RulePromotionCampaignPage> {
    return api.post<RulePromotionCampaignPage>(CAMPAIGNS, body)
  },
}

// Every promotion query is keyed under core's RULE_PROMOTIONS_KEY: a campaign write refreshes them
// (`refreshCampaignLists`). A refusal is final (a bare 403, a 404), so none is retried.

export const promotionsQuery = () => ({
  queryKey: [...RULE_PROMOTIONS_KEY, 'list'] as const,
  queryFn: promotionApi.list,
  retry: false,
})

/** One page of a promotion's campaigns, keyed by its body; the page shown stays while the next loads. */
export const promotionCampaignsQuery = (body: RulePromotionCampaignsBody) => ({
  queryKey: [...RULE_PROMOTIONS_KEY, 'campaigns', body] as const,
  queryFn: () => promotionApi.campaigns(body),
  placeholderData: keepPreviousData,
  retry: false,
})
