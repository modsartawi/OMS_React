import { describe, expect, it } from 'vitest'

import { ApiError } from '@/core/api'
import {
  downloadFailure,
  IDOC_TYPE_NOT_PRESENT,
  IDOC_TYPE_NOT_SERIALISABLE,
  IDOC_TYPE_REQUIRED,
  INVALID_KEY,
  STORE_CODE_REQUIRED,
  TRX_NUMBER_REQUIRED,
} from './download-outcome'

/** An enveloped, coded refusal — the shape `core/api.ts` builds from a non-2xx
 *  that carried `success:false` with a code. */
const business = (status: number, code: string, message: string) =>
  new ApiError('business', message, status, [
    { errorCode: code, internalErrorCode: '', errorMessage: message },
  ])

describe('downloadFailure', () => {
  it('aFailedDownloadSurfacesItsBusinessMessageNotAGenericError', () => {
    // 🔑 The whole ticket. The rail said exactly what was wrong; the screen must
    // not answer with "the download failed".
    const outcome = downloadFailure(
      business(404, IDOC_TYPE_NOT_PRESENT, 'This transaction has no document of that IDoc type.'),
    )
    expect(outcome.serverMessage).toBe('This transaction has no document of that IDoc type.')
    expect(outcome.code).toBe(IDOC_TYPE_NOT_PRESENT)
    expect(outcome.messageKey).toBe('idocInspector.download.errors.notPresent')
  })

  it('names every code the rail publishes with its own fallback sentence', () => {
    const keyOf = (code: string) => downloadFailure(business(400, code, '')).messageKey
    expect(keyOf(STORE_CODE_REQUIRED)).toBe('idocInspector.download.errors.invalidKey')
    expect(keyOf(TRX_NUMBER_REQUIRED)).toBe('idocInspector.download.errors.invalidKey')
    expect(keyOf(INVALID_KEY)).toBe('idocInspector.download.errors.invalidKey')
    expect(keyOf(IDOC_TYPE_REQUIRED)).toBe('idocInspector.download.errors.typeRequired')
    expect(keyOf(IDOC_TYPE_NOT_PRESENT)).toBe('idocInspector.download.errors.notPresent')
    expect(keyOf(IDOC_TYPE_NOT_SERIALISABLE)).toBe('idocInspector.download.errors.notSerialisable')
  })

  it('keeps the server sentence for a code this bundle does not know', () => {
    // A deployment ahead of this bundle. The code is unfamiliar; the sentence
    // beside it is still true, and dropping it would be the collapse this module
    // forbids arriving through the back door.
    const outcome = downloadFailure(business(409, 'SOMETHING_NEW', 'The rail says no.'))
    expect(outcome.serverMessage).toBe('The rail says no.')
    expect(outcome.code).toBe('SOMETHING_NEW')
    expect(outcome.messageKey).toBe('idocInspector.download.errors.generic')
  })

  it('keeps the server sentence for an UNCODED business failure', () => {
    expect(downloadFailure(new ApiError('business', 'Rejected.', 400)).serverMessage).toBe(
      'Rejected.',
    )
  })

  it('⚠️ a BARE 403 reads as a refusal, not as a generic failure', () => {
    // The grant filter answers with no body at all, so `ApiError.message` is the
    // shared "unexpected status" string — showing it would tell a refused user
    // something went wrong when in fact they were told no.
    const outcome = downloadFailure(new ApiError('unknown', 'Unexpected error (403).', 403))
    expect(outcome.messageKey).toBe('idocInspector.download.errors.denied')
    expect(outcome.serverMessage).toBeNull()
  })

  it('a CODED 403 is still reported as its code — the bare arm is a fallback', () => {
    const outcome = downloadFailure(business(403, 'SOMETHING_NEW', 'A named refusal.'))
    expect(outcome.code).toBe('SOMETHING_NEW')
    expect(outcome.serverMessage).toBe('A named refusal.')
  })

  it('401 is the central handler’s, and says so rather than blanking', () => {
    const outcome = downloadFailure(new ApiError('auth', 'Session ended.', 401))
    expect(outcome.messageKey).toBe('idocInspector.download.errors.session')
    expect(outcome.serverMessage).toBeNull()
  })

  it('a network fault is its own sentence, never the generic one', () => {
    const outcome = downloadFailure(new ApiError('network', 'Network error.', 0))
    expect(outcome.messageKey).toBe('idocInspector.download.errors.network')
    expect(outcome.serverMessage).toBeNull()
  })

  it('a 5xx that lost its envelope is generic, and carries no invented sentence', () => {
    const outcome = downloadFailure(new ApiError('server', 'Server error.', 500))
    expect(outcome.messageKey).toBe('idocInspector.download.errors.generic')
    expect(outcome.serverMessage).toBeNull()
  })

  it('anything that is not an ApiError is a bug in this repo, not an answer', () => {
    expect(downloadFailure(new TypeError('boom'))).toEqual({
      messageKey: 'idocInspector.download.errors.generic',
      serverMessage: null,
      code: null,
    })
    expect(downloadFailure(null).messageKey).toBe('idocInspector.download.errors.generic')
  })

  it('⚠️ a BLANK server message is null, so it cannot win over the screen’s copy', () => {
    // `serverMessage ?? t(messageKey)` is how the component reads this: an empty
    // string would win that `??` and draw a failure with no sentence at all.
    expect(downloadFailure(business(404, IDOC_TYPE_NOT_PRESENT, '   ')).serverMessage).toBeNull()
  })
})
