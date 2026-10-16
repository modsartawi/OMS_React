import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { RuleCampaign, RuleCampaignCreate, RuleCampaignListRow } from '@/core/models/rule-campaign'

// The rule-campaign doors (spec 2737). Every endpoint string of the family lives in THIS file —
// campaigns, catalogue, lookups, validate, simulate, lifecycle, coupons and sessions as later
// slices add them — so ticket 520 re-points one file. Calls go through @/core/api
// (.claude/rules/api-envelope.md); a refusal is the standard envelope, read with apiErrorMessage.
//
// It sits in `core/` because the simulator (514), Priority (513) and support (518, 519) read
// campaigns too, and a feature may not import another feature's api.

// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const CAMPAIGNS = 'RuleCampaign/Campaigns'

/** Every campaign query — a write refreshes them all. */
export const RULE_CAMPAIGNS_KEY = ['rule-campaigns'] as const

/** One campaign, keyed by its id — the workspace shell and every page inside it share it. */
export const ruleCampaignKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'one', id] as const

export const ruleCampaignApi = {
  /** GET RuleCampaign/Campaigns — every campaign, unfiltered; the list counts and filters locally,
   *  because scheduled / running / expired are read at the reader's local now. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  list(): Promise<RuleCampaignListRow[]> {
    return api.get<RuleCampaignListRow[]>(CAMPAIGNS)
  },

  /** GET RuleCampaign/Campaigns/{id} — the whole campaign, rules included. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  get(id: string): Promise<RuleCampaign> {
    return api.get<RuleCampaign>(`${CAMPAIGNS}/${encodeURIComponent(id)}`)
  },

  /** POST RuleCampaign/Campaigns — a new draft from a name and features (BackOffice 2758); HQ
   *  answers with the whole draft, its code and id minted there. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  create(body: RuleCampaignCreate): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(CAMPAIGNS, body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Copy — an independent draft copied from a campaign
   *  (BackOffice 2759); HQ names it "<name> (copy)" and answers with the new draft. The original
   *  is untouched. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  copy(id: string): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(`${CAMPAIGNS}/${encodeURIComponent(id)}/Copy`, {})
  },
}

/** The list's query options. */
export const ruleCampaignsQuery = () => ({
  queryKey: [...RULE_CAMPAIGNS_KEY, 'list'] as const,
  queryFn: () => ruleCampaignApi.list(),
  retry: false as const,
})

/** One campaign's query options — the same key wherever it is read, so one call serves them all. */
export const ruleCampaignQuery = (id: string) => ({
  queryKey: ruleCampaignKey(id),
  queryFn: () => ruleCampaignApi.get(id),
  retry: false as const,
})

/**
 * A new draft HQ just made (a create or a copy, ticket 502): its own query is seeded, so its
 * dashboard opens without asking again, and the list is read afresh to count it.
 */
export function rememberNewDraft(queryClient: QueryClient, draft: RuleCampaign): void {
  queryClient.setQueryData(ruleCampaignKey(draft.id), draft)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
}
