import type { ApiErrorKind } from '@/core/api'
import type { RuleSupportCancelRequest } from '@/core/models/rule-session'
import { mintRequestId } from '@/core/util/request-id'

// Cancel session (ticket 527): `POST Rules/Support/Cancel { sessionId, requestId, reason }`. The
// reason is required and at most 500 characters (`RULES_REASON_REQUIRED`); the request id is new
// per press, so HQ can tell a retry from a second action. Pure: no React, no i18n.

/** HQ's `RuleSupportService.ReasonWidth`: a longer reason is refused, never cut. */
export const CANCEL_REASON_MAX = 500

/** What is wrong with a reason before it is sent: none, or too long — both counted trimmed, as HQ does. */
export function reasonProblem(reason: string): 'required' | 'tooLong' | null {
  const why = reason.trim()
  if (!why) return 'required'
  return why.length > CANCEL_REASON_MAX ? 'tooLong' : null
}

/** The door's body. */
export function cancelBody(sessionId: string, requestId: string, reason: string): RuleSupportCancelRequest {
  return { sessionId: sessionId.trim(), requestId, reason: reason.trim() }
}

/** The press before this one: the id it sent, and how it failed (null = it has not failed). */
export interface PreviousPress {
  requestId: string
  failure: ApiErrorKind | null
  /** The failure's HTTP status; 0 when no answer came back. */
  statusCode: number
}

/**
 * Whether a failed press may have landed at HQ: a dropped connection, a server fault, a 2xx whose
 * body did not read. Not a refusal — HQ's own (`business`), or a 4xx with no envelope, as the grant
 * filter's bare 403 is: a refusal writes nothing.
 */
export function mayHaveLanded(press: Pick<PreviousPress, 'failure' | 'statusCode'>): boolean {
  const { failure, statusCode } = press
  if (failure === null || failure === 'business' || failure === 'auth') return false
  return !(failure === 'unknown' && statusCode >= 400 && statusCode < 500)
}

/**
 * The request id a press of "Cancel the session" sends: a new one every press — except a press that
 * retries one that may have landed (`mayHaveLanded`). That retry sends the SAME id and HQ answers
 * it `repeated: true`, moving nothing twice. A press HQ answered with a refusal is done: the next
 * press is a new action (and `RULES_REQUEST_ID_REUSED` needs a new id).
 */
export function pressRequestId(previous: PreviousPress | null, mint: () => string = mintRequestId): string {
  if (previous && mayHaveLanded(previous)) return previous.requestId
  return mint()
}

/** Refusals that say the session moved on since it was read: nothing is left to cancel as it stood. */
export const STALE_REFUSALS = ['RULES_SESSION_CANCELLED', 'RULES_SESSION_CLOSED', 'RULES_SESSION_OPEN'] as const

/** Whether HQ's refusal code says the session moved on since it was read. */
export const isStaleRefusal = (code: string | null): boolean => (STALE_REFUSALS as readonly string[]).includes(code ?? '')

/** The cancel's refusals the dialog explains, by HQ's code. */
export const CANCEL_REFUSALS = [
  ...STALE_REFUSALS,
  'RULES_REQUEST_ID_REUSED',
  'RULES_REASON_REQUIRED',
  'RULES_SESSION_NOT_FOUND',
] as const
export type CancelRefusal = (typeof CANCEL_REFUSALS)[number]

/**
 * What the dialog adds below HQ's message: the refusal's code it knows, or `denied` for a bare 403
 * — a reader without `BackOfficeScreen[RuleSupport,02]` gets no body, so no message and no code.
 */
export function cancelFailure(code: string | null, bareDenial: boolean): CancelRefusal | 'denied' | null {
  if (code && (CANCEL_REFUSALS as readonly string[]).includes(code)) return code as CancelRefusal
  return bareDenial ? 'denied' : null
}
