import { campaignPath } from '@/core/rules/campaign-state'
import { listContextFromUrl } from '@/core/rules/promotion-query'
import { matchLength, type ShellMenuItem } from './menu-model'

// The top bar's breadcrumb (spec 380 F11, ticket 386; 363 "Top bar"): group /
// [sub-group] / screen / record number, read off the menu so no screen writes its
// own. The separator and the record's look are the component's (`TopBar.tsx`).

export interface Crumb {
  /** Label keys, outermost first: the group, a sub-group if any, then the screen. */
  trail: string[]
  /**
   * A segment between the screen and the record, or null: the promotion a campaign's workspace was
   * opened from (ticket 537) — its code, or a label key for "No promotion".
   */
  scope: CrumbScope | null
  /** The record the route is open on (its dynamic segment), or null. */
  record: string | null
}

/** A promotion's code (a machine value), or the label of a segment that has no code. */
export type CrumbScope = { code: string } | { labelKey: string }

/** "No promotion": the list context's `promotion=` empty. */
export const NO_PROMOTION_CRUMB = 'campaign-promotions:list.noPromotion'

/**
 * The crumb for `pathname`.
 *
 * 🚩 **The most specific item wins**, not the first: two items can claim one address
 * (the eligibility list owns `/nphies/eligibility`, and New check is
 * `/nphies/eligibility/new` inside it). On a tie the deeper item wins, so the
 * settlement Overview — the sub-group's own address — names the leaf rather than
 * the sub-group twice.
 *
 * The match is the rail's own rule (`matchLength` beside `isActive`), so the crumb and
 * the highlighted leaf never disagree about where the user is.
 *
 * The record comes from the route's **params**, never from the path's last segment:
 * `/nphies/authorizations/new` is a screen, not record `new`. A splat is not a record.
 *
 * A campaign's workspace (`/campaigns/:id/…`) opened from a promotion's page carries that list in its
 * `search` (`?promotion=<code>&…`, brief 2848): the crumb reads Promotions › `<promotion>` ›
 * `<campaign>` ("No promotion" for `promotion=` empty). A direct link has none: Promotions › `<campaign>`.
 */
export function deriveCrumb(
  menu: ShellMenuItem[],
  pathname: string,
  params: Readonly<Record<string, string | undefined>> = {},
  search = '',
): Crumb {
  let best: { path: ShellMenuItem[]; score: number } | null = null
  for (const path of pathsOf(menu, [])) {
    const score = matchLength(path[path.length - 1], pathname)
    if (score >= 0 && (!best || score > best.score || (score === best.score && path.length > best.path.length)))
      best = { path, score }
  }
  if (!best) return { trail: [], scope: null, record: null }

  const record =
    Object.entries(params)
      .filter(([key, value]) => key !== '*' && !!value)
      .map(([, value]) => value!)
      .at(-1) ?? null

  return { trail: best.path.map((i) => i.labelKey), scope: workspaceScope(pathname, params, search), record }
}

/** The promotion segment of a campaign's workspace, read off its list context; null anywhere else. */
function workspaceScope(pathname: string, params: Readonly<Record<string, string | undefined>>, search: string): CrumbScope | null {
  const base = params.id ? campaignPath(params.id) : null
  if (!base || !(pathname === base || pathname.startsWith(`${base}/`))) return null
  const context = listContextFromUrl(new URLSearchParams(search))
  if (!context) return null
  return context.promotionCode === null ? { labelKey: NO_PROMOTION_CRUMB } : { code: context.promotionCode }
}

/** Every item in the menu, each as its path from the outermost group down. */
function pathsOf(items: ShellMenuItem[], ancestors: ShellMenuItem[]): ShellMenuItem[][] {
  return items.flatMap((item) => {
    const path = [...ancestors, item]
    return [path, ...(item.items ? pathsOf(item.items, path) : [])]
  })
}
