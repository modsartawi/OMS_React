/**
 * `aStaleTabIsRefusedNotMisrouted` — the pure half of ticket 164's stale-tab
 * property.
 *
 * The harm (§6.2, and the same one 127 refused auto-resume to prevent): the
 * agent abandoned order A, opened B for a new caller, and a forgotten tab still
 * showing A fires a verb. Because `transactionId` is explicit and validated, the
 * server refuses — and this module is the one place the console reads that
 * refusal, so "return to the start" is one rule rather than a branch per verb.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { readSessionFault } from './session-fault'

const refusal = (code: string, data: unknown = null, status = 409) =>
  new ApiError('business', 'refused', status, [{ errorCode: code, internalErrorCode: '', errorMessage: '' }], data)

describe('readSessionFault', () => {
  it('reads a closed session with the reason the server gave', () => {
    for (const reason of ['submitted', 'abandoned', 'swept']) {
      expect(readSessionFault(refusal('SESSION_CLOSED', { reason }))).toEqual({
        kind: 'closed',
        reason,
      })
    }
  })

  it('reads a closed session that carries no reason at all', () => {
    // The envelope's `data` is the server's, and a refusal carrying none is a
    // real wire state. The tab must still return to the start — the reason is
    // an explanation, never the condition.
    expect(readSessionFault(refusal('SESSION_CLOSED'))).toEqual({ kind: 'closed', reason: null })
    expect(readSessionFault(refusal('SESSION_CLOSED', { reason: 42 }))).toEqual({
      kind: 'closed',
      reason: null,
    })
    expect(readSessionFault(refusal('SESSION_CLOSED', 'abandoned'))).toEqual({
      kind: 'closed',
      reason: null,
    })
  })

  it('keeps an unknown reason rather than dropping it', () => {
    // §9 — an added `reason` category is a MINOR bump that ships server-first.
    // Dropping it would make a new category read as "no reason given".
    expect(readSessionFault(refusal('SESSION_CLOSED', { reason: 'expired' }))).toEqual({
      kind: 'closed',
      reason: 'expired',
    })
  })

  it("reads someone else's session as its own outcome", () => {
    // 403: the transaction belongs to another register. A hard stop — and the
    // way back is the agent's OWN order, which is what returning to the start
    // reaches (a fresh `open` answers `refusedExisting` with it, §8.1).
    expect(readSessionFault(refusal('NOT_YOUR_SESSION', null, 403))).toEqual({
      kind: 'notYours',
      reason: null,
    })
  })

  it('is silent about everything else', () => {
    // 🚩 The rule is narrow on purpose. A busy collision is retried, a guardrail
    // refusal is a banner over the state it refused from (US63), and neither may
    // throw the agent back to the start — the basket is still good.
    for (const code of ['SESSION_BUSY', 'REBIND_REFUSED', 'SUBMIT_REFUSED', 'CONSOLE_NOT_GRANTED']) {
      expect(readSessionFault(refusal(code))).toBeNull()
    }
    expect(readSessionFault(new ApiError('network', 'offline', 0))).toBeNull()
    expect(readSessionFault(new TypeError('boom'))).toBeNull()
    expect(readSessionFault(null)).toBeNull()
  })
})
