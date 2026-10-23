/**
 * The dispatch board's access probe and the lock's one write (BackOffice spec 2952; doors 2959 + 2964,
 * oms ticket 541). In `@/core/` because two features read them: the board (541) gates its screen and
 * its Release lock on the probe, and Delivery details (542) offers the same Release lock on a locked
 * delivery behind the same Execute flag — and a feature may never import another.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { DispatchBoardAccess, ReleaseLockRequest, ReleaseLockResult } from '@/core/models/dispatch-board'

/** The ONE cache key the menu leaf, the screen's gate and every Release lock site share. */
export const DISPATCH_ACCESS_KEY = ['oms', 'dispatch-board', 'access'] as const

/** …and the one set of options every reader passes: a refusal is an answer, a grant does not change in a page life. */
export function dispatchAccessQuery() {
  return {
    queryKey: DISPATCH_ACCESS_KEY,
    queryFn: () => dispatchApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The board's Display grant — the menu leaf and the `ScreenGate` read THIS predicate. Only an explicit `true` grants. */
export const canOpenDispatchBoard = (r: DispatchBoardAccess | null | undefined): boolean =>
  typeof r === 'object' && r !== null && r.canOpenDispatchBoard === true

/** The board's Execute grant: Release lock. Only an explicit `true` grants. */
export const canReleaseLock = (r: DispatchBoardAccess | null | undefined): boolean =>
  typeof r === 'object' && r !== null && r.canReleaseLock === true

export const dispatchApi = {
  /**
   * `GET DispatchBoard/Access` → `{ canOpenDispatchBoard, canReleaseLock }`, cookie only, no grant.
   * 🚩 Fails closed: no 404-tolerant catch — a pending, errored, 403 or malformed probe hides the leaf.
   */
  access(): Promise<DispatchBoardAccess> {
    return api.get<DispatchBoardAccess>('DispatchBoard/Access')
  },

  /**
   * `POST DispatchBoard/ReleaseLock` `{ deliveryNumber, reason, note? }` — Execute. One-way, no undo.
   * Refusals: `CALLOUT-102` reason, `CALLOUT-103` note, `CALLOUT-104` not locked (see `./release`).
   */
  releaseLock(body: ReleaseLockRequest): Promise<ReleaseLockResult> {
    return api.post<ReleaseLockResult>('DispatchBoard/ReleaseLock', body)
  },
}
