/**
 * A loyalty-group door's refusal in the active locale (oms ticket 630, BackOffice spec 3173): every
 * refusal carries `messageEn` + `messageAr` and a stable Loy error code.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { loyGroupRefusal } from './refusal'

const duplicate = () =>
  new ApiError(
    'business',
    'Group code RAMADAN_VIP already exists.',
    409,
    [{ errorCode: 'LOY-00601', internalErrorCode: '', errorMessage: 'Group code RAMADAN_VIP already exists.' }],
    { messageEn: 'Group code RAMADAN_VIP already exists.', messageAr: 'رمز المجموعة RAMADAN_VIP موجود مسبقاً.' },
  )

describe('a loyalty-group refusal reads in the active locale, with its Loy code', () => {
  it('reads messageEn under English and messageAr under Arabic', () => {
    expect(loyGroupRefusal(duplicate(), 'en', 'fallback')).toStrictEqual({
      code: 'LOY-00601',
      message: 'Group code RAMADAN_VIP already exists.',
    })
    expect(loyGroupRefusal(duplicate(), 'ar', 'fallback').message).toBe('رمز المجموعة RAMADAN_VIP موجود مسبقاً.')
  })

  it('falls back to the other language, then to the envelope message, then to the caller', () => {
    const arOnly = new ApiError('business', 'x', 409, [{ errorCode: 'LOY-00600', internalErrorCode: '', errorMessage: 'x' }], {
      messageEn: '',
      messageAr: 'رمز غير صالح',
    })
    expect(loyGroupRefusal(arOnly, 'en', 'fallback')).toStrictEqual({ code: 'LOY-00600', message: 'رمز غير صالح' })
    expect(loyGroupRefusal(new ApiError('business', 'Envelope says no.', 409), 'en', 'fallback')).toStrictEqual({
      code: null,
      message: 'Envelope says no.',
    })
    expect(loyGroupRefusal(new Error('bug'), 'en', 'fallback')).toStrictEqual({ code: null, message: 'fallback' })
  })
})
