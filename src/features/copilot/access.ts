/**
 * The copilot's access probe (ticket 735, spec 734 D7) — apart from `./api` so the top bar, which
 * imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { CopilotAccess } from '@/core/models/copilot'
import { useSession } from '@/core/session'

/** The ONE cache key the top-bar button and the `/copilot` page's gate share, so the probe costs one call. */
export const COPILOT_ACCESS_KEY = ['copilot', 'access'] as const

/**
 * The empty panel's starters (873): the asking reader's own, so they are the user's as much as the probe is. Dropped
 * when the user changes (below), and marked stale when the house rules (and their starters) are saved or restored.
 */
export const COPILOT_STARTERS_KEY = ['copilot', 'starters'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function copilotAccessQuery() {
  return {
    queryKey: COPILOT_ACCESS_KEY,
    queryFn: () => copilotAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's one predicate, read by BOTH the top-bar button and the page's gate. `=== true` and
 * nothing looser, so a malformed answer is a denial.
 */
export const canAskCopilot = (r: CopilotAccess | null | undefined): boolean => r?.canAsk === true

/**
 * May edit the house rules (ticket 790, BackOffice 3395): read by the Administration leaf and the
 * `/copilot/rules` gate. Absent (a pre-3395 server), false or failed is a denial, as `canAsk` is.
 */
export const canCurateCopilot = (r: CopilotAccess | null | undefined): boolean => r?.canCurate === true

/**
 * 🚩 Privacy (review item 1): the probe is `staleTime: Infinity`, so without this a grant would outlive
 * its user — B, signing in on A's tab, would see A's button. Whenever the session's user changes or
 * signs out, the answer is reset (no data: fails closed) and asked afresh. Returns the unsubscribe.
 *
 * The reader's starters (873, 3586 review item 1) are the user's too, held five minutes: dropped with the probe, so B
 * never sees A's.
 */
export function dropCopilotAccessOnUserChange(client: QueryClient): () => void {
  return useSession.subscribe((now, before) => {
    if (now.userId === before.userId) return
    void client.resetQueries({ queryKey: COPILOT_ACCESS_KEY, exact: true })
    client.removeQueries({ queryKey: COPILOT_STARTERS_KEY, exact: true })
  })
}

export const copilotAccessApi = {
  /**
   * `GET Copilot/Access` → `{ canAsk, canUseMcp, canCurate }`.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch (the OMS-viewer pattern, D7): the panel sends the
   * question to an external AI service, so an absent or unreachable door hides the button and the
   * page rather than revealing them.
   */
  access(): Promise<CopilotAccess> {
    return api.get<CopilotAccess>('Copilot/Access')
  },
}
