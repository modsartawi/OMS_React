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

/**
 * Filters MENU down to the items the current user may open. `useQueries`'
 * query list is stable across renders because MENU is static (issue 429).
 */
export function useVisibleMenu(menu: ShellMenuItem[]): ShellMenuItem[] {
  const gated = collectGated(menu)
  const results = useQueries({
    queries: gated.map((item) => ({
      queryKey: item.access!.key,
      queryFn: item.access!.run,
      staleTime: Infinity, // one probe per page life (parity with the auth Me probe)
      retry: false, // an errored probe fails closed immediately, no retry storm
    })),
  })

  const granted = new Set<ShellMenuItem>()
  gated.forEach((item, i) => {
    const r = results[i]
    // isSuccess ⇒ data present and no error; pending/error both fail closed.
    if (r.isSuccess && item.access!.visible(r.data)) granted.add(item)
  })

  return filterMenu(menu, granted)
}
