/**
 * The two refusals that mean **this order is not yours to write to** — and
 * therefore the one rule that sends a tab back to the start.
 *
 * §6.2's dangerous case: the agent abandoned order A, opened B for a new caller,
 * and a forgotten tab still showing A fires a verb. Because `transactionId` is
 * explicit on every verb and validated as the caller's (law 4), that verb is
 * refused rather than silently landing on B — the same harm
 * [127](.issues/127-engine-session-lifecycle.md) refused auto-resume to prevent,
 * closed from the other side.
 *
 * It is a module rather than a branch in the page because the answer must be the
 * same for **every** verb, including the ones tickets 165–174 add. A per-verb
 * `catch` is how one of them ends up quietly showing a banner over a basket that
 * no longer exists.
 *
 * 🚩 The rule is narrow on purpose. A busy collision is retried (`api.ts`), and
 * a guardrail refusal is a banner over the state it refused from (US63) — the
 * basket is still good and neither may throw the agent back to the start.
 */
import { apiErrorCode, ApiError } from '@/core/api'

/** A fault with the sentence the screen shows beside it — the server's own
 *  words, passed through as data (§7). The two always travel together, so they
 *  are one type rather than a pair the page re-assembles at two sites. */
export type ShownSessionFault = SessionFault & { message: string }

export interface SessionFault {
  /**
   * `closed` — the order is over (§7 `SESSION_CLOSED`, 409). `notYours` — it
   * belongs to another register (`NOT_YOUR_SESSION`, 403), which is a hard stop
   * whose way back is the agent's OWN order: returning to the start re-opens,
   * and a fresh `open` answers `refusedExisting` with it (§8.1).
   */
  kind: 'closed' | 'notYours'
  /**
   * `submitted | abandoned | swept` as the server sent it, or `null` when the
   * refusal carried no payload. An unknown category is KEPT rather than dropped:
   * a new one is a minor bump that ships server-first (§9), and dropping it
   * would make it read as "no reason given".
   */
  reason: string | null
}

export function readSessionFault(err: unknown): SessionFault | null {
  const code = apiErrorCode(err)
  if (code === 'NOT_YOUR_SESSION') return { kind: 'notYours', reason: null }
  if (code !== 'SESSION_CLOSED') return null
  return { kind: 'closed', reason: closedReason(err) }
}

/** The refusal's own `reason`, off the envelope's `data` (§7). Read defensively:
 *  that body is the server's, and the tab must return to the start whether or
 *  not it explains itself — the reason is an explanation, never the condition. */
function closedReason(err: unknown): string | null {
  const body = err instanceof ApiError ? err.data : null
  if (!body || typeof body !== 'object') return null
  const reason = (body as { reason?: unknown }).reason
  return typeof reason === 'string' && reason !== '' ? reason : null
}
