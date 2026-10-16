import type { RuleCampaignFeatures } from '@/core/models/rule-campaign'

/**
 * The campaign's own menu (the prototype's `CMENU` + Settings ▸): Dashboard, Rule builder, Coupons
 * when the coupons feature is on, Versions, Settings. `to` is relative to the workspace (`''` =
 * `/campaigns/:id`).
 *
 * A feature decides which items show (ticket 502): Coupons only for a campaign with the coupons
 * feature. Separately, an item whose page has not landed yet (`landed: false`) is not drawn — each
 * slice flips its own item when its page arrives (Coupons: 515).
 */
export type WorkspaceMenuKey = 'dashboard' | 'rules' | 'coupons'

export interface WorkspaceMenuItem {
  key: WorkspaceMenuKey
  to: string
  /** Shown only when the campaign's features allow it. Absent = always. */
  when?: (features: RuleCampaignFeatures) => boolean
  /** False until the item's page lands; the shell leaves it out meanwhile. */
  landed: boolean
}

export const WORKSPACE_MENU: readonly WorkspaceMenuItem[] = [
  { key: 'dashboard', to: '', landed: true },
  { key: 'rules', to: 'rules', landed: true },
  { key: 'coupons', to: 'coupons', when: (f) => f.coupons, landed: false },
]

/** The menu items a campaign with these features offers, in menu order. */
export function workspaceMenu(features: RuleCampaignFeatures): WorkspaceMenuItem[] {
  return WORKSPACE_MENU.filter((item) => !item.when || item.when(features))
}

/** What the shell draws: the offered items whose page has landed. */
export function drawnMenu(features: RuleCampaignFeatures): WorkspaceMenuItem[] {
  return workspaceMenu(features).filter((item) => item.landed)
}
