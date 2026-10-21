import { useOutletContext } from 'react-router'
import type { RuleDraft } from '@/core/models/rule-campaign'
import type { PromotionListContext } from '@/core/rules/promotion-query'

/**
 * What the workspace shell hands every page inside it: the campaign's draft as `Rules/Authoring/
 * Drafts/Load` answers it (ticket 522) — the campaign JSON, its features, revision, state and
 * validation. The shell reads it once and renders its pages only once it has it, so a page never
 * draws a half-loaded campaign; a page saves the whole draft at its revision.
 *
 * Since ticket 537, also the promotion's list the campaign was opened from (null for a direct link):
 * a page's link inside the workspace goes through `link`, so the list context survives every page.
 */
export interface WorkspaceContext {
  draft: RuleDraft
  listContext: PromotionListContext | null
  /** The way back: the promotion's page as filtered, the no-promotion page, or the Promotions list. */
  back: string
  /** A workspace address with the list context kept. */
  link: (path: string) => string
  /** The promotion whose upload this campaign is part of (`isUploadedCampaign`), or null. */
  uploadedFrom: string | null
}

export const useWorkspace = () => useOutletContext<WorkspaceContext>()
