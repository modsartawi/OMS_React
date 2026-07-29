/**
 * The loyalty signup's two steps, and the number they are about.
 * Wayfinder ticket [159](.issues/159-coupon-and-loyalty-signup-drawn.md).
 *
 * [132](.issues/132-header-capture-inventory.md) ruled the flow in and said there
 * was *"nothing to build server-side"* — which turned out to be true of the
 * ROUTES and not of the door: `CallCenterWeb/SignUpByBranch` and
 * `CallCenterWeb/ConfirmSignUpByBranch` are both already mounted and gated
 * (which answers the ticket's own 🚩 door check — the console can create the
 * caller it can find). What is not settled is what the browser is allowed to put
 * in them, and that is what this module's shape encodes.
 *
 * 🚩 **`branchId` is not here, on purpose.** The server writes it to
 * `CreatedByBranchId` on the member forever and onto every member-action row;
 * CC2 fills it from `POSCommon.Store.StoreCode`, the call-centre's own store.
 * The owner ruled the web sends the same thing — which means the SERVER stamps
 * it, exactly as 878/801 stamp `CountryKey` / `LanguageKey` / `AddressType` on
 * the address capture. A browser that could name the branch could credit any
 * pharmacy in the estate with an enrolment, and the routes are verbatim
 * pass-throughs today.
 *
 * 🚩 **The dialling code is drawn, not sent.** CC2 builds the wire's mobile
 * itself (`MobileNumberHelper.BuildFullNumber` — dialling code + local, with a
 * leading zero stripped for SA only) out of a country list COMPILED INTO the WPF
 * client. Re-implementing that here would put one rule in two clients over a
 * value that is the loyalty base's key —
 * [156](.issues/156-delivery-fee-shared-rule.md)'s exact failure. So the preview
 * below is display only: it shows the agent the number they are about to enrol,
 * and the wire carries the country code beside what was typed.
 */
import type {
  LoyaltyMember,
  LoyaltySignupCapture,
  LoyaltySignupConfirmCapture,
} from '@/core/models/callcenter'

/** One country the loyalty base accepts a mobile from. */
export interface SignupCountry {
  code: string
  diallingCode: string
}

/**
 * CC2's six, in CC2's order, with SA first because CC2 defaults to it
 * (`CustomerCreateSectionVM:29`).
 *
 * Reference data the console may hold — the precedent is
 * [179](.issues/179-the-address-editor-and-its-capture-contract.md)'s districts.
 * It is a LIST, not a rule: nothing here decides whether a number is valid, and
 * the server's `LoyMobile()` validator stays the only opinion on that.
 */
export const SIGNUP_COUNTRIES: SignupCountry[] = [
  { code: 'SA', diallingCode: '966' },
  { code: 'BH', diallingCode: '973' },
  { code: 'KW', diallingCode: '965' },
  { code: 'AE', diallingCode: '971' },
  { code: 'QA', diallingCode: '974' },
  { code: 'OM', diallingCode: '968' },
]

export const DEFAULT_SIGNUP_COUNTRY = 'SA'

/**
 * What the agent reads back to the caller before the code is sent — never what
 * is put on the wire.
 *
 * It reproduces CC2's shape (dialling code + local, SA's leading zero dropped)
 * because a preview that disagreed with the number actually enrolled would be
 * worse than no preview. That it CAN disagree, the day the server's rule
 * changes, is the reason the wire does not carry this string.
 */
export function mobilePreview(countryCode: string, typed: string): string | null {
  const country = SIGNUP_COUNTRIES.find((entry) => entry.code === countryCode)
  const digits = typed.replace(/\D/g, '')
  if (!country || !digits) return null

  // The one national quirk CC2 encodes: a Saudi number is dictated with a
  // leading 0 and stored without it.
  const local =
    country.code === 'SA' && digits.startsWith('0') ? digits.slice(1) : digits

  // Already dictated in full, dialling code and all.
  if (digits.startsWith(country.diallingCode)) return `+${digits}`
  return local ? `+${country.diallingCode}${local}` : null
}

/**
 * The two steps, plus the two states either side of them.
 *
 * `otp` is the one that shapes the drawing: the caller is reading the code back
 * down the phone, so the wait is SPOKEN. That is why the signup is drawn inline
 * in the rail rather than as a modal — a modal over the console during a wait
 * the agent is talking through takes the basket away for no reason.
 */
export type SignupStep = 'closed' | 'details' | 'otp' | 'created'

export interface SignupState {
  step: SignupStep
  countryCode: string
  mobile: string
  otp: string
  /** The member the confirm returned. The console still ATTACHES deliberately —
   *  165's two-step rule, which a freshly created caller does not get to skip:
   *  the enrolment and the order are two acts, and the second is the one that
   *  puts a name on a real order. */
  created: LoyaltyMember | null
}

export function beginSignup(mobile: string): SignupState {
  return {
    step: 'details',
    countryCode: DEFAULT_SIGNUP_COUNTRY,
    // 🚩 The number the agent already typed into the lookup carries over. A
    // not-found lookup is the natural entry to signup (the ticket's own ruling),
    // and asking for the number a second time would read as *that was wrong*
    // when it was merely new.
    mobile,
    otp: '',
    created: null,
  }
}

export const CLOSED_SIGNUP: SignupState = {
  step: 'closed',
  countryCode: DEFAULT_SIGNUP_COUNTRY,
  mobile: '',
  otp: '',
  created: null,
}

/** The *Send code* button is a control. CC2 requires a mobile and a country and
 *  nothing else (no name, no email — 132's ruling, kept whole). */
export function canSendCode(state: SignupState): boolean {
  return state.step === 'details' && state.mobile.trim().length > 0 && !!state.countryCode
}

/** The *Confirm* button is a control. The server's own rule is 4–6 digits
 *  (`LoyConfirmSignUpByBranchRequestValidator`), and the console holds the same
 *  shape so a typo costs a keystroke rather than a round trip — the SERVER still
 *  decides whether the code is right. */
export function canConfirmOtp(state: SignupState): boolean {
  return state.step === 'otp' && /^\d{4,6}$/.test(state.otp.trim())
}

/**
 * The code has been asked for: `details → otp`, with the code box empty.
 *
 * 🚩 **Legal from `details` and nowhere else.** The two steps are the flow's
 * whole shape, and a transition that fired from `created` would put an enrolled
 * caller back in front of a code box for an enrolment that has already happened.
 * An illegal move returns the state untouched rather than throwing: this is a
 * console an agent is driving mid-call, and the honest answer to a step that
 * cannot happen is that nothing moved.
 */
export function codeSent(state: SignupState): SignupState {
  if (state.step !== 'details') return state
  return { ...state, step: 'otp', otp: '' }
}

/**
 * The code was right and the loyalty base has a member: `otp → created`.
 *
 * 🚩 It records the member and stops. **Attaching is a second act** — 165's two
 * steps, which a freshly enrolled caller does not get to skip: enrolling
 * somebody and putting them on a live order are two different facts, and only
 * the second is about this order.
 */
export function signupCreated(state: SignupState, member: LoyaltyMember): SignupState {
  if (state.step !== 'otp') return state
  return { ...state, step: 'created', created: member }
}

/**
 * What `SignUpByBranch` is given — and, as much, what it is NOT given.
 *
 * 🚩 The mobile is `trim`med and otherwise **verbatim**. Trimming removes what
 * the agent's keyboard added; anything beyond that (a leading zero, a dialling
 * code) is the loyalty base's key being decided in a browser, which is the
 * second implementation [156](.issues/156-delivery-fee-shared-rule.md) named. The
 * dialling-code line the agent reads back is `mobilePreview` and it is drawn
 * only — the two are allowed to disagree, and the day they do it is the server's
 * answer that enrols the caller.
 *
 * 🚩 There is no `branchId` field to leave out at a call site, because there is
 * no `branchId` field: `LoyaltySignupCapture` cannot express one.
 */
export function signupCapture(state: SignupState): LoyaltySignupCapture {
  return { countryCode: state.countryCode, mobile: state.mobile.trim() }
}

/** The confirm's body — the same two values (the server re-reads the number it
 *  sent the code to) plus the code itself. */
export function signupConfirmCapture(state: SignupState): LoyaltySignupConfirmCapture {
  return { ...signupCapture(state), otp: state.otp.trim() }
}
