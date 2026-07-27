/**
 * The staleness guard — the one pure rule that stands between the query cache
 * and every response the console receives.
 *
 * Contract law 2 makes the client a pure render-of-latest-state: every mutating
 * verb returns the whole `SessionState`, so there is no reducer and no delta
 * protocol. What there IS, is an ordering hazard: two requests in flight, the
 * slow one lands second, and the basket goes backwards on screen. §2.1 rules it
 * out on the client side — *"the client stores the latest and never acts on an
 * older one"* — and this module is that sentence.
 *
 * Ticket 162 needs the guard itself. The retry/collision machinery that will
 * lean on it (`SESSION_BUSY` backoff, `contractVersion` hard stop) is
 * [164](.issues/164-busy-collision-and-staleness.md)'s; deliberately not here,
 * so this stays one rule with one reason to change.
 */
import type { SessionState } from '@/core/models/callcenter'

/**
 * Decide what the cache should hold after `incoming` arrives.
 *
 * - No current state (first response of a session) → `incoming`.
 * - A **higher** `version` → `incoming` applies.
 * - An **equal** `version` → idempotent: the current state is kept, by identity,
 *   so a replay (§4, `replayed: true`) costs no re-render. `version` is
 *   blind-incremented on every engine `SaveAsync`, so equal means same state.
 * - A **lower** `version` → **discarded**. This is the slow-response case.
 *
 * The function is deliberately blind to `transactionId`: the cache is keyed per
 * transaction (`sessionKey`), so two orders can never meet inside one entry, and
 * a guard that also arbitrated identity would be two rules wearing one name.
 */
export function applyState(
  current: SessionState | null | undefined,
  incoming: SessionState,
): SessionState {
  if (!current) return incoming
  return incoming.version > current.version ? incoming : current
}
