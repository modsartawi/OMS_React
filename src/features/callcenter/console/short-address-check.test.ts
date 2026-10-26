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
import { checkLanguage, checkResult, cityNamesOf, checkView, isCheckable, showsCheck, type CheckViewInput } from './short-address-check'

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

  it('any other failure is unavailable — never unknown', () => {
    expect(checkResult(null, refusal('CCL-00005'))).toEqual({ outcome: 'unavailable' })
    expect(checkResult(null, new ApiError('server', 'Unexpected API error (HTTP 500)', 500))).toEqual({
      outcome: 'unavailable',
    })
    expect(checkResult(null, new ApiError('network', 'Failed to fetch', 0))).toEqual({ outcome: 'unavailable' })
    expect(checkResult(null, new Error('boom'))).toEqual({ outcome: 'unavailable' })
  })

  it('an answer outside the three outcomes, or FOUND with no parts, is unavailable', () => {
    expect(checkResult({ outcome: 'MAYBE', parts: null }, null)).toEqual({ outcome: 'unavailable' })
    expect(checkResult({ outcome: 'FOUND', parts: null }, null)).toEqual({ outcome: 'unavailable' })
    expect(checkResult(null, null)).toEqual({ outcome: 'unavailable' })
  })
})

const input = (over: Partial<CheckViewInput> = {}): CheckViewInput => ({
  code: 'RIMA6904',
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
    expect(checkView(input({ pending: 'RIMA6904' }))).toEqual({ kind: 'checking' })
  })

  it('FOUND: the parts on one line, the additional number apart, no warning when the city agrees', () => {
    expect(checkView(input({ checked: { code: 'RIMA6904', result: { outcome: 'found', parts: PARTS } } }))).toEqual({
      kind: 'found',
      line: '6904 · Anas Ibn Malik · Al Malqa · Riyadh · 13521',
      additionalNumber: '2834',
      cityWarning: null,
    })
  })

  it('FOUND: blank parts drop out of the line, and a blank additional number is null', () => {
    const parts = { ...PARTS, street: null, postCode: '  ', additionalNumber: null }
    expect(checkView(input({ checked: { code: 'RIMA6904', result: { outcome: 'found', parts } } }))).toEqual({
      kind: 'found',
      line: '6904 · Al Malqa · Riyadh',
      additionalNumber: null,
      cityWarning: null,
    })
  })

  it("compares the city trimmed and case-insensitive, against either of the form city's names", () => {
    const found = (city: string) =>
      checkView(input({ checked: { code: 'RIMA6904', result: { outcome: 'found', parts: { ...PARTS, city } } } }))
    expect(found('  RIYADH ')).toMatchObject({ cityWarning: null })
    expect(found('الرياض')).toMatchObject({ cityWarning: null })
    expect(found('Jeddah')).toMatchObject({ cityWarning: { spl: 'Jeddah', form: 'Riyadh' } })
  })

  it('no warning while the form has no city yet, or SPL gave none', () => {
    const parts = { ...PARTS, city: 'Jeddah' }
    expect(
      checkView(input({ formCity: '', formCityNames: [], checked: { code: 'RIMA6904', result: { outcome: 'found', parts } } })),
    ).toMatchObject({ cityWarning: null })
    expect(
      checkView(input({ checked: { code: 'RIMA6904', result: { outcome: 'found', parts: { ...PARTS, city: null } } } })),
    ).toMatchObject({ cityWarning: null })
  })

  it('UNKNOWN, UNAVAILABLE and the malformed refusal each have their own state', () => {
    const view = (outcome: 'unknown' | 'unavailable' | 'malformed') =>
      checkView(input({ checked: { code: 'RIMA6904', result: { outcome } } }))
    expect(view('unknown')).toEqual({ kind: 'unknown' })
    expect(view('unavailable')).toEqual({ kind: 'unavailable' })
    expect(view('malformed')).toEqual({ kind: 'malformed' })
  })

  it('an answer about another code says nothing: editing the box drops it', () => {
    const checked = { code: 'RIMA6904', result: { outcome: 'unknown' as const } }
    expect(checkView(input({ code: 'RIMA6905', checked }))).toEqual({ kind: 'idle' })
    expect(checkView(input({ code: 'RIMA6905', pending: 'RIMA6904' }))).toEqual({ kind: 'idle' })
  })

  it('matches the code as the wire carries it: trimmed and upper-case', () => {
    const checked = { code: 'RIMA6904', result: { outcome: 'unknown' as const } }
    expect(checkView(input({ code: ' rima6904 ', checked }))).toEqual({ kind: 'unknown' })
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
