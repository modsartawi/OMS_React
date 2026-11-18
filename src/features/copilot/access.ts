/**
 * The copilot's grants, read off the one permissions answer (oms 909, BackOffice spec 4002) — apart from `./api` so the
 * top bar, which imports it eagerly, costs the main bundle only this. The SQL mode toggle reads the Analytics SQL grant,
 * `canSqlAnalytics` in `@/core/analytics-access` (a feature may not import another).
 */
import type { QueryClient } from '@tanstack/react-query'
import type { Permissions } from '@/core/permissions'
import { useSession } from '@/core/session'

/**
 * The empty panel's starters (873): the asking reader's own. Dropped when the user changes (below), and marked stale
 * when the house rules (and their starters) are saved or restored.
 */
export const COPILOT_STARTERS_KEY = ['copilot', 'starters'] as const

/** `Copilot:01` — may open the panel and ask; read by the top-bar button and the pages' gates. */
export const canAskCopilot = (p: Permissions): boolean => p.has('Copilot:01')

/** `Copilot:01` — may reach the same tools over `/mcp` (D8). Not read by the web; named for the brief's row. */
export const canUseMcp = (p: Permissions): boolean => p.has('Copilot:01')

/**
 * May edit the house rules (ticket 790): `Copilot:01` and `Copilot:06` — read by the Administration leaf and the
 * `/copilot/rules` gate. The curate key without the ask key is a denial.
 */
export const canCurateCopilot = (p: Permissions): boolean => p.has('Copilot:01') && p.has('Copilot:06')

/**
 * 🚩 Privacy (873, 3586 review item 1): the reader's starters are held five minutes, so whenever the session's user
 * changes or signs out they are dropped, and B never sees A's. (The grants themselves are the permissions answer's,
 * which `@/core/permissions` resets on the same change.) Returns the unsubscribe.
 */
export function dropCopilotStartersOnUserChange(client: QueryClient): () => void {
  return useSession.subscribe((now, before) => {
    if (now.userId === before.userId) return
    client.removeQueries({ queryKey: COPILOT_STARTERS_KEY, exact: true })
  })
}
