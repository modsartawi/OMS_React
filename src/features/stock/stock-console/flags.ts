/**
 * A flag opens its list (oms 942, BackOffice spec 4157 story 17) — pure. A click on a flag on a store's header opens
 * the tab that lists what raised it, with the filter set and the search run ("41 items below zero" is one click from
 * the 41 items): a click on a flag counts as asking. Feeds reads on opening, so its flags open the tab alone.
 */
import { STOCK_CONSOLE_PATH } from './console-pages'
import type { StoreTab } from './store-tabs'

export interface FlagLink {
  tab: StoreTab
  /** The list's filter as the wire names it; null for a tab that reads on opening. */
  filter: string | null
}

const LINKS: Record<string, FlagLink> = {
  BelowZero: { tab: 'items', filter: 'belowZero' },
  OldHold: { tab: 'holds', filter: 'standing' },
  SalesNotApplied: { tab: 'holds', filter: 'sold' },
  PlaceholderStock: { tab: 'batches', filter: 'placeholder' },
  ComparisonDiffers: { tab: 'feeds', filter: null },
  // Not mapped by the ticket [guess]: Feeds shows the SAP place and its last attempt, which is what SAP quiet measures.
  SapQuiet: { tab: 'feeds', filter: null },
}

/** Where a flag leads; null for a code the console does not know. */
export const flagLink = (code: string): FlagLink | null => (Object.hasOwn(LINKS, code) ? LINKS[code] : null)

/**
 * The address a flag opens: the store page with the tab, and for a list its filter and `ran=1` — the boxes empty, the
 * first page. Null for an unknown flag.
 */
export function flagHref(store: string, code: string): string | null {
  const link = flagLink(code)
  if (!link) return null
  const params = new URLSearchParams({ tab: link.tab })
  if (link.filter !== null) {
    params.set('filter', link.filter)
    params.set('ran', '1')
  }
  return `${STOCK_CONSOLE_PATH}/store/${encodeURIComponent(store)}?${params.toString()}`
}
