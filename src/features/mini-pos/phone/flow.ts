import { apiErrorKind } from '@/core/api'
import { newRequestId } from '@/core/engine-session/request-id'
import type { SessionState } from '@/core/models/callcenter'

/**
 * The phone's flow rules for oms 917 (spec 4063), kept pure so they are tested without a DOM. None of them decides
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

/** How a submit (or resubmit) ended, as far as the phone can know. */
export type SubmitEnd = 'done' | 'refused' | 'noConnection'

/**
 * No double submit (oms 917). A submit is one user action, so it keeps ONE request id until the server has answered
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
