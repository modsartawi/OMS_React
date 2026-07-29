import { describe, expect, it } from 'vitest'
import {
  beginSignup,
  canConfirmOtp,
  canSendCode,
  CLOSED_SIGNUP,
  DEFAULT_SIGNUP_COUNTRY,
  mobilePreview,
  SIGNUP_COUNTRIES,
} from './signup-view'

describe('SIGNUP_COUNTRIES', () => {
  it('is CC2’s six, defaulting to the one CC2 defaults to', () => {
    expect(SIGNUP_COUNTRIES.map((c) => c.code)).toEqual(['SA', 'BH', 'KW', 'AE', 'QA', 'OM'])
    expect(DEFAULT_SIGNUP_COUNTRY).toBe('SA')
  })
})

describe('mobilePreview', () => {
  it('drops the leading zero for SA — the number is dictated with one and stored without', () => {
    expect(mobilePreview('SA', '0501234567')).toBe('+966501234567')
  })

  it('keeps a leading zero everywhere else, because the quirk is national', () => {
    // CC2's `StripLocalPrefix` guards on `CountryCode == "SA"` explicitly, and a
    // console that generalised it would silently mangle a Kuwaiti number.
    expect(mobilePreview('KW', '0501234567')).toBe('+9650501234567')
  })

  it('does not double a dialling code the caller already dictated', () => {
    expect(mobilePreview('SA', '966501234567')).toBe('+966501234567')
  })

  it('is null with nothing to preview, so the line is absent rather than half-built', () => {
    expect(mobilePreview('SA', '')).toBeNull()
    expect(mobilePreview('SA', '   ')).toBeNull()
    expect(mobilePreview('ZZ', '0501234567')).toBeNull()
  })
})

describe('beginSignup', () => {
  it('carries the number the lookup already asked for', () => {
    // 🚩 The not-found lookup is the entry to signup. Asking again would read as
    // *that was wrong* when the number was merely new.
    const state = beginSignup('0501234567')
    expect(state.step).toBe('details')
    expect(state.mobile).toBe('0501234567')
    expect(state.countryCode).toBe('SA')
    expect(state.created).toBeNull()
  })
})

describe('the two controls', () => {
  it('needs a mobile and a country and NOTHING else', () => {
    // 132's ruling kept whole: CC2 collects country + mobile, then the code. No
    // name, no email. A console that asked for more would be inventing a form.
    expect(canSendCode(beginSignup(''))).toBe(false)
    expect(canSendCode(beginSignup('0501234567'))).toBe(true)
    expect(canSendCode({ ...beginSignup('0501234567'), countryCode: '' })).toBe(false)
  })

  it('is not a control at all before the code has been asked for', () => {
    expect(canSendCode(CLOSED_SIGNUP)).toBe(false)
    expect(canConfirmOtp({ ...beginSignup('05'), otp: '1234' })).toBe(false)
  })

  it('holds the server’s own 4–6 digit shape, and lets the server decide correctness', () => {
    const otp = (value: string) => canConfirmOtp({ ...beginSignup('05'), step: 'otp', otp: value })
    expect(otp('123')).toBe(false)
    expect(otp('1234')).toBe(true)
    expect(otp('123456')).toBe(true)
    expect(otp('1234567')).toBe(false)
    expect(otp('12a4')).toBe(false)
  })
})
