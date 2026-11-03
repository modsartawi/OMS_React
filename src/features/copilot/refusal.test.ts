import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import en from '@/locales/en/copilot.json'
import { copilotRefusal } from './refusal'

const coded = (code: string, message = `Server says ${code}.`, data: unknown = null) =>
  new ApiError('business', message, 403, [{ errorCode: code, internalErrorCode: '', errorMessage: message }], data)

const instance = i18next.createInstance()
await instance.init({ lng: 'en', resources: { en: { copilot: en } }, defaultNS: 'copilot', interpolation: { escapeValue: false } })

describe('the refusals (spec 734 D7)', () => {
  it('copilotRefusal_mapsEveryCodeAndFallsBack', () => {
    // Every D7 code reads as its own words, never the raw code.
    expect(copilotRefusal(coded('COPILOT-401'), 'fallback')).toEqual({ key: 'refusal.noGrant', resetAt: null })
    expect(copilotRefusal(coded('COPILOT-402'), 'fallback')).toEqual({ key: 'refusal.rateLimitNoTime', resetAt: null })
    expect(copilotRefusal(coded('COPILOT-403'), 'fallback')).toEqual({ key: 'refusal.personalData', resetAt: null })
    expect(copilotRefusal(coded('COPILOT-404'), 'fallback')).toEqual({ key: 'refusal.unreachable', resetAt: null })
    expect(copilotRefusal(coded('COPILOT-405'), 'fallback')).toEqual({ key: 'refusal.tooLong', resetAt: null })
    expect(copilotRefusal(coded('COPILOT-406'), 'fallback')).toEqual({ key: 'refusal.conversationOver', resetAt: null })

    // 402 carries its reset time in the refusal's data: it is read, and named.
    expect(copilotRefusal(coded('COPILOT-402', 'Limit.', { resetAt: '2026-11-03T11:00:00' }), 'fallback')).toEqual({
      key: 'refusal.rateLimit',
      resetAt: '2026-11-03T11:00:00',
    })
    // …and a malformed one is not.
    expect(copilotRefusal(coded('COPILOT-402', 'Limit.', { resetAt: 42 }), 'fallback')).toEqual({ key: 'refusal.rateLimitNoTime', resetAt: null })

    // An unknown code is the server's own message, through apiErrorMessage.
    expect(copilotRefusal(coded('COPILOT-499', 'Something new from the server.'), 'fallback')).toEqual({ message: 'Something new from the server.' })
    // A failure that is not an envelope at all reads as the fallback.
    expect(copilotRefusal(new Error('boom'), 'The question could not be answered.')).toEqual({ message: 'The question could not be answered.' })

    // Every key has its words in the namespace, and none of them is a raw code.
    for (const key of ['noGrant', 'rateLimit', 'rateLimitNoTime', 'personalData', 'unreachable', 'tooLong', 'conversationOver']) {
      expect(instance.exists(`refusal.${key}`), key).toBe(true)
      expect(instance.t(`refusal.${key}`)).not.toMatch(/COPILOT/)
    }
    expect(instance.t('refusal.personalData')).toMatch(/personal data/i)
  })
})
