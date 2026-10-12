/**
 * Ticket 477 — the reason every Deliverect write carries: 1–200 characters once trimmed, unicode
 * kept, and the server's DLV-00009 refusal surfaced as its own sentence for the inline slot.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { REASON_MAX, fieldRefusal, reasonField, reasonRefusal } from './reason'

describe('reasonField', () => {
  it('the ceiling is the contract’s 200', () => {
    expect(REASON_MAX).toBe(200)
  })

  it.each(['', '   ', '\n\t '])('blank (%j) is empty and may not be sent', (text) => {
    expect(reasonField(text)).toEqual({ reason: '', length: 0, problem: 'empty' })
  })

  it('one character is enough', () => {
    expect(reasonField('x').problem).toBeNull()
  })

  it('trims the ends and nothing inside', () => {
    expect(reasonField('  wrong account\nper ops  ').reason).toBe('wrong account\nper ops')
  })

  it('unicode is kept as typed — Arabic with diacritics, and an emoji', () => {
    const text = 'نُقِل الفرع إلى حساب OlaCare 👍'
    const check = reasonField(text)
    expect(check.reason).toBe(text)
    expect(check.problem).toBeNull()
  })

  it('200 characters pass and 201 are too long — counted after the trim', () => {
    const arabic200 = 'ع'.repeat(200)
    expect(reasonField(`  ${arabic200}  `)).toEqual({ reason: arabic200, length: 200, problem: null })
    expect(reasonField('ع'.repeat(201)).problem).toBe('tooLong')
  })

  it('counts as the server does (UTF-16 units): 100 emoji fill the 200', () => {
    expect(reasonField('👍'.repeat(100)).problem).toBeNull()
    expect(reasonField('👍'.repeat(100) + 'x').problem).toBe('tooLong')
  })
})

describe('reasonRefusal', () => {
  const refusal = (errorCode: string, message: string) =>
    new ApiError('business', message, 400, [{ errorCode, internalErrorCode: '', errorMessage: message }])

  it('DLV-00009 hands back the server’s own sentence, both languages, for the inline slot', () => {
    const message = 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'
    expect(reasonRefusal(refusal('DLV-00009', message), 'fallback')).toBe(message)
  })

  it('any other refusal is not the reason field’s', () => {
    expect(reasonRefusal(refusal('DLV-00002', 'Already onboarded.'), 'fallback')).toBeNull()
  })

  it('fieldRefusal picks a field’s own codes, with the server’s words and the code', () => {
    const err = refusal('DLV-00003', 'No such account. / لا يوجد حساب.')
    expect(fieldRefusal(err, ['DLV-00003'], 'fallback')).toEqual({ message: 'No such account. / لا يوجد حساب.', code: 'DLV-00003' })
    expect(fieldRefusal(err, ['DLV-00001', 'DLV-00002'], 'fallback')).toBeNull()
  })

  it('a non-ApiError, or nothing, is not a reason refusal', () => {
    expect(reasonRefusal(new Error('boom'), 'fallback')).toBeNull()
    expect(reasonRefusal(null, 'fallback')).toBeNull()
  })
})
