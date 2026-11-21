import type { ComponentType } from 'react'
import { canViewPriceIndex, canViewPriceWatch } from './access'
import AlertsTab from './AlertsTab'
import FeedHealthTab from './FeedHealthTab' // 939
import IndexTab from './IndexTab'
import GridTab from './GridTab'
import MatchingTab from './MatchingTab'
import type { TabEntry } from './tabs'

/**
 * 🔀 The price command center's tab registry (oms 934, BackOffice spec 4127 decision 8) — the ONE place a tab is added.
 *
 * Each tab is its own file exporting a default component with no props; adding one is a single entry here: its id (from
 * `TAB_IDS`, which fixes the strip order), its own predicate, `built: true` and its component. Keep the entries in
 * `TAB_IDS` order — the strip draws them as listed. An entry whose ticket has not landed stays `built: false` with no
 * panel, so the strip hides it. The tab's label is `tabs.<id>` in the `price-command-center` namespace (already there).
 *
 * The page is gated on View (`canViewPriceWatch`); a tab that needs more (Index: `Analytics:03` for `Analytics/Query`)
 * says so in its own predicate.
 */
export interface TabRegistration extends TabEntry {
  Panel: ComponentType | null
}

export const TAB_REGISTRY: readonly TabRegistration[] = [
  { id: 'index', can: canViewPriceIndex, built: true, Panel: IndexTab }, // 938
  { id: 'alerts', can: canViewPriceWatch, built: true, Panel: AlertsTab }, // 934
  { id: 'grid', can: canViewPriceWatch, built: true, Panel: GridTab }, // 935
  { id: 'matching', can: canViewPriceWatch, built: true, Panel: MatchingTab }, // 937
  { id: 'feed-health', can: canViewPriceWatch, built: true, Panel: FeedHealthTab }, // 939
]
