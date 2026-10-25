/**
 * Ticket 570 — what each serving-list write failure reads as in its dialog: the screen's own words for
 * `SVL-00001` and `SVL-00004`..`SVL-00007`, the server's "English / Arabic" text kept as the fallback for any
 * other code, a bare 403 as "not granted", and which refusals mean the screen is stale (refetch).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { writeRefusal } from './write-refusal'

const refused = (code: string, message: string) =>
  new ApiError('business', message, 400, [{ errorCode: code, errorMessage: message, internalErrorCode: '' }])

describe('writeRefusal', () => {
  it.each([
    ['SVL-00001', 'Serving list X does not exist. / …', 'writes.refusal.unknownList', true],
    ['SVL-00004', 'Store 1001 is not on serving list X. / …', 'writes.refusal.notMember', true],
    ['SVL-00005', 'A serving list needs a name in English and in Arabic. / …', 'writes.refusal.nameRequired', false],
    ['SVL-00006', 'The English name is longer than 100 characters. / …', 'writes.refusal.nameTooLong', false],
    ['SVL-00007', 'Serving list X is already deactivated. / …', 'writes.refusal.alreadyInState', true],
  ])('%s reads as its own words, keeps the server text, and says whether to refetch', (code, message, labelKey, stale) => {
    expect(writeRefusal(refused(code, message))).toEqual({ kind: 'refused', code, labelKey, message, stale })
  })

  it('an unknown code falls back to the server text', () => {
    expect(writeRefusal(refused('SVL-00099', 'Something new. / شيء جديد.'))).toEqual({
      kind: 'refused',
      code: 'SVL-00099',
      labelKey: null,
      message: 'Something new. / شيء جديد.',
      stale: false,
    })
  })

  it('a bare 403 is the Execute grant not held', () => {
    expect(writeRefusal(new ApiError('business', 'Unexpected API error (HTTP 403)', 403))).toEqual({ kind: 'notGranted' })
  })

  it('a failure with no code keeps its message (or blank, for the dialog to word)', () => {
    expect(writeRefusal(new ApiError('network', 'The server could not be reached.', 0))).toEqual({ kind: 'failed', message: 'The server could not be reached.' })
    expect(writeRefusal(new Error('boom'))).toEqual({ kind: 'failed', message: '' })
  })
})
