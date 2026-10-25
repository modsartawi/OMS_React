/**
 * Ticket 551 — the reason every HungerStation write carries (contract § Common "Writes"): 1–200
 * characters once trimmed, unicode kept, and the server's DHS-00008 refusal surfaced as its own
 * sentence for the inline slot. The rule itself is the shared one (`@/core/reason`); what this file
 * pins is that the HungerStation area reads it with ITS code, never Deliverect's.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { REASON_MAX, reasonField, reasonRefusal } from './reason'

const refusal = (errorCode: string, message: string) =>
  new ApiError('business', message, 400, [{ errorCode, internalErrorCode: '', errorMessage: message }])

describe('reasonField (HungerStation writes)', () => {
  it('the ceiling is the contract’s 200', () => {
    expect(REASON_MAX).toBe(200)
  })

  it.each(['', '  ', '\n'])('blank (%j) may not be sent', (text) => {
    expect(reasonField(text).problem).toBe('empty')
  })

  it('one character is enough, 200 pass, 201 are too long — counted after the trim', () => {
    expect(reasonField('x').problem).toBeNull()
    expect(reasonField(`  ${'ه'.repeat(200)}  `)).toEqual({ reason: 'ه'.repeat(200), length: 200, problem: null })
    expect(reasonField('ه'.repeat(201)).problem).toBe('tooLong')
  })

  it('unicode is kept as typed — Arabic with diacritics, a line break, an emoji', () => {
    const text = 'غُيِّر رقم المورّد\nبطلب هنقرستيشن 👍'
    expect(reasonField(` ${text} `).reason).toBe(text)
  })
})

describe('reasonRefusal (HungerStation)', () => {
  it('DHS-00008 hands back the server’s own sentence, both languages, for the inline slot', () => {
    const message = 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'
    expect(reasonRefusal(refusal('DHS-00008', message), 'fallback')).toBe(message)
  })

  it('🚩 Deliverect’s reason code is not this area’s, and neither is another DHS refusal', () => {
    expect(reasonRefusal(refusal('DLV-00009', 'A reason is required.'), 'fallback')).toBeNull()
    expect(reasonRefusal(refusal('DHS-00005', 'The vendor id belongs to another store.'), 'fallback')).toBeNull()
  })

  it('a non-ApiError, or nothing, is not a reason refusal', () => {
    expect(reasonRefusal(new Error('boom'), 'fallback')).toBeNull()
    expect(reasonRefusal(undefined, 'fallback')).toBeNull()
  })
})
