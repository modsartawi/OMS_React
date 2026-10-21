import { ruleCampaignApi, ruleDraftsQuery } from '@/core/rules/api'
import { composePriorityCampaigns, type PriorityCampaign } from './priority-campaigns'

// Priority's own read of the campaigns it orders (ticket 535 moved it here from core, where it was
// the campaign area's list): their state badges and features, composed from POST
// Rules/Authoring/Drafts/List, POST Rules/Authoring/Order and POST Rules/Authoring/Versions/Load of
// the order's version (`composePriorityCampaigns`). Every door is core's (`ruleCampaignApi`, through
// @/core/api); only the composition is Priority's.

export const priorityCampaignsApi = {
  async list(): Promise<PriorityCampaign[]> {
    const [drafts, order] = await Promise.all([ruleCampaignApi.drafts(), ruleCampaignApi.order()])
    const live = order.versionNo > 0 ? await ruleCampaignApi.version(order.versionNo) : null
    return composePriorityCampaigns(drafts, order, live?.ruleset ?? null)
  },
}

/**
 * The query's options, keyed UNDER the drafts' key: a campaign write refreshes the drafts
 * (`refreshCampaignLists`), and with them this reader. Read afresh each time Priority opens.
 */
export const priorityCampaignsQuery = () => ({
  queryKey: [...ruleDraftsQuery().queryKey, 'priority'] as const,
  queryFn: () => priorityCampaignsApi.list(),
  retry: false as const,
})
