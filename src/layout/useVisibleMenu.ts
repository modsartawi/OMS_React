import { useQueries } from '@tanstack/react-query'
import type { ShellMenuItem } from './menu-model'

// Permission-aware nav hiding (issue 429). The shell runs each gated item's
// probe once per page life and hides items the user can't open. Rules:
//   • ungated item (no `access`)      → always visible;
//   • gated item, probe RESOLVED true → visible;
//   • gated item, probe pending/error → hidden (fail-closed + no flash-then-hide);
//   • group with no visible children  → dropped (its section header vanishes).
// Show/hide only — the server grant stays authoritative (deep-links still hit
// each screen's own in-page denied backstop).

function collectGated(items: ShellMenuItem[], acc: ShellMenuItem[] = []): ShellMenuItem[] {
  for (const item of items) {
    if (item.access) acc.push(item)
    if (item.items) collectGated(item.items, acc)
  }
  return acc
}

function filterMenu(items: ShellMenuItem[], granted: Set<ShellMenuItem>): ShellMenuItem[] {
  const out: ShellMenuItem[] = []
  for (const item of items) {
    // A gated item is shown only once its own probe has confirmed access.
    if (item.access && !granted.has(item)) continue
    if (item.items) {
      const children = filterMenu(item.items, granted)
      if (children.length > 0) out.push({ ...item, items: children })
      // group whose children all hid away → drop the whole group
    } else {
      out.push(item)
    }
  }
  return out
}

/** The slice of a react-query result the filter reads — one per gated item, in order. */
export interface ProbeState {
  isPending: boolean
  isSuccess: boolean
  data: unknown
}

export interface VisibleMenu {
  items: ShellMenuItem[]
  /**
   * True once every gated item's probe has resolved OR errored (ticket 124). Because
   * a pending probe hides its item, an unsettled menu is legitimately empty on first
   * paint — so "no items" only means "nothing to open" once this is true. An errored
   * probe counts as settled: it fails closed, and never answering would hang the flag.
   */
  settled: boolean
}

/**
 * The pure half of {@link useVisibleMenu}: menu + one probe state per gated item
 * (in `collectGated` order) → what to show and whether that answer is trustworthy.
 */
export function resolveMenu(menu: ShellMenuItem[], results: ProbeState[]): VisibleMenu {
  const gated = collectGated(menu)

  const granted = new Set<ShellMenuItem>()
  gated.forEach((item, i) => {
    const r = results[i]
    // isSuccess ⇒ data present and no error; pending/error/missing all fail closed.
    if (r?.isSuccess && item.access!.visible(r.data)) granted.add(item)
  })

  // A missing result is "not answered yet", never "answered no" — hence the length check.
  const settled = results.length === gated.length && results.every((r) => !r.isPending)

  return { items: filterMenu(menu, granted), settled }
}

/**
 * Filters MENU down to the items the current user may open. `useQueries`'
 * query list is stable across renders because MENU is static (issue 429).
 */
export function useVisibleMenu(menu: ShellMenuItem[]): VisibleMenu {
  const gated = collectGated(menu)
  const results = useQueries({
    queries: gated.map((item) => ({
      queryKey: item.access!.key,
      queryFn: item.access!.run,
      staleTime: Infinity, // one probe per page life (parity with the auth Me probe)
      retry: false, // an errored probe fails closed immediately, no retry storm
    })),
  })

  return resolveMenu(menu, results)
}
