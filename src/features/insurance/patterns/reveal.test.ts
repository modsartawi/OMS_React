/**
 * Oms 923 (BackOffice spec 4050 story 15; door 4053 `POST …/Cases/{caseNumber}/Reveal`) — the investigator's reason for a
 * reveal. At least 10 characters once trimmed (4053 refuses a shorter one), at most 250 (4053 keeps it in an
 * `NVARCHAR(250)` and would clamp a longer one). The dialog reads its problem from `revealProblem`; only a body
 * `revealBody` made is ever sent.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { REASON_MAX, REASON_MIN, revealBody, RevealEmptyError, revealFailure, RevealNotSentError, revealProblem } from './reveal'

describe('what stops a reveal', () => {
  it('a reason under 10 characters, counted after trimming', () => {
    expect(REASON_MIN).toBe(10)
    for (const reason of ['', '          ', 'too short', '  123456789  ', '\n\tabc\n', 'سبب الكشف'])
      expect([reason, revealProblem(reason)]).toEqual([reason, 'short'])
  })

  it('10 characters is enough, Arabic letter by letter as English', () => {
    for (const reason of ['0123456789', '  0123456789  ', 'تحقق الدفع']) expect([reason, revealProblem(reason)]).toEqual([reason, null])
  })

  it('a reason past 250 characters, counted after trimming', () => {
    expect(REASON_MAX).toBe(250)
    expect(revealProblem('x'.repeat(250))).toBeNull()
    expect(revealProblem(`  ${'x'.repeat(250)}  `)).toBeNull()
    expect(revealProblem('x'.repeat(251))).toBe('tooLong')
  })
})

describe('the body sent', () => {
  it('the reason trimmed and nothing else: no actor, the server reads the session', () => {
    expect(revealBody('  The payer asked for this case by letter.  ')).toEqual({ reason: 'The payer asked for this case by letter.' })
    expect(revealBody('تحقق الدفع')).toEqual({ reason: 'تحقق الدفع' })
  })

  it('none for a reason with a problem', () => {
    expect(revealBody('too short')).toBeNull()
    expect(revealBody('x'.repeat(251))).toBeNull()
  })
})

describe('why a reveal failed, for the dialog’s words', () => {
  const coded = (status: number, code: string, message: string) =>
    new ApiError('business', message, status, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

  it('a bare 403 (the grant filter refused before any handler, no sentence came back): the investigator grant', () => {
    expect(revealFailure(new ApiError('unknown', 'Unexpected API error (HTTP 403)', 403))).toBe('denied')
  })

  it('a coded refusal speaks the server’s own sentence, a coded 403 included', () => {
    expect(revealFailure(coded(500, 'REVEAL_NOT_LOGGED', 'The reveal could not be logged, so no patient is shown.'))).toBe('refused')
    expect(revealFailure(coded(403, 'NOT_INVESTIGATOR', 'Only an investigator may reveal a patient.'))).toBe('refused')
    expect(revealFailure(new ApiError('network', 'The server could not be reached.', 0))).toBe('refused')
  })

  it('an answer with nobody in it says so', () => {
    expect(revealFailure(new RevealEmptyError())).toBe('empty')
  })

  it('anything else falls to the server’s sentence, or the dialog’s own fallback', () => {
    expect(revealFailure(new RevealNotSentError())).toBe('refused')
    expect(revealFailure(new Error('boom'))).toBe('refused')
  })
})
