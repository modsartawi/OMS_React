/**
 * The serving-list access probe (BackOffice spec 3042; door 3045, oms ticket 567). In `@/core/` because
 * two features read it: the Serving lists screen (567-571) gates its screen and its edit controls on it,
 * and the Dispatch board (572) links a callout's serving list to `/oms/serving-lists/:id` only for a View
 * holder — and a feature may never import another.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { ServingListAccess } from '@/core/models/serving-list'

/** The ONE cache key the menu leaf, the screen's gate, its edit controls and the board's link share. */
export const SERVING_LIST_ACCESS_KEY = ['oms', 'serving-lists', 'access'] as const

/** …and the one set of options every reader passes: a refusal is an answer, a grant does not change in a page life. */
export function servingListAccessQuery() {
  return {
    queryKey: SERVING_LIST_ACCESS_KEY,
    queryFn: () => servingListAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** Display 03 — the menu leaf and the `ScreenGate` read THIS predicate. Only an explicit `true` grants. */
export const canViewServingLists = (r: ServingListAccess | null | undefined): boolean =>
  typeof r === 'object' && r !== null && r.canViewServingLists === true

/** Execute 06 — every edit control (570, 569). Only an explicit `true` grants. */
export const canEditServingLists = (r: ServingListAccess | null | undefined): boolean =>
  typeof r === 'object' && r !== null && r.canEditServingLists === true

export const servingListAccessApi = {
  /**
   * `GET ServingListWeb/Access` → `{ canViewServingLists, canEditServingLists }`, cookie only, no grant.
   * 🚩 Fails closed: no 404-tolerant catch — a pending, errored, 403 or malformed probe hides the leaf.
   */
  access(): Promise<ServingListAccess> {
    return api.get<ServingListAccess>('ServingListWeb/Access')
  },
}
