import { useQueries } from '@tanstack/react-query'
import { usePermissions, type Permissions } from '@/core/permissions'
import type { ShellMenuItem } from './menu-model'

// Permission-aware nav hiding (issue 429; one answer since oms 909, BackOffice spec 4002). Every gated item reads the
// ONE permissions answer (`@/core/permissions`), never a probe of its own. Rules:
//   • ungated item (no `requires`, no `key`) → always visible;
//   • gated item, answer in and it grants   → visible;
//   • gated item, answer pending or failed   → hidden (fail-closed + no flash-then-hide);
//   • group with no visible children         → dropped (its section header vanishes).
// Show/hide only — the server grant stays authoritative (deep-links still hit each screen's own in-page backstop).

/** Whether an item is gated at all. */
export const isGated = (item: ShellMenuItem): boolean => item.requires !== undefined || item.key !== undefined

/** The item's own reading of the answer: its predicate, or its one key. */
function grants(item: ShellMenuItem, p: Permissions): boolean {
  if (item.requires) return item.requires(p)
  return item.key !== undefined && p.has(item.key)
}

/** Whether the shell asks an item's `offered` door yet: only once the answer is in and grants the item. */
export function offerAsked(item: ShellMenuItem, p: Permissions): boolean {
  return p.settled && !p.failed && (!isGated(item) || grants(item, p))
}

function filterMenu(items: ShellMenuItem[], p: Permissions, isOffered: (item: ShellMenuItem) => boolean): ShellMenuItem[] {
  const out: ShellMenuItem[] = []
  for (const item of items) {
    // A gated item shows only once the answer is in, well-formed, and grants it.
    if (isGated(item) && (!p.settled || p.failed || !grants(item, p))) continue
    // An `offered` item also waits for its door's yes (fail-closed: unanswered is no).
    if (item.offered && !isOffered(item)) continue
    if (item.items) {
      const children = filterMenu(item.items, p, isOffered)
      if (children.length > 0) out.push({ ...item, items: children })
      // group whose children all hid away → drop the whole group
    } else {
      out.push(item)
    }
  }
  return out
}

export interface VisibleMenu {
  items: ShellMenuItem[]
  /**
   * True once the permissions answer is in OR has failed (ticket 124). Because a pending answer hides every gated
   * item, an unsettled menu is legitimately empty on first paint — so "no items" only means "nothing to open" once
   * this is true. A failed answer counts as settled: it fails closed, and never answering would hang the flag.
   */
  settled: boolean
}

/**
 * The pure half of {@link useVisibleMenu}: menu + the one answer (+ which `offered` doors said yes) → what to show and
 * whether that is trustworthy.
 */
export function resolveMenu(
  menu: ShellMenuItem[],
  permissions: Permissions,
  isOffered: (item: ShellMenuItem) => boolean = () => false,
): VisibleMenu {
  return { items: filterMenu(menu, permissions, isOffered), settled: permissions.settled }
}

function collectOffered(items: ShellMenuItem[], acc: ShellMenuItem[] = []): ShellMenuItem[] {
  for (const item of items) {
    if (item.offered) acc.push(item)
    if (item.items) collectOffered(item.items, acc)
  }
  return acc
}

/**
 * Filters MENU down to the items the current user may open, off the one permissions answer. The `offered` doors
 * (static list: MENU is static) are asked once per page life, each only after its own grant says yes.
 */
export function useVisibleMenu(menu: ShellMenuItem[]): VisibleMenu {
  const permissions = usePermissions()
  const offers = collectOffered(menu)
  const results = useQueries({
    queries: offers.map((item) => ({
      queryKey: item.offered!.queryKey,
      queryFn: item.offered!.queryFn,
      enabled: offerAsked(item, permissions),
      staleTime: Infinity,
      retry: false,
    })),
  })
  const yes = new Set(offers.filter((_, i) => results[i]?.data === true))
  return resolveMenu(menu, permissions, (item) => yes.has(item))
}
