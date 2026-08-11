import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  canRetry,
  downloadFailure,
  downloadOutcome,
  INVALID_KEY,
  INVOICE_NOT_FOUND,
  RENDERER_UNAVAILABLE,
  RENDER_FAILED,
  RENDER_TIMEOUT,
} from './download-outcome'

/**
 * Ticket 265's pure Proof: **every row of contract §4's error table**, and the
 * two things the table hides.
 *
 * 🔑 **503 and 504 are different sentences with different retry-ability.** They
 * are the only two arms a reader could plausibly merge — both are "the renderer
 * did not produce a file, transiently" — and merging them is the specific mistake
 * this ticket exists to prevent: a 503 is a host recycling (wait a second and it
 * works), a 504 is a render that HUNG (a watchdog is about to kill the host, and
 * a recurrence is an incident). It gets its own assertion below, not just
 * coverage by accident of the table walk.
 *
 * ⚠️ **A bare 403 carries no body at all** — no envelope, no `errorCode` — so it
 * is the one row that branches on the status. Every other row branches on the
 * code, and reading a refusal as a generic failure tells a user something broke
 * when in fact they were told no.
 */

/** A coded refusal exactly as `core/api.ts` builds one from the envelope. */
const coded = (status: number, code: string, attemptId: string | null = null) =>
  new ApiError(
    'business',
    'server sentence',
    status,
    [{ errorCode: code, internalErrorCode: '', errorMessage: 'server sentence' }],
    null,
    attemptId,
  )

/** A failure that carried NO envelope — the 403 arm, and a 5xx that lost its body. */
const bare = (status: number) => new ApiError('server', 'generic', status)

describe('downloadOutcome — contract §4, row by row', () => {
  it('400 INVALID_KEY reads as a bug in the row, and offers no retry', () => {
    const o = downloadOutcome(400, INVALID_KEY)
    expect(o.messageKey).toBe('invoice.download.errors.invalidKey')
    expect(o.retry).toBe('none')
  })

  it('403 is a REFUSAL, read off the status because the body is empty', () => {
    // ⚠️ `null` code, deliberately: the bare 403 is the whole point of the arm.
    expect(downloadOutcome(403, null).messageKey).toBe('invoice.download.errors.denied')
    expect(downloadOutcome(403, null).retry).toBe('none')
  })

  it('…and a 403 is NOT the generic server sentence', () => {
    expect(downloadOutcome(403, null).messageKey).not.toBe(downloadOutcome(500, null).messageKey)
  })

  it('404 INVOICE_NOT_FOUND is a claim about the invoice, not about the service', () => {
    expect(downloadOutcome(404, INVOICE_NOT_FOUND).messageKey).toBe(
      'invoice.download.errors.notFound',
    )
  })

  it('422 RENDER_FAILED says retrying will not help — and offers no button', () => {
    const o = downloadOutcome(422, RENDER_FAILED)
    expect(o.messageKey).toBe('invoice.download.errors.renderFailed')
    expect(o.retry).toBe('none')
  })

  it('503 RENDERER_UNAVAILABLE invites another go', () => {
    const o = downloadOutcome(503, RENDERER_UNAVAILABLE)
    expect(o.messageKey).toBe('invoice.download.errors.unavailable')
    expect(o.retry).toBe('again')
  })

  it('504 RENDER_TIMEOUT invites exactly one more', () => {
    const o = downloadOutcome(504, RENDER_TIMEOUT)
    expect(o.messageKey).toBe('invoice.download.errors.timeout')
    expect(o.retry).toBe('once')
  })

  it('500 SERVER_ERROR is the generic failure', () => {
    expect(downloadOutcome(500, 'SERVER_ERROR').messageKey).toBe(
      'invoice.download.errors.generic',
    )
  })

  it('401 is the session sentence — the redirect itself is handle401’s', () => {
    expect(downloadOutcome(401, null).messageKey).toBe('invoice.download.errors.session')
  })
})

describe('🔑 503 and 504 are not the same answer', () => {
  const unavailable = downloadOutcome(503, RENDERER_UNAVAILABLE)
  const timeout = downloadOutcome(504, RENDER_TIMEOUT)

  it('different sentences', () => {
    expect(unavailable.messageKey).not.toBe(timeout.messageKey)
  })

  it('different retry-ability', () => {
    expect(unavailable.retry).not.toBe(timeout.retry)
  })

  it('and neither collapses into the generic server sentence', () => {
    const generic = downloadOutcome(500, null).messageKey
    expect(unavailable.messageKey).not.toBe(generic)
    expect(timeout.messageKey).not.toBe(generic)
  })

  it('…even when the envelope is lost and only the status survives', () => {
    // 🚩 `core/api.ts` maps an uncoded 5xx to a generic server error, so this is
    // the back door the collapse would come through.
    expect(downloadOutcome(503, null).messageKey).toBe(unavailable.messageKey)
    expect(downloadOutcome(504, null).messageKey).toBe(timeout.messageKey)
  })
})

describe('expectsAttemptId — true where a render was attempted and journalled', () => {
  it('is true for 422 and 504', () => {
    expect(downloadOutcome(422, RENDER_FAILED).expectsAttemptId).toBe(true)
    expect(downloadOutcome(504, RENDER_TIMEOUT).expectsAttemptId).toBe(true)
  })

  it('is false for 400, 401, 403, 404 and 503 — nothing was attempted', () => {
    expect(downloadOutcome(400, INVALID_KEY).expectsAttemptId).toBe(false)
    expect(downloadOutcome(401, null).expectsAttemptId).toBe(false)
    expect(downloadOutcome(403, null).expectsAttemptId).toBe(false)
    expect(downloadOutcome(404, INVOICE_NOT_FOUND).expectsAttemptId).toBe(false)
    expect(downloadOutcome(503, RENDERER_UNAVAILABLE).expectsAttemptId).toBe(false)
  })

  it('is false for the generic failure too', () => {
    expect(downloadOutcome(500, null).expectsAttemptId).toBe(false)
  })
})

describe('downloadFailure — the same decision read off what api.blob threw', () => {
  it('reads the code out of the envelope', () => {
    expect(downloadFailure(coded(422, RENDER_FAILED)).messageKey).toBe(
      'invoice.download.errors.renderFailed',
    )
  })

  it('reads a bare 403 off the status', () => {
    expect(downloadFailure(bare(403)).messageKey).toBe('invoice.download.errors.denied')
  })

  it('keeps 503 and 504 apart end to end', () => {
    expect(downloadFailure(coded(503, RENDERER_UNAVAILABLE)).messageKey).not.toBe(
      downloadFailure(coded(504, RENDER_TIMEOUT)).messageKey,
    )
  })

  it('🚩 a NETWORK failure is retryable — the most retryable failure gets the least generic answer', () => {
    // `core/api.ts` throws this when `fetch` itself rejects, carrying status 0,
    // which no row of contract §4 names. Falling into the generic sentence would
    // tell someone whose wifi dropped that their receipt cannot be produced.
    const offline = new ApiError('network', 'network', 0)
    expect(downloadFailure(offline).messageKey).toBe('invoice.download.errors.network')
    expect(downloadFailure(offline).retry).toBe('again')
    expect(canRetry(downloadFailure(offline), 3)).toBe(true)
  })

  it('is generic for anything that is not an ApiError at all — a client bug is not a business outcome', () => {
    expect(downloadFailure(new TypeError('oops')).messageKey).toBe(
      'invoice.download.errors.generic',
    )
    expect(downloadFailure(undefined).messageKey).toBe('invoice.download.errors.generic')
  })
})

describe('canRetry — the BUTTON, which is a user action and not a retry loop', () => {
  it('never offers one where retrying cannot help', () => {
    expect(canRetry(downloadOutcome(422, RENDER_FAILED), 1)).toBe(false)
    expect(canRetry(downloadOutcome(404, INVOICE_NOT_FOUND), 1)).toBe(false)
    expect(canRetry(downloadOutcome(403, null), 1)).toBe(false)
  })

  it('offers one on a 503 however many times the user has tried', () => {
    expect(canRetry(downloadOutcome(503, RENDERER_UNAVAILABLE), 1)).toBe(true)
    expect(canRetry(downloadOutcome(503, RENDERER_UNAVAILABLE), 5)).toBe(true)
  })

  it('offers ONE more on a 504, and then stops — a second timeout is an incident', () => {
    expect(canRetry(downloadOutcome(504, RENDER_TIMEOUT), 1)).toBe(true)
    expect(canRetry(downloadOutcome(504, RENDER_TIMEOUT), 2)).toBe(false)
  })

  it('🚩 `attempts` counts CONSECUTIVE failures of one kind, which is why a 504 after two 503s still gets its go', () => {
    // The count the Page keeps is per-outcome, not per-row-lifetime: a row that
    // hit two recycling hosts and then a hung render has timed out ONCE. Reading
    // it as "the third attempt" would withdraw the button on the first timeout
    // the user ever saw.
    expect(canRetry(downloadOutcome(504, RENDER_TIMEOUT), 1)).toBe(true)
  })
})
