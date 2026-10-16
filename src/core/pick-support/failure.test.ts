/** How a Pick support door's failure reads (ticket 496): a bare 403, or a coded refusal. */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { pickSupportFailure } from './failure'

describe('pickSupportFailure', () => {
  it('a bodiless 403 reads denied, whatever its kind', () => {
    expect(pickSupportFailure(new ApiError('unknown', 'Unexpected 403', 403), 'x')).toEqual({ kind: 'denied' })
    expect(pickSupportFailure(new ApiError('business', 'no', 403), 'x')).toEqual({ kind: 'denied' })
  })

  it('a 403 that carries a coded envelope is a refusal with its code, not the bare denial', () => {
    const err = new ApiError('business', 'Not granted', 403, [{ errorCode: 'AUTHZ-1', internalErrorCode: '', errorMessage: 'Not granted' }])
    expect(pickSupportFailure(err, 'x')).toEqual({ kind: 'refused', code: 'AUTHZ-1', message: 'Not granted' })
  })

  it('a PICK refusal carries the server sentence and its code', () => {
    const err = new ApiError('business', 'Delivery 8006777300 not found', 400, [
      { errorCode: 'PICK-00002', internalErrorCode: '', errorMessage: 'Delivery 8006777300 not found' },
    ])
    expect(pickSupportFailure(err, 'x')).toEqual({ kind: 'refused', code: 'PICK-00002', message: 'Delivery 8006777300 not found' })
  })

  it('errors[0].errorMessage outranks the envelope message', () => {
    const err = new ApiError('business', 'envelope', 400, [{ errorCode: 'PICK-00003', internalErrorCode: '', errorMessage: 'The key is blank' }])
    expect(pickSupportFailure(err, 'x')).toEqual({ kind: 'refused', code: 'PICK-00003', message: 'The key is blank' })
  })

  it('a failure with no code still shows its message, with no code', () => {
    expect(pickSupportFailure(new ApiError('server', 'Server error', 500), 'x')).toEqual({ kind: 'refused', code: null, message: 'Server error' })
  })

  it('a non-ApiError reads as the fallback', () => {
    expect(pickSupportFailure(new Error('boom'), 'fallback')).toEqual({ kind: 'refused', code: null, message: 'fallback' })
  })
})
