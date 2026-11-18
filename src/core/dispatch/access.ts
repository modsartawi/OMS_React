/**
 * The dispatch board's grants and the lock's one write (BackOffice spec 2952; doors 2959 + 2964,
 * oms ticket 541). In `@/core/` because two features read them: the board (541) gates its screen and
 * its Release lock on the grants (read off the one permissions answer, oms 914), and Delivery details (542) offers the same Release lock on a locked
 * delivery behind the same Execute flag — and a feature may never import another.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { ReleaseLockRequest, ReleaseLockResult } from '@/core/models/dispatch-board'
import type { Permissions } from '@/core/permissions'

/** The board's Display grant, `DispatchBoard:03` — the menu leaf and the `ScreenGate` read THIS predicate. */
export const canOpenDispatchBoard = (p: Permissions): boolean => p.has('DispatchBoard:03')

/** The board's Execute grant, `DispatchBoard:06`: Release lock. */
export const canReleaseLock = (p: Permissions): boolean => p.has('DispatchBoard:06')

export const dispatchApi = {
  /**
   * `POST DispatchBoard/ReleaseLock` `{ deliveryNumber, reason, note? }` — Execute. One-way, no undo.
   * Refusals: `CALLOUT-102` reason, `CALLOUT-103` note, `CALLOUT-104` not locked (see `./release`).
   */
  releaseLock(body: ReleaseLockRequest): Promise<ReleaseLockResult> {
    return api.post<ReleaseLockResult>('DispatchBoard/ReleaseLock', body)
  },
}
