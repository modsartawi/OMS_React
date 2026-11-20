import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { doorScreenFor, readRefusal } from './refusal'

const refusal = (code: string, status: number, data: unknown = null, message = 'English words.') =>
  new ApiError('business', message, status, [{ errorCode: code, internalErrorCode: '', errorMessage: message }], data)

describe('a refusal is shown in the words the server sent', () => {
  it('the door’s own refusal: its code, English and Arabic', () => {
    const err = refusal('MINIPOS_ITEM_PHARMACIST_ONLY', 422, {
      stage: 'scan',
      messageEn: 'Sold by the pharmacist, please direct the customer to the counter.',
      messageAr: 'يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.',
    }, 'Sold by the pharmacist, please direct the customer to the counter.')
    expect(readRefusal(err, 'fallback')).toEqual({
      code: 'MINIPOS_ITEM_PHARMACIST_ONLY',
      english: 'Sold by the pharmacist, please direct the customer to the counter.',
      arabic: 'يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.',
    })
  })

  it('a session verb’s refusal: English only', () => {
    expect(readRefusal(refusal('NO_CUSTOMER_ATTACHED', 409, null, 'Attach a customer first.'), 'fallback')).toEqual({
      code: 'NO_CUSTOMER_ATTACHED',
      english: 'Attach a customer first.',
      arabic: null,
    })
  })

  it('not an API error at all: the fallback', () => {
    expect(readRefusal(new Error('boom'), 'Something went wrong.')).toEqual({ code: null, english: 'Something went wrong.', arabic: null })
  })
})

describe('the door’s answer decides the screen', () => {
  it.each([
    ['MINIPOS_NOT_SIGNED_IN', 'signIn'],
    ['MINIPOS_NOT_ASSIGNED_TODAY', 'notAssigned'],
    ['MINIPOS_NOT_PROMOTER', 'blocked'],
    ['MINIPOS_DISABLED', 'blocked'],
    ['MINIPOS_LOGIN_TOO_LONG', 'blocked'],
    ['MINIPOS_NOT_UNLOCKED', 'unlock'],
    ['MINIPOS_ITEM_NOT_SOLD', null],
    ['SESSION_BUSY', null],
  ])('%s → %s', (code, screen) => {
    expect(doorScreenFor(refusal(code, 403))).toBe(screen)
  })

  it('a bare 401 (the channel key or the bearer refused) → sign in', () => {
    expect(doorScreenFor(new ApiError('auth', 'Session ended', 401))).toBe('signIn')
  })
})
