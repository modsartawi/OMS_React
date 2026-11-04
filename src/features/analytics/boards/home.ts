import type { AnalyticsItem, AnalyticsLabel, AnalyticsTier } from '@/core/models/analytics'

/**
 * The analytics home's lists (spec 766 §F, user stories 3–5; ticket 770) — pure: no React, no i18n.
 *
 * Three groups in a fixed order: Certified first (the trusted figures), then Shared, then Mine, newest
 * change first within each. "Mine" is the Personal tier: a Personal item is seen by its owner only
 * (CONTEXT.md, *Tier*), so every Personal item `Analytics/Items` returns is the caller's own. A group with
 * nothing to show is dropped, so a search that matches nothing leaves none.
 *
 * Search is by title in either language, case-insensitive, ignoring Arabic short vowels and tatweel. An
 * untitled item (an AI view leaves its title empty) is searched by the title the screen generates for it,
 * passed in as `fallbackTitle`, so the words a user reads are the words they can find.
 */

export const HOME_TIER_ORDER: readonly AnalyticsTier[] = ['certified', 'shared', 'personal']

export interface HomeGroup {
  tier: AnalyticsTier
  items: AnalyticsItem[]
}

/** Lower case, NFKC, no Arabic harakat (U+064B–U+065F, U+0670) and no tatweel (U+0640). */
const fold = (s: string): string =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .trim()

const hasTitle = (l: AnalyticsLabel) => !!(l.en || l.ar)

export function homeGroups(
  items: readonly AnalyticsItem[],
  search: string,
  fallbackTitle?: (item: AnalyticsItem) => AnalyticsLabel,
): HomeGroup[] {
  const needle = fold(search)
  const matches = (it: AnalyticsItem) => {
    if (!needle) return true
    const title = hasTitle(it.title) ? it.title : fallbackTitle?.(it)
    return !!title && (fold(title.en).includes(needle) || fold(title.ar).includes(needle))
  }
  const newestFirst = (a: AnalyticsItem, b: AnalyticsItem) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  return HOME_TIER_ORDER.map((tier) => ({
    tier,
    items: items.filter((it) => it.tier === tier && matches(it)).sort(newestFirst),
  })).filter((g) => g.items.length > 0)
}
