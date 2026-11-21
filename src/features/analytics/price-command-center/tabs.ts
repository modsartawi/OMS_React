/**
 * The price command center's tab strip (oms 934, BackOffice spec 4127 decision 8): Index · Alerts · Grid · Matching ·
 * Feed health, in that order. A tab shows when it is BUILT and the user may open it (its own predicate). Pure: the
 * registry of components is `tab-registry.tsx`; this module only decides which ids show and which one opens.
 */
import type { Permissions } from '@/core/permissions'

/** Every tab id, in strip order. A tab ticket flips its registry entry's `built`, never this list. */
export const TAB_IDS = ['index', 'alerts', 'grid', 'matching', 'feed-health'] as const
export type TabId = (typeof TAB_IDS)[number]

/** What `visibleTabs` reads off a registry entry. */
export interface TabEntry {
  id: TabId
  /** The tab's own gate over the one permissions answer. */
  can: (p: Permissions) => boolean
  /** False until the tab's ticket lands: an unbuilt tab is hidden. */
  built: boolean
}

/** The tabs to draw, in registry (strip) order. */
export function visibleTabs(registry: readonly TabEntry[], p: Permissions): TabId[] {
  return registry.filter((tab) => tab.built && tab.can(p)).map((tab) => tab.id)
}

/** The tab that opens: the one the URL names when it is visible, else Alerts, else the first visible. */
export function defaultTab(visible: readonly TabId[], asked: string | null): TabId | null {
  const named = visible.find((id) => id === asked)
  if (named) return named
  if (visible.includes('alerts')) return 'alerts'
  return visible[0] ?? null
}
