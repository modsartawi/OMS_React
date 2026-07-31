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
  SIGNUP_LANGUAGES,
  detectSignupCountry,
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
    expect(state.countryCode).toBe('SA')
    expect(state.created).toBeNull()
    // Its LOCAL part, with the country it implied moved into the picker — CC2's
    // `QuickCreate`. See the prefill tests below for why that split matters.
    expect(state.mobile).toBe('501234567')
  })
})

describe('detectSignupCountry — what the two controls open on', () => {
  it('reads the country out of a number dictated in full', () => {
    // ⚠️ The defect this closes. The picker defaulted to Saudi, so a caller who
    // read back `971501234567` was enrolled under SA — and the server, parsing
    // against the country the agent NAMED, would build `966971501234567` and mint
    // a member at a number nobody has. Nothing on screen looked wrong: the field
    // held the right digits.
    expect(detectSignupCountry('971501234567')).toEqual({ countryCode: 'AE', local: '501234567' })
    expect(detectSignupCountry('+973361234567')).toEqual({ countryCode: 'BH', local: '361234567' })
    expect(beginSignup('971501234567').countryCode).toBe('AE')
  })

  it('drops the leading zero a Saudi number is dictated with', () => {
    expect(detectSignupCountry('0501234567')).toEqual({ countryCode: 'SA', local: '501234567' })
    expect(detectSignupCountry('501234567')).toEqual({ countryCode: 'SA', local: '501234567' })
    // Already full — the dialling code moves to the picker rather than staying in
    // the field, so the server cannot be handed it twice.
    expect(detectSignupCountry('966501234567')).toEqual({ countryCode: 'SA', local: '501234567' })
  })

  it('falls back to Saudi rather than inventing a country', () => {
    // The call centre is Saudi. An unrecognised prefix is far likelier to be a
    // typo than a seventh country, and the loyalty validator is what refuses it.
    expect(detectSignupCountry('123').countryCode).toBe('SA')
    expect(detectSignupCountry('')).toEqual({ countryCode: 'SA', local: '' })
    expect(detectSignupCountry('   ')).toEqual({ countryCode: 'SA', local: '' })
  })

  it('does not treat a bare dialling code as a number from that country', () => {
    // 🚩 `966` alone has no subscriber in it. Matching it would empty the field
    // and leave the agent looking at a country they never chose.
    expect(detectSignupCountry('966').local).not.toBe('')
    expect(detectSignupCountry('966')).toEqual({ countryCode: 'SA', local: '966' })
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
    // The field as the agent left it — a leading zero they typed back in is kept,
    // because the field is theirs and the server is what resolves it.
    const state = { ...beginSignup(' 0501234567 '), mobile: ' 0501234567 ', step: 'otp' as const, otp: ' 1234 ' }
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
    expect(Object.keys(signupCapture(state)).sort()).toEqual([
      'countryCode',
      'mobile',
      'preferredLanguage',
    ])
    expect(Object.keys(signupConfirmCapture(state)).sort()).toEqual([
      'countryCode',
      'mobile',
      'otp',
      'preferredLanguage',
    ])
    // ⚠️ The branch half of 132's ruling is the half that holds, and this is the
    // assertion that keeps it: `language` used to be barred by the same line, and
    // it was NOT the same argument. See the language tests below.
    expect(JSON.stringify(signupConfirmCapture(state))).not.toMatch(/branch/i)
  })
})

describe('the language the caller is written down as', () => {
  it('starts at Arabic — the answer the door was already giving', () => {
    // ⚠️ Not a fresh preference. The door declares `PreferredLanguage = "A"`, so
    // starting the control anywhere else would change what an agent who never
    // touches it enrols today.
    expect(beginSignup('0501234567').language).toBe('A')
    expect(CLOSED_SIGNUP.language).toBe('A')
    expect(SIGNUP_LANGUAGES).toEqual(['A', 'E'])
  })

  it('rides on BOTH legs, or the question was decorative', () => {
    // 🚩 The door defaults `preferredLanguage` PER BODY. A confirm that dropped
    // an English answer given on the send would quietly overwrite it back to
    // Arabic — the caller would be asked, answered, and recorded as the opposite.
    const english = { ...beginSignup('0501234567'), language: 'E' as const, step: 'otp' as const, otp: '1234' }
    expect(signupCapture(english).preferredLanguage).toBe('E')
    expect(signupConfirmCapture(english).preferredLanguage).toBe('E')
  })

  it('sends CC2\'s codes, not its words', () => {
    // The wire carries `A` / `E` (`CustomerCreateSectionVM:144`). *Arabic* and
    // *English* are i18n keys the agent reads, and they never reach the server.
    const capture = signupCapture({ ...beginSignup('05'), language: 'E' })
    expect(capture.preferredLanguage).toBe('E')
    expect(JSON.stringify(capture)).not.toMatch(/english|arabic/i)
  })
})
