import { apiErrorKind } from '@/core/api'
import { newRequestId } from '@/core/engine-session/request-id'
import { readSessionFault } from '@/core/engine-session/session-fault'
import type { ExistingOrder, OpenResult, SessionState } from '@/core/models/callcenter'
import { doorScreenFor, type DoorScreen, type ShownRefusal } from './refusal'

/**
 * The phone's flow rules for oms 929 (spec 4063), kept pure so they are tested without a DOM. None of them decides
 * anything the server owns: each reads the server's last answer and says which screen shows it.
 */

/**
 * The customer step comes before the basket (spec 4063 / 3708 R1). Whether a member is attached is the session's word
 * (`header.customer`), so an opened, resumed or reopened basket with none lands on the customer step, and one with a
 * member goes straight to the basket. The server enforces the same with `NO_CUSTOMER_ATTACHED` on add and submit.
 */
export function basketView(state: Pick<SessionState, 'header'>): 'customer' | 'basket' {
  return state.header.customer ? 'basket' : 'customer'
}

/** A call that never reached the server (no network, the server unreachable): its outcome is unknown, not refused. */
export function isNoConnection(err: unknown): boolean {
  return apiErrorKind(err) === 'network'
}

/**
 * Where a failed call sends the phone. One routing for every call on the basket (a verb, submit or resubmit, abandon,
 * the state read), so none of them can forget a case:
 * - `noConnection`: the call never reached the server; nothing moves.
 * - `start`: the order is over or not this sign-in's (`SESSION_CLOSED`, `NOT_YOUR_SESSION`): back to the door, which
 *   opens anew, carrying the refusal that says why, to be shown on what the door opens.
 * - `door`: a refusal of the door itself (signed out, not assigned, blocked, not unlocked).
 * - `here`: any other refusal, shown where it happened.
 */
export type FaultRoute =
  | { to: 'noConnection' }
  | { to: 'start'; refusal: ShownRefusal }
  | { to: 'door'; door: DoorScreen; refusal: ShownRefusal }
  | { to: 'here'; refusal: ShownRefusal }

export function routeFault(err: unknown, shown: (err: unknown) => ShownRefusal): FaultRoute {
  if (isNoConnection(err)) return { to: 'noConnection' }
  if (readSessionFault(err)) return { to: 'start', refusal: shown(err) }
  const door = doorScreenFor(err)
  return door ? { to: 'door', door, refusal: shown(err) } : { to: 'here', refusal: shown(err) }
}

/**
 * Where an answered open lands, and the refusal shown there: none on a plain open, or the one a session fault carried
 * back to the door (the order that was submitted elsewhere, or swept), so it is drawn rather than cleared unseen.
 */
export function afterOpen(
  result: OpenResult,
  carried: ShownRefusal | null,
): {
  next: { kind: 'basket'; transactionId: string; editing: null } | { kind: 'existing'; existing: ExistingOrder } | null
  refusal: ShownRefusal | null
} {
  if (result.outcome === 'opened' && result.state)
    return { next: { kind: 'basket', transactionId: result.state.transactionId, editing: null }, refusal: carried }
  if (result.existing) return { next: { kind: 'existing', existing: result.existing }, refusal: carried }
  return { next: null, refusal: carried }
}

/**
 * What the basket screen shows while it holds no state: the read in flight, the read lost to the connection, or the
 * read refused (with the refusal and a retry). Never nothing. `null` once there is state.
 */
export function basketWait(read: { data: SessionState | undefined; error: unknown }): 'loading' | 'noConnection' | 'refused' | null {
  if (read.data) return null
  if (!read.error) return 'loading'
  return isNoConnection(read.error) ? 'noConnection' : 'refused'
}

/** How a submit (or resubmit) ended, as far as the phone can know. */
export type SubmitEnd = 'done' | 'refused' | 'noConnection'

/**
 * No double submit (oms 929). A submit is one user action, so it keeps ONE request id until the server has answered
 * it: a tap while it is in flight is dropped, and a retry after a lost connection re-sends the SAME id, so a submit
 * that did land before the line dropped is replayed by the server's ledger (`alreadySubmitted`, same order number),
 * never minted twice. Once the server has answered (placed, or refused and the basket stays open to be fixed), the
 * next tap is a new action with a new id.
 */
export function createSubmitGuard(mint: () => string = newRequestId) {
  let inFlight = false
  let kept: { transactionId: string; requestId: string } | null = null
  return {
    /** The request id to send, or `null` when a submit is already in flight. */
    begin(transactionId: string): string | null {
      if (inFlight) return null
      inFlight = true
      if (!kept || kept.transactionId !== transactionId) kept = { transactionId, requestId: mint() }
      return kept.requestId
    },
    end(how: SubmitEnd): void {
      inFlight = false
      if (how !== 'noConnection') kept = null
    },
    get inFlight() {
      return inFlight
    },
  }
}

export type SubmitGuard = ReturnType<typeof createSubmitGuard>

/** The countries the loyalty base takes a mobile from (the call-center console's list; SA first, its default). The
 *  server's validator is the only judge of the number itself. */
export const SIGNUP_COUNTRIES = ['SA', 'BH', 'KW', 'AE', 'QA', 'OM'] as const
