import { useOutletContext } from 'react-router'
import type { RuleCampaign } from '@/core/models/rule-campaign'

/**
 * What the workspace shell hands every page inside it (dashboard now; the rule builder, settings,
 * coupons and versions as their slices land). The shell reads the campaign once and renders its
 * pages only once it has it, so a page never draws a half-loaded campaign.
 */
export interface WorkspaceContext {
  campaign: RuleCampaign
}

export const useWorkspace = () => useOutletContext<WorkspaceContext>()
