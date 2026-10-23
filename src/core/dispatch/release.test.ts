/**
 * Ticket 541 — the Release lock form (BackOffice 2959): a reason is required, `Other` needs a note,
 * and each of the lock's refusals maps to its own sentence.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { releaseForm, releaseRefusal } from './release'

describe('releaseForm', () => {
  it('no reason is blocked', () => {
    expect(releaseForm({ reason: '', note: '' })).toEqual({ ready: false, problem: 'reasonMissing', body: null })
  })

  it('a reason the door does not know is blocked as missing', () => {
    expect(releaseForm({ reason: 'Whim', note: '' }).problem).toBe('reasonMissing')
  })

  it('Other without a note is blocked — white space is no note', () => {
    expect(releaseForm({ reason: 'Other', note: '' }).problem).toBe('noteMissing')
    expect(releaseForm({ reason: 'Other', note: '  \n ' }).ready).toBe(false)
  })

  it('Other with a note is sent, the note trimmed', () => {
    expect(releaseForm({ reason: 'Other', note: '  customer moved  ' }, 'D100')).toEqual({
      ready: true,
      problem: null,
      body: { deliveryNumber: 'D100', reason: 'Other', note: 'customer moved' },
    })
  })

  it.each(['NoStock', 'CustomerChange', 'StoreCannotFulfil'])('%s needs no note, and a blank one is left off', (reason) => {
    expect(releaseForm({ reason, note: ' ' }, 'D100')).toEqual({ ready: true, problem: null, body: { deliveryNumber: 'D100', reason } })
  })

  it('a note given with another reason is still sent', () => {
    expect(releaseForm({ reason: 'NoStock', note: 'shelf empty' }, 'D1').body).toEqual({ deliveryNumber: 'D1', reason: 'NoStock', note: 'shelf empty' })
  })
})

describe('releaseRefusal', () => {
  const refusal = (errorCode: string, message = 'server words') =>
    new ApiError('business', message, 400, [{ errorCode, internalErrorCode: '', errorMessage: message }])

  it.each([
    ['CALLOUT-102', 'reasonMissing'],
    ['CALLOUT-103', 'noteMissing'],
    ['CALLOUT-104', 'notLocked'],
  ])('%s maps to its own sentence', (code, key) => {
    expect(releaseRefusal(refusal(code))).toEqual({ key: `release.refusal.${key}`, code })
  })

  it('any other refusal, or a non-ApiError, is not the form’s', () => {
    expect(releaseRefusal(refusal('SD-404'))).toBeNull()
    expect(releaseRefusal(new Error('boom'))).toBeNull()
    expect(releaseRefusal(null)).toBeNull()
  })
})
