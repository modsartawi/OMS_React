import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { saveRefusal } from './item-save'

const coded = (code: string, message = `Server says ${code}.`, data: unknown = null) =>
  new ApiError('business', message, 409, [{ errorCode: code, internalErrorCode: '', errorMessage: message }], data)

describe('a refused save, in the tiers’ terms', () => {
  it('403 is "not yours to edit in place": the copy is offered', () => {
    expect(saveRefusal(coded('ANALYTICS-403'))).toEqual({ kind: 'not-yours' })
  })
  it('405 names who saved last and when, from the refusal', () => {
    expect(saveRefusal(coded('ANALYTICS-405', 'Newer.', { updatedBy: 'aalharbi', updatedAt: '2026-11-05T09:40:00', revision: 5 }))).toEqual({
      kind: 'conflict',
      by: 'aalharbi',
      at: '2026-11-05T09:40:00',
      revision: 5,
      message: 'Newer.',
    })
  })
  it('405 without who and when still conflicts, carrying the server’s words', () => {
    expect(saveRefusal(coded('ANALYTICS-405', 'Someone saved first.'))).toEqual({ kind: 'conflict', by: null, at: null, revision: null, message: 'Someone saved first.' })
  })
  it('anything else is not a tier refusal', () => {
    expect(saveRefusal(coded('ANALYTICS-406'))).toBeNull()
    expect(saveRefusal(new Error('boom'))).toBeNull()
  })
})
