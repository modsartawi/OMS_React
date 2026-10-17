import { useOutletContext } from 'react-router'
import type { RuleDraft } from '@/core/models/rule-campaign'

/**
 * What the workspace shell hands every page inside it: the campaign's draft as `Rules/Authoring/
 * Drafts/Load` answers it (ticket 522) — the campaign JSON, its features, revision, state and
 * validation. The shell reads it once and renders its pages only once it has it, so a page never
 * draws a half-loaded campaign; a page saves the whole draft at its revision.
 */
export interface WorkspaceContext {
  draft: RuleDraft
}

export const useWorkspace = () => useOutletContext<WorkspaceContext>()
