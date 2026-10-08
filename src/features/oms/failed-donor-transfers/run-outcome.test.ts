/**
 * The re-run's outcome (ticket 435, spec 430 D5/D12/D17): what the run's answer — or its failure
 * to answer — tells HQ. A network failure or a timeout never reads as "failed".
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { runOutcome } from './run-outcome'

const refusal = (code: string, message: string, status = 409) =>
  new ApiError('business', message, status, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

describe('runOutcome', () => {
  it('a run that succeeded posted', () => {
    expect(runOutcome({ ok: true, result: { success: true, error: null } })).toEqual({ kind: 'posted' })
  })

  it('a run that answered success:false did not finish, with its error trimmed', () => {
    expect(runOutcome({ ok: true, result: { success: false, error: '  DRS: material 100234 is blocked  ' } })).toEqual({
      kind: 'notFinished',
      error: 'DRS: material 100234 is blocked',
    })
  })

  it('a run that did not finish with no error says so without a gap', () => {
    expect(runOutcome({ ok: true, result: { success: false, error: '' } })).toEqual({ kind: 'notFinished', error: null })
    expect(runOutcome({ ok: true, result: { success: false, error: null } })).toEqual({ kind: 'notFinished', error: null })
  })

  it('an answer with no result is not read as posted', () => {
    expect(runOutcome({ ok: true, result: null })).toEqual({ kind: 'notFinished', error: null })
  })

  it('a network failure may still be running', () => {
    expect(runOutcome({ ok: false, error: new ApiError('network', 'offline', 0) })).toEqual({ kind: 'noAnswer' })
  })

  it('a gateway timeout or a server fault may still be running too — never "failed"', () => {
    expect(runOutcome({ ok: false, error: new ApiError('server', 'x', 504) })).toEqual({ kind: 'noAnswer' })
    expect(runOutcome({ ok: false, error: new ApiError('server', 'x', 500) })).toEqual({ kind: 'noAnswer' })
    expect(runOutcome({ ok: false, error: new ApiError('unknown', 'x', 408) })).toEqual({ kind: 'noAnswer' })
  })

  it('a thrown non-ApiError (an aborted call) may still be running', () => {
    expect(runOutcome({ ok: false, error: new Error('aborted') })).toEqual({ kind: 'noAnswer' })
  })

  it('NOT_RERUNNABLE is a refusal shown with its own message', () => {
    expect(runOutcome({ ok: false, error: refusal('NOT_RERUNNABLE', 'The job is not FAILED.') })).toEqual({
      kind: 'refused',
      code: 'NOT_RERUNNABLE',
      message: 'The job is not FAILED.',
    })
  })

  it('any other business refusal (a missing grant) is shown with its message as well', () => {
    expect(runOutcome({ ok: false, error: refusal('FORBIDDEN', 'You do not hold FailedDonorTransfers (06).', 403) })).toEqual({
      kind: 'refused',
      code: 'FORBIDDEN',
      message: 'You do not hold FailedDonorTransfers (06).',
    })
  })

  it('a refusal with no message leaves the wording to the screen, never a raw code', () => {
    expect(runOutcome({ ok: false, error: refusal('NOT_RERUNNABLE', '  ') })).toEqual({
      kind: 'refused',
      code: 'NOT_RERUNNABLE',
      message: null,
    })
  })

  it('an ended session is the app shell\'s to say, not the run\'s', () => {
    expect(runOutcome({ ok: false, error: new ApiError('auth', 'Session ended', 401) })).toEqual({ kind: 'signedOut' })
  })
})
