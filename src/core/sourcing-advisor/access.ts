/**
 * The sourcing advisor's access probe (ticket 738, spec 734 D20/D21; door BackOffice BO-2, unbuilt). In
 * `@/core/` because two features read it: the advisor's own screen gates on it, and Delivery details
 * (`features/oms/document`) draws its "Why this store?" link only for a holder — and a feature may never
 * import another (`.claude/rules/feature-structure.md`).
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { SourcingAdvisorAccess } from '@/core/models/sourcing-advisor'

/** The ONE cache key the menu leaf, the screen's gate and the delivery-details link share. */
export const SOURCING_ADVISOR_ACCESS_KEY = ['oms', 'sourcing-advisor', 'access'] as const

/** …and the one set of options every reader passes: a refusal is an answer, a grant does not change in a page life. */
export function sourcingAdvisorAccessQuery() {
  return {
    queryKey: SOURCING_ADVISOR_ACCESS_KEY,
    queryFn: () => sourcingAdvisorAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** `BackOfficeScreen[SourcingAdvisor, 01]` — every reader takes THIS predicate. Only an explicit `true` grants. */
export const canViewSourcingAdvisor = (r: SourcingAdvisorAccess | null | undefined): boolean =>
  typeof r === 'object' && r !== null && r.canView === true

export const sourcingAdvisorAccessApi = {
  /**
   * `GET SourcingAdvisor/Access` → `{ canView }`.
   * 🚩 Fails closed, as the OMS viewer does: no 404-tolerant catch — a pending, errored, 403 or malformed
   * probe hides the leaf and the link, and shows the screen's denied card.
   */
  access(): Promise<SourcingAdvisorAccess> {
    return api.get<SourcingAdvisorAccess>('SourcingAdvisor/Access')
  },
}
