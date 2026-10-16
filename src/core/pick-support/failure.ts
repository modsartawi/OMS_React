// How a Pick support door's failure is shown (ticket 496, brief 2691 "The envelope"). Pure.
//
// - A 403 has NO body: the session lacks the door's grant. It reads `denied`, and the screen
//   says so in its own (UI) words — "You do not have access to Pick support". A 403 that DOES
//   carry a coded envelope is a refusal like any other, shown with its code.
// - A refusal (HTTP 400, `PICK-…`) is the server's sentence WITH its code beside it, because
//   support quotes the code when they escalate.
// - 401 never reaches here: `@/core/api` sends the session to sign-in.

import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'

export type PickSupportFailure = { kind: 'denied' } | { kind: 'refused'; code: string | null; message: string }

export function pickSupportFailure(err: unknown, fallback: string): PickSupportFailure {
  if (err instanceof ApiError && err.statusCode === 403 && !apiErrorCode(err)) return { kind: 'denied' }
  const detail = err instanceof ApiError ? err.details[0] : undefined
  return {
    kind: 'refused',
    code: apiErrorCode(err),
    // `errors[0].errorMessage` is the brief's sentence; the envelope's `message` is its twin.
    message: detail?.errorMessage || apiErrorMessage(err, fallback),
  }
}
