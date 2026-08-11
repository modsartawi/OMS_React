import { ApiError, apiErrorCode } from '@/core/api'

/**
 * What a failed `RetailInvoice/Download` says, and what it offers (ticket 265).
 *
 * Modelled on `collection/inquiry/print-outcome.ts`, which split `miss` from
 * `failure` for exactly this reason: the branches are not visible in a typecheck
 * and are wrong in ways that read as working software. Here the whole error table
 * of contract §4 lands in one pure function so the component can stay a thin
 * renderer, and so **503 and 504 can be asserted to be different answers**.
 *
 * 🔑 **503 and 504 must not be collapsed, and this module is where that is
 * enforced.** A 503 means a render host is recycling or handing over to its
 * successor and *a retry one second later works*. A 504 means a render **hung**
 * and a watchdog is about to kill the host — different advice, different alert,
 * and a recurrence is an incident rather than a wait. Mapping either to the
 * generic server sentence is the specific mistake this ticket exists to prevent.
 *
 * ⚠️ **The client adds no automatic retry.** SIS.Api already retries the internal
 * call twice (250 ms, then 1 s) on connect-refused/503 only, so by the time a 503
 * reaches the browser three attempts have failed; a client retry loop would
 * triple a recycling host's load at the worst moment. Everything below is about a
 * **button** — a user action, which is a different thing.
 *
 * Pure — no React, no i18n lookup, no network. It names a KEY; the component
 * translates it.
 */

/**
 * How much retrying this failure is worth, and it is deliberately three values
 * rather than a boolean.
 *
 * 🚩 The contract gives 503 and 504 *different* retry-ability, not just different
 * sentences: 503 is "try again shortly" (the host is coming back), 504 is "retry
 * **once**; if it recurs, it is an incident". A boolean would flatten that into
 * the same button and lose the only advice that separates a wait from a report.
 */
export type DownloadRetry =
  /** Nothing to retry — the answer will not change. */
  | 'none'
  /** The transient arm: the button stays offered for as long as the user wants it. */
  | 'again'
  /** One more attempt is reasonable; a second failure is an incident, not a wait. */
  | 'once'

export interface DownloadOutcome {
  /** The `reports` key of the sentence the user reads. */
  messageKey: string
  retry: DownloadRetry
  /**
   * Whether the server was supposed to journal a render attempt for this
   * failure — **true on 422 and 504 only** (contract §4: the render was
   * attempted), false on 400/401/403/404/503/500, where nothing was attempted.
   *
   * It gates the "quote this reference to support" line rather than the id
   * itself: the id is a fact reported by `apiErrorAttemptId` wherever it
   * arrives, but it is only a handle into the HQ `ReportRenderAttempt` log on
   * the arms where a row was actually written.
   */
  expectsAttemptId: boolean
}

/** The rail's own machine codes (contract §4). Not user-visible — matched, not read. */
export const INVALID_KEY = 'INVALID_KEY'
export const INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND'
export const RENDER_FAILED = 'RENDER_FAILED'
export const RENDERER_UNAVAILABLE = 'RENDERER_UNAVAILABLE'
export const RENDER_TIMEOUT = 'RENDER_TIMEOUT'

const OUTCOMES: Record<string, DownloadOutcome> = {
  [INVALID_KEY]: { messageKey: 'invoice.download.errors.invalidKey', retry: 'none', expectsAttemptId: false },
  [INVOICE_NOT_FOUND]: { messageKey: 'invoice.download.errors.notFound', retry: 'none', expectsAttemptId: false },
  // ⚠️ `retry: 'none'`, and it is the one arm where that is the *content* of the
  // answer rather than the absence of one: a cash clearance, a non-numeric store
  // code or a template fault renders identically on every attempt. Offering a
  // button here would be a promise the rail cannot keep.
  [RENDER_FAILED]: { messageKey: 'invoice.download.errors.renderFailed', retry: 'none', expectsAttemptId: true },
  [RENDERER_UNAVAILABLE]: { messageKey: 'invoice.download.errors.unavailable', retry: 'again', expectsAttemptId: false },
  [RENDER_TIMEOUT]: { messageKey: 'invoice.download.errors.timeout', retry: 'once', expectsAttemptId: true },
}

/**
 * The status → outcome floor, for a failure that carried **no code**.
 *
 * 🚩 Not a nicety: `core/api.ts` maps a 5xx with no `errorCode` to a generic
 * `kind: 'server'` failure, so a `RENDERER_UNAVAILABLE` that lost its envelope
 * would arrive as a bare 503 — and answering *that* with the generic sentence is
 * the collapse this module forbids, arriving through the back door. The status
 * alone is enough to keep 503 and 504 apart, so it does.
 */
const BY_STATUS: Record<number, DownloadOutcome> = {
  400: OUTCOMES[INVALID_KEY],
  404: OUTCOMES[INVOICE_NOT_FOUND],
  422: OUTCOMES[RENDER_FAILED],
  503: OUTCOMES[RENDERER_UNAVAILABLE],
  504: OUTCOMES[RENDER_TIMEOUT],
}

/** Anything the table does not name. A crash, a proxy, a status nobody planned. */
const GENERIC: DownloadOutcome = {
  messageKey: 'invoice.download.errors.generic',
  retry: 'none',
  expectsAttemptId: false,
}

/**
 * ⚠️ **403 is the one that gets got wrong, and it is why this branch is first.**
 * A refusal on this rail is a **bare 403 with no body at all** — no envelope, no
 * `errorCode` — so `apiErrorCode(err)` is `null` and `apiErrorMessage` falls back
 * to the generic sentence. Every *other* row of the table branches on the code;
 * this one branches on the status, and reading it as a generic failure would tell
 * a user something went wrong when in fact they were told no.
 */
const DENIED: DownloadOutcome = {
  messageKey: 'invoice.download.errors.denied',
  retry: 'none',
  expectsAttemptId: false,
}

/**
 * 401 is **handled centrally** — `handle401` in `core/api.ts` has already cleared
 * the session, toasted once and started the redirect to `/login` by the time this
 * is reached. The sentence exists so the dialog is never blank in the frame
 * before the navigation settles; it is not an arm this screen acts on.
 */
const SESSION_ENDED: DownloadOutcome = {
  messageKey: 'invoice.download.errors.session',
  retry: 'none',
  expectsAttemptId: false,
}

/**
 * Contract §4's table, as a function: status + code → the sentence, the
 * retry-ability and whether a render was journalled.
 *
 * @param status the HTTP status the failure arrived at.
 * @param code the envelope's `errorCode`, or `null` when it carried none (a bare
 *   403, or a 5xx that lost its envelope).
 */
export function downloadOutcome(status: number, code: string | null): DownloadOutcome {
  if (status === 403) return DENIED
  if (status === 401) return SESSION_ENDED
  if (code !== null && code in OUTCOMES) return OUTCOMES[code]
  return BY_STATUS[status] ?? GENERIC
}

/**
 * The connection never reached the server at all — `core/api.ts` throws
 * `ApiError('network', …, 0)` when `fetch` itself rejects.
 *
 * 🚩 Not in contract §4's table, because that table describes answers SIS.Api
 * gives and this is the absence of one. It gets its own arm rather than falling
 * into `GENERIC` because the fallthrough would hand the **most** retryable
 * failure there is the **least** retryable answer — "the receipt could not be
 * produced", with no button — for what is usually a dropped wifi connection.
 */
const OFFLINE: DownloadOutcome = {
  messageKey: 'invoice.download.errors.network',
  retry: 'again',
  expectsAttemptId: false,
}

/** The same decision, read straight off whatever `api.blob` threw. */
export function downloadFailure(err: unknown): DownloadOutcome {
  if (!(err instanceof ApiError)) return GENERIC
  // Before the status, because a network failure HAS no status — it carries a 0,
  // which no row of the table names.
  if (err.kind === 'network') return OFFLINE
  return downloadOutcome(err.statusCode, apiErrorCode(err))
}

/**
 * Is a retry button worth offering, given how many attempts have already been
 * made for this row?
 *
 * `'once'` is the arm that needs the count: a 504 offers one more go, and a
 * second timeout is an incident to report with the `attemptId` rather than a
 * third attempt at a host a watchdog is already killing.
 *
 * @param attempts attempts made SO FAR, the first one included — so the state
 *   after a first failure is `1`.
 */
export function canRetry(outcome: DownloadOutcome, attempts: number): boolean {
  if (outcome.retry === 'none') return false
  if (outcome.retry === 'again') return true
  return attempts < 2
}
