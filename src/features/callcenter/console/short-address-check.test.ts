/**
 * The address form's **Check** of a typed Short Address (579, BackOffice spec 3072 / 3074):
 * the route's answer `{ outcome: FOUND|UNKNOWN|UNAVAILABLE, parts }` (or its failure) in,
 * the one inline state out.
 *
 * Expected values are literals worked from the ticket: FOUND shows the parts on one line plus
 * the additional number and the city warning; UNKNOWN is "not known"; UNAVAILABLE **or any
 * failure** is "unavailable"; `CCL-00014` is the field's own error; no capability, no Check.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  checkLanguage,
  checkPressable,
  checkResult,
  cityNamesOf,
  checkView,
  isCheckable,
  showsCheck,
  type CheckViewInput,
} from './short-address-check'

describe('showsCheck', () => {
  it('shows Check only while the session says SPL is configured', () => {
    expect(showsCheck({ canCheckShortAddress: true })).toBe(true)
  })

  it('hides it when the capability is false or absent (a pre-3074 server)', () => {
    expect(showsCheck({ canCheckShortAddress: false })).toBe(false)
    expect(showsCheck({})).toBe(false)
  })
})

describe('checkLanguage', () => {
  it("asks in the console's language: Arabic is A, anything else E", () => {
    expect(checkLanguage('ar')).toBe('A')
    expect(checkLanguage('ar-SA')).toBe('A')
    expect(checkLanguage('en')).toBe('E')
    expect(checkLanguage('')).toBe('E')
  })
})

describe('isCheckable', () => {
  it('checks a code that passes the offline format check', () => {
    expect(isCheckable('RIMA6904')).toBe(true)
    expect(isCheckable(' rima6904 ')).toBe(true)
  })

  it('does not spend a call on a blank or already-malformed box', () => {
    expect(isCheckable('')).toBe(false)
    expect(isCheckable('   ')).toBe(false)
    expect(isCheckable('RIMA69')).toBe(false)
  })
})

const PARTS = {
  buildingNumber: '6904',
  street: 'Anas Ibn Malik',
  district: 'Al Malqa',
  city: 'Riyadh',
  postCode: '13521',
  additionalNumber: '2834',
}

const refusal = (code: string, message = 'refused') =>
  new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

describe('checkResult', () => {
  it('FOUND carries the parts', () => {
    expect(checkResult({ outcome: 'FOUND', parts: PARTS }, null)).toEqual({ outcome: 'found', parts: PARTS })
  })

  it('UNKNOWN is not known to SPL', () => {
    expect(checkResult({ outcome: 'UNKNOWN', parts: null }, null)).toEqual({ outcome: 'unknown' })
  })

  it('UNAVAILABLE is unavailable', () => {
    expect(checkResult({ outcome: 'UNAVAILABLE', parts: null }, null)).toEqual({ outcome: 'unavailable' })
  })

  it('CCL-00014 is the field’s own error, not an SPL answer', () => {
    expect(checkResult(null, refusal('CCL-00014', 'The Short Address is malformed.'))).toEqual({ outcome: 'malformed' })
  })

  it('a business refusal other than CCL-00014 is the server’s own words and code — not an outage', () => {
    expect(checkResult(null, refusal('CCL-00005', 'Caller unknown.'))).toEqual({
      outcome: 'refused',
      message: 'Caller unknown.',
      code: 'CCL-00005',
    })
    // A refusal with no code still says what the server said.
    expect(checkResult(null, new ApiError('business', 'Not allowed here.', 409))).toEqual({
      outcome: 'refused',
      message: 'Not allowed here.',
      code: null,
    })
  })

  it('a refusal with no message carries none, so the form falls back to its own words', () => {
    const silent = new ApiError('business', '', 409, [{ errorCode: 'X-1', internalErrorCode: '', errorMessage: '' }])
    expect(checkResult(null, silent)).toEqual({ outcome: 'refused', message: null, code: 'X-1' })
  })

  it('only a fault — server, network, unknown, or not an ApiError at all — is unavailable, never unknown', () => {
    expect(checkResult(null, new ApiError('server', 'Unexpected API error (HTTP 500)', 500))).toEqual({
      outcome: 'unavailable',
    })
    expect(checkResult(null, new ApiError('network', 'Failed to fetch', 0))).toEqual({ outcome: 'unavailable' })
    expect(checkResult(null, new ApiError('unknown', 'Unexpected API error (HTTP 403)', 403))).toEqual({
      outcome: 'unavailable',
    })
    expect(checkResult(null, new Error('boom'))).toEqual({ outcome: 'unavailable' })
  })

  it('an answer outside the three outcomes, or FOUND with no parts, is unavailable', () => {
    expect(checkResult({ outcome: 'MAYBE', parts: null }, null)).toEqual({ outcome: 'unavailable' })
    expect(checkResult({ outcome: 'FOUND', parts: null }, null)).toEqual({ outcome: 'unavailable' })
    expect(checkResult(null, null)).toEqual({ outcome: 'unavailable' })
  })

  it('FOUND whose parts are all blank or null is unavailable, the same as no parts', () => {
    const blank = { buildingNumber: null, street: '  ', district: '', city: null, postCode: null, additionalNumber: ' ' }
    expect(checkResult({ outcome: 'FOUND', parts: blank }, null)).toEqual({ outcome: 'unavailable' })
    // One part is enough to be an answer.
    expect(checkResult({ outcome: 'FOUND', parts: { ...blank, additionalNumber: '2834' } }, null)).toMatchObject({
      outcome: 'found',
    })
  })
})

const input = (over: Partial<CheckViewInput> = {}): CheckViewInput => ({
  code: 'RIMA6904',
  language: 'E',
  checked: null,
  pending: null,
  formCity: 'Riyadh',
  formCityNames: ['Riyadh', 'الرياض'],
  ...over,
})

describe('checkView', () => {
  it('is idle before any check', () => {
    expect(checkView(input())).toEqual({ kind: 'idle' })
  })

  it('is checking while the call for this code is in flight', () => {
    expect(checkView(input({ pending: { code: 'RIMA6904', language: 'E' } }))).toEqual({ kind: 'checking' })
  })

  it('FOUND: the parts on one line, the additional number apart, no warning when the city agrees', () => {
    expect(checkView(input({ checked: { code: 'RIMA6904', language: 'E', result: { outcome: 'found', parts: PARTS } } }))).toEqual({
      kind: 'found',
      line: '6904 · Anas Ibn Malik · Al Malqa · Riyadh · 13521',
      ledByNumber: true,
      additionalNumber: '2834',
      cityWarning: null,
    })
  })

  it('FOUND: blank parts drop out of the line, and a blank additional number is null', () => {
    const parts = { ...PARTS, street: null, postCode: '  ', additionalNumber: null }
    expect(checkView(input({ checked: { code: 'RIMA6904', language: 'E', result: { outcome: 'found', parts } } }))).toEqual({
      kind: 'found',
      line: '6904 · Al Malqa · Riyadh',
      ledByNumber: true,
      additionalNumber: null,
      cityWarning: null,
    })
  })

  it('FOUND: the line is led by the building number (a machine value) only when SPL gave one', () => {
    const parts = { ...PARTS, buildingNumber: null }
    expect(checkView(input({ checked: { code: 'RIMA6904', language: 'E', result: { outcome: 'found', parts } } }))).toMatchObject({
      line: 'Anas Ibn Malik · Al Malqa · Riyadh · 13521',
      ledByNumber: false,
    })
  })

  it("compares the city trimmed and case-insensitive, against either of the form city's names", () => {
    const found = (city: string) =>
      checkView(input({ checked: { code: 'RIMA6904', language: 'E', result: { outcome: 'found', parts: { ...PARTS, city } } } }))
    expect(found('  RIYADH ')).toMatchObject({ cityWarning: null })
    expect(found('الرياض')).toMatchObject({ cityWarning: null })
    expect(found('Jeddah')).toMatchObject({ cityWarning: { spl: 'Jeddah', form: 'Riyadh' } })
  })

  it('no warning while the form has no city yet, or SPL gave none', () => {
    const parts = { ...PARTS, city: 'Jeddah' }
    expect(
      checkView(input({ formCity: '', formCityNames: [], checked: { code: 'RIMA6904', language: 'E', result: { outcome: 'found', parts } } })),
    ).toMatchObject({ cityWarning: null })
    expect(
      checkView(input({ checked: { code: 'RIMA6904', language: 'E', result: { outcome: 'found', parts: { ...PARTS, city: null } } } })),
    ).toMatchObject({ cityWarning: null })
  })

  it('UNKNOWN, UNAVAILABLE and the malformed refusal each have their own state', () => {
    const view = (outcome: 'unknown' | 'unavailable' | 'malformed') =>
      checkView(input({ checked: { code: 'RIMA6904', language: 'E', result: { outcome } } }))
    expect(view('unknown')).toEqual({ kind: 'unknown' })
    expect(view('unavailable')).toEqual({ kind: 'unavailable' })
    expect(view('malformed')).toEqual({ kind: 'malformed' })
  })

  it('an answer about another code says nothing: editing the box drops it', () => {
    const checked = { code: 'RIMA6904', language: 'E' as const, result: { outcome: 'unknown' as const } }
    expect(checkView(input({ code: 'RIMA6905', checked }))).toEqual({ kind: 'idle' })
    expect(checkView(input({ code: 'RIMA6905', pending: { code: 'RIMA6904', language: 'E' } }))).toEqual({ kind: 'idle' })
  })

  it('matches the code as the wire carries it: trimmed and upper-case', () => {
    const checked = { code: 'RIMA6904', language: 'E' as const, result: { outcome: 'unknown' as const } }
    expect(checkView(input({ code: ' rima6904 ', checked }))).toEqual({ kind: 'unknown' })
  })

  it('an answer asked in the other language says nothing either: it is keyed by code AND language', () => {
    const checked = { code: 'RIMA6904', language: 'E' as const, result: { outcome: 'unknown' as const } }
    expect(checkView(input({ language: 'A', checked }))).toEqual({ kind: 'idle' })
    expect(checkView(input({ language: 'A', pending: { code: 'RIMA6904', language: 'E' } }))).toEqual({ kind: 'idle' })
  })

  it('a refusal carries the server’s message and code to the form', () => {
    const result = { outcome: 'refused' as const, message: 'Caller unknown.', code: 'CCL-00005' }
    expect(checkView(input({ checked: { code: 'RIMA6904', language: 'E', result } }))).toEqual({
      kind: 'refused',
      message: 'Caller unknown.',
      code: 'CCL-00005',
    })
  })
})

describe('checkPressable', () => {
  it('offers Check for a well-formed box with no call in flight', () => {
    expect(checkPressable({ code: 'RIMA6904', language: 'E', pending: null })).toBe(true)
  })

  it('not for a blank or malformed box', () => {
    expect(checkPressable({ code: '', language: 'E', pending: null })).toBe(false)
    expect(checkPressable({ code: 'RIMA69', language: 'E', pending: null })).toBe(false)
  })

  it('not while the call for this very code is in flight', () => {
    expect(checkPressable({ code: ' rima6904 ', language: 'E', pending: { code: 'RIMA6904', language: 'E' } })).toBe(false)
  })

  it('again as soon as the box holds another code (or the language moved): the older answer is ignored by its key', () => {
    expect(checkPressable({ code: 'RIMA6905', language: 'E', pending: { code: 'RIMA6904', language: 'E' } })).toBe(true)
    expect(checkPressable({ code: 'RIMA6904', language: 'A', pending: { code: 'RIMA6904', language: 'E' } })).toBe(true)
  })
})

describe('cityNamesOf', () => {
  const row = (cityCode: string, cityNameEn: string, cityNameAr: string) =>
    ({ districtCode: 'D', cityCode, cityNameEn, cityNameAr })

  it("gathers the form city's English and Arabic names from the district list, once each", () => {
    const rows = [row('0021', 'Riyadh', 'الرياض'), row('0021', 'Riyadh', 'الرياض'), row('0002', 'Jeddah', 'جدة')]
    expect(cityNamesOf(rows, '0021', 'Riyadh')).toEqual(['Riyadh', 'الرياض'])
  })

  it("falls back to the form's own city name when the list is not read, and to nothing with no city", () => {
    expect(cityNamesOf(undefined, '0021', 'Riyadh')).toEqual(['Riyadh'])
    expect(cityNamesOf([], '', '')).toEqual([])
  })
})
