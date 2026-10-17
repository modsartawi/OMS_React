import type { RuleFeature } from '@/core/models/rule-campaign'

/**
 * The campaign's own menu (the prototype's `CMENU` + Settings ▸): Dashboard, Rule builder, Coupons
 * when the coupons feature is on, Versions, Settings. `to` is relative to the workspace (`''` =
 * `/campaigns/:id`).
 *
 * A feature decides which items show (ticket 502): Coupons only for a campaign with the coupons
 * feature. Separately, an item whose page has not landed yet (`landed: false`) is not drawn — each
 * slice flipped its own item when its page arrived (Coupons: 515).
 */
export type WorkspaceMenuKey = 'dashboard' | 'rules' | 'coupons' | 'versions'

export interface WorkspaceMenuItem {
  key: WorkspaceMenuKey
  to: string
  /** Shown only when the campaign's features allow it. Absent = always. */
  when?: (features: readonly RuleFeature[]) => boolean
  /** False until the item's page lands; the shell leaves it out meanwhile. */
  landed: boolean
}

export const WORKSPACE_MENU: readonly WorkspaceMenuItem[] = [
  { key: 'dashboard', to: '', landed: true },
  { key: 'rules', to: 'rules', landed: true },
  { key: 'coupons', to: 'coupons', when: (f) => f.includes('coupons'), landed: true },
  { key: 'versions', to: 'versions', landed: true },
]

/** The menu items a campaign with these features offers, in menu order. */
export function workspaceMenu(features: readonly RuleFeature[]): WorkspaceMenuItem[] {
  return WORKSPACE_MENU.filter((item) => !item.when || item.when(features))
}

/** What the shell draws: the offered items whose page has landed. */
export function drawnMenu(features: readonly RuleFeature[]): WorkspaceMenuItem[] {
  return workspaceMenu(features).filter((item) => item.landed)
}

/**
 * Whether a workspace page has landed, by its path relative to the workspace (`'rules'`,
 * `'settings/details'` …). A page that has not landed is not linked to (ticket 511's pre-activation
 * steps): Settings' pages landed with 509, Budgets with 510.
 */
export function pageLanded(to: string): boolean {
  if (to.startsWith('settings/')) return settingsPage(to.slice('settings/'.length)) !== null
  return WORKSPACE_MENU.some((item) => item.to === to && item.landed)
}

/**
 * Settings ▸ (ticket 509; the prototype's `SMENU`): one page each, with its own Cancel / Save, at
 * `settings/<key>`. Budgets landed with 510.
 */
export type SettingsPageKey = 'details' | 'schedule' | 'audience' | 'features' | 'budgets' | 'offline'

export const SETTINGS_PAGES: readonly { key: SettingsPageKey; landed: boolean }[] = [
  { key: 'details', landed: true },
  { key: 'schedule', landed: true },
  { key: 'audience', landed: true },
  { key: 'features', landed: true },
  { key: 'budgets', landed: true },
  { key: 'offline', landed: true },
]

/** The Settings pages the shell draws, in menu order. */
export const drawnSettings = (): SettingsPageKey[] => SETTINGS_PAGES.filter((p) => p.landed).map((p) => p.key)

/** A landed Settings page by its route segment, or null for one unknown or not landed yet. */
export const settingsPage = (segment: string | undefined): SettingsPageKey | null =>
  SETTINGS_PAGES.find((p) => p.key === segment && p.landed)?.key ?? null
