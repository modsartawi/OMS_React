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

/** What `GET Analytics/Items` may be narrowed by (766 §C: "with `kind` and `tier`, plus search"). */
export interface ItemsQuery {
  kind?: AnalyticsItem['kind']
  tier?: AnalyticsTier
  search?: string
}

/**
 * The Items door's params: the search trimmed, and only what the caller has — blank is left out, so the
 * door answers the whole list. The server may narrow by them; the screens still group and search what comes
 * back themselves (`homeGroups`), so a server that ignores them shows the same.
 */
export function itemsQuery(q: ItemsQuery): ItemsQuery {
  const search = q.search?.trim()
  return { ...(q.kind ? { kind: q.kind } : {}), ...(q.tier ? { tier: q.tier } : {}), ...(search ? { search } : {}) }
}

export const HOME_TIER_ORDER: readonly AnalyticsTier[] = ['certified', 'shared', 'personal']

export interface HomeGroup {
  tier: AnalyticsTier
  items: AnalyticsItem[]
}

/** Lower case, NFKC, no Arabic harakat (U+064B–U+065F, U+0670) and no tatweel (U+0640). */
export const fold = (s: string): string =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .trim()

const hasTitle = (l: AnalyticsLabel) => !!(l.en || l.ar)

/**
 * The home's title search as a predicate (shared with 837's library, `./library`): by title in either language,
 * folded; an untitled item by the title it is shown with (`fallbackTitle`). A blank search matches everything.
 */
export function titleMatcher(search: string, fallbackTitle?: (item: AnalyticsItem) => AnalyticsLabel): (item: AnalyticsItem) => boolean {
  const needle = fold(search)
  return (it) => {
    if (!needle) return true
    const title = hasTitle(it.title) ? it.title : fallbackTitle?.(it)
    return !!title && (fold(title.en).includes(needle) || fold(title.ar).includes(needle))
  }
}

/** Newest change first. */
export const newestFirst = (a: AnalyticsItem, b: AnalyticsItem) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')

export function homeGroups(
  items: readonly AnalyticsItem[],
  search: string,
  fallbackTitle?: (item: AnalyticsItem) => AnalyticsLabel,
): HomeGroup[] {
  const matches = titleMatcher(search, fallbackTitle)
  return HOME_TIER_ORDER.map((tier) => ({
    tier,
    items: items.filter((it) => it.tier === tier && matches(it)).sort(newestFirst),
  })).filter((g) => g.items.length > 0)
}
