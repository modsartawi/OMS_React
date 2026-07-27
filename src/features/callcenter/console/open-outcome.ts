/**
 * Which outcome the open path is in — ticket 163's one pure rule.
 *
 * `OpenResult` (§8.1) is a discriminated union in intent and a loose record on
 * the wire: `outcome` names the branch, but `state` and `existing` are each
 * independently nullable, so every malformed pair type-checks. This module is
 * the one place that pair is read, so the screen branches on a **closed** set of
 * four outcomes instead of on two nullable fields at three call sites.
 *
 * The malformed branch is not defensive padding. `outcome:'opened'` with a null
 * `state` is exactly what a half-built server sends, and the shape of the bug it
 * causes is the one this ticket exists to prevent: an agent stranded on
 * "Opening…" with no order and no way to say so.
 *
 * Also here, because both are the same subject and neither is worth its own
 * file: what an abandon is about to throw away (named the same way whether the
 * order is the one the agent is looking at or the one they are not), and how an
 * `openedAt` becomes something an agent can judge staleness by.
 */
import type { ExistingOrder, OpenResult, SessionState } from '@/core/models/callcenter'
import { formatDateTime, formatTimeOfDay, isBlankDate } from '@/core/util/date-format'

export type OpenOutcome =
  /** A real order was minted; this state is the console's whole render input. */
  | { kind: 'opened'; state: SessionState }
  /** One active order per agent (law 9) — a CHOICE on the success path. */
  | { kind: 'existing'; existing: ExistingOrder }
  /** The call has not answered yet. */
  | { kind: 'pending' }
  /** The answer contradicts the contract. Named, so the agent is not stranded. */
  | { kind: 'malformed' }

export function readOpenResult(result: OpenResult | undefined | null): OpenOutcome {
  if (!result) return { kind: 'pending' }
  if (result.outcome === 'opened') {
    return result.state ? { kind: 'opened', state: result.state } : { kind: 'malformed' }
  }
  if (result.outcome === 'refusedExisting') {
    return result.existing ? { kind: 'existing', existing: result.existing } : { kind: 'malformed' }
  }
  // §9 ignores unknown FIELDS. An unknown VALUE in the field the whole screen
  // branches on is a different thing, and guessing at it would mint or discard
  // a real OMS order on a coin flip.
  return { kind: 'malformed' }
}

/**
 * What an abandon is about to void, in the words the confirmation needs: whose
 * call it was and how much work is in it. Deliberately **not** an amount — the
 * question "am I throwing away five minutes of work?" is answered by a line
 * count, and the console never computes money (law 1).
 */
export interface AbandonTarget {
  transactionId: string
  customerName: string | null
  lineCount: number
}

/**
 * An abandon the agent has been asked to confirm: what it would void, and the
 * **action's own** `requestId`, minted when the confirmation opens.
 *
 * The two travel together everywhere — one confirmation is one action, so a
 * *Try again* inside the dialog re-sends the same id while a second abandon
 * later in the console's life is a second action with a second id (law 3).
 */
export interface PendingAbandon {
  target: AbandonTarget
  requestId: string
}

/** From the order the agent is NOT looking at (`OpenResult.existing`). */
export function abandonTargetOfExisting(existing: ExistingOrder): AbandonTarget {
  return {
    transactionId: existing.transactionId,
    customerName: existing.customerName,
    lineCount: existing.lineCount,
  }
}

/**
 * From the order the agent IS looking at. Abandoning from inside a live order is
 * the same act as abandoning the one on the already-open screen, so it produces
 * the same shape and gets the same confirmation — one act, one dialog, one
 * sentence about what is lost.
 */
export function abandonTargetOfSession(state: SessionState): AbandonTarget {
  return {
    transactionId: state.transactionId,
    customerName: state.header.customer?.name ?? null,
    lineCount: state.lines.length,
  }
}

/**
 * `openedAt` as something an agent can judge staleness by.
 *
 * Same day → the clock alone (`08:41`), which is what the agent is comparing
 * against the call they are on. Any other day → the date comes with it: this is
 * the forgotten-tab and second-device story, and `08:41` on an order opened
 * yesterday reads as *minutes ago* to someone deciding whether to resume it.
 *
 * `now` is a parameter rather than a `Date.now()` inside, so the boundary is
 * testable at all rather than only on the days it happens to cross.
 */
export function openedAtLabel(openedAt: string | null | undefined, now: Date): string {
  if (!openedAt) return ''
  const opened = new Date(openedAt)
  if (isBlankDate(opened)) return ''
  const sameDay =
    opened.getFullYear() === now.getFullYear() &&
    opened.getMonth() === now.getMonth() &&
    opened.getDate() === now.getDate()
  return sameDay ? formatTimeOfDay(openedAt) : formatDateTime(openedAt)
}
