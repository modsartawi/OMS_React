import { describe, expect, it } from 'vitest'
import type { LoyaltyMember } from '@/core/models/callcenter'
import {
  beginSignup,
  canConfirmOtp,
  canSendCode,
  CLOSED_SIGNUP,
  codeSent,
  DEFAULT_SIGNUP_COUNTRY,
  mobilePreview,
  SIGNUP_COUNTRIES,
  signupCapture,
  signupConfirmCapture,
  signupCreated,
} from './signup-view'

const MEMBER: LoyaltyMember = {
  loyId: '8801234567',
  mobile: '+966501234567',
  fullName: 'Nouf A. Al-Qahtani',
  tier: 'Silver',
  pointsBalance: 0,
  email: null,
}

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

describe('the step machine', () => {
  it('runs closed → details → otp → created, and each step only from the one before it', () => {
    const details = beginSignup('0501234567')
    const otp = codeSent(details)
    expect(otp.step).toBe('otp')
    expect(otp.otp).toBe('')

    const created = signupCreated({ ...otp, otp: '1234' }, MEMBER)
    expect(created.step).toBe('created')
    expect(created.created).toBe(MEMBER)
  })

  it('refuses the moves that are not on the flow, leaving the state untouched', () => {
    // 🚩 An enrolled caller must not be put back in front of a code box for an
    // enrolment that has already happened — and a member cannot appear before
    // the code that proved the number.
    const created = signupCreated(codeSent(beginSignup('0501234567')), MEMBER)
    expect(codeSent(created)).toBe(created)
    expect(codeSent(CLOSED_SIGNUP)).toBe(CLOSED_SIGNUP)

    const details = beginSignup('0501234567')
    expect(signupCreated(details, MEMBER)).toBe(details)
    expect(signupCreated(CLOSED_SIGNUP, MEMBER)).toBe(CLOSED_SIGNUP)
  })

  it('ends at a member the agent still has to attach', () => {
    // 165's two steps, which a freshly enrolled caller does not get to skip: the
    // step machine records who was created and performs nothing on the order.
    const created = signupCreated(codeSent(beginSignup('05')), MEMBER)
    expect(created.created).toEqual(MEMBER)
    expect(Object.keys(created)).not.toContain('attached')
  })
})

describe('what goes on the wire', () => {
  it('carries the number AS TYPED — never the preview the agent read back', () => {
    // 🚩 The whole point of the preview being display-only. `mobilePreview`
    // drops SA's leading zero and prefixes the dialling code; the body does
    // neither, because the loyalty base's key is normalised in ONE place and
    // that place is the server (156's exact failure, avoided).
    const state = { ...beginSignup(' 0501234567 '), step: 'otp' as const, otp: ' 1234 ' }
    const preview = mobilePreview(state.countryCode, state.mobile)
    expect(preview).toBe('+966501234567')

    const capture = signupCapture(state)
    expect(capture.mobile).toBe('0501234567')
    expect(capture.mobile).not.toBe(preview)
    expect(capture.mobile).not.toContain('+')
    expect(capture.mobile).not.toContain('966')

    expect(signupConfirmCapture(state).mobile).toBe(capture.mobile)
    expect(signupConfirmCapture(state).otp).toBe('1234')
  })

  it('has no branch on it, and no field a branch could be smuggled in', () => {
    // 🚩 `CreatedByBranchId` is written PERMANENTLY and the validator does not
    // require it, so a browser that could name a branch could credit any
    // pharmacy in the estate. The server stamps the call centre's own store.
    const state = { ...beginSignup('0501234567'), step: 'otp' as const, otp: '1234' }
    expect(Object.keys(signupCapture(state)).sort()).toEqual(['countryCode', 'mobile'])
    expect(Object.keys(signupConfirmCapture(state)).sort()).toEqual([
      'countryCode',
      'mobile',
      'otp',
    ])
    // 132's ruling kept whole — two fields and no more, so no language either.
    expect(JSON.stringify(signupConfirmCapture(state))).not.toMatch(/branch|language/i)
  })
})
