/**
 * The copilot's access probe (ticket 735, spec 734 D7) — apart from `./api` so the top bar, which
 * imports it eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { CopilotAccess } from '@/core/models/copilot'

/** The ONE cache key the top-bar button and the `/copilot` page's gate share, so the probe costs one call. */
export const COPILOT_ACCESS_KEY = ['copilot', 'access'] as const

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

export const copilotAccessApi = {
  /**
   * `GET Copilot/Access` → `{ canAsk, canUseMcp }`.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch (the OMS-viewer pattern, D7): the panel sends the
   * question to an external AI service, so an absent or unreachable door hides the button and the
   * page rather than revealing them.
   */
  access(): Promise<CopilotAccess> {
    return api.get<CopilotAccess>('Copilot/Access')
  },
}
