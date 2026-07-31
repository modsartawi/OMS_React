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
 * The language the loyalty base will speak to this caller in — `A` or `E`, CC2's
 * own two codes (`IsEnglish ? "E" : "A"`, `CustomerCreateSectionVM:144`).
 *
 * 🚩 **It is asked, not defaulted** (owner-stated 2026-07-29). 132 ruled the form
 * to country + mobile and no more, and the model's own comment justified the
 * omission as *"the server's own default is the honest answer to a question the
 * agent was never asked."* That reasoning stood only while the question went
 * unasked. It doesn't: the agent is already on the phone with the caller, and the
 * door's `PreferredLanguage = "A"` default is not a neutral absence — it is a
 * standing answer of *Arabic*, written onto the member and used for every SMS
 * they will ever be sent. An English-speaking caller enrolled by this console got
 * Arabic messages forever and nobody was ever asked.
 *
 * The rest of 132's ruling is untouched: still no name and no email, and customer
 * *edit* stays out.
 */
export type SignupLanguage = 'A' | 'E'

/** Arabic first, as CC2 lists them and as its form defaults. */
export const SIGNUP_LANGUAGES: SignupLanguage[] = ['A', 'E']

/**
 * ⚠️ The same default the door already holds, chosen deliberately rather than
 * inherited: the control starts somewhere, and starting it anywhere else would
 * change what an agent who never touches it enrols today.
 */
export const DEFAULT_SIGNUP_LANGUAGE: SignupLanguage = 'A'

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
  /** 🚩 Asked on step 1, beside the number — it is part of *who is calling*, not
   *  a preference to be tidied up afterwards. There is no later: the confirm
   *  enrols them and this console has no customer edit. */
  language: SignupLanguage
  otp: string
  /** The member the confirm returned. The console still ATTACHES deliberately —
   *  165's two-step rule, which a freshly created caller does not get to skip:
   *  the enrolment and the order are two acts, and the second is the one that
   *  puts a name on a real order. */
  created: LoyaltyMember | null
}

/**
 * Splits what the agent typed at the LOOKUP into the country the picker should
 * show and the local number the field should hold — CC2's `QuickCreate`
 * (`CustomerSectionVM:167`) exactly.
 *
 * 🚩 **This is a PREFILL, not a normalisation.** It decides what the two controls
 * open on; the agent can change either, and the wire still carries
 * `{ countryCode, mobile }` for the server to build the key from. 156's rule bans
 * a second implementation of the ENROLLED NUMBER, and this never produces one —
 * `mobilePreview` remains the only display line and `LoyMobileNumbers` remains
 * the only builder.
 *
 * ⚠️ Why it has to exist at all: the country picker defaults to Saudi, so a caller
 * who dictated `971501234567` in full was enrolled under SA — and the server,
 * parsing against the country the agent NAMED, would build `966971501234567` and
 * mint a member at a number nobody has. The agent had no way to see it: the field
 * showed the right digits.
 */
export function detectSignupCountry(typed: string): { countryCode: string; local: string } {
  const cleaned = (typed ?? '').trim().replace(/^\+/, '').replace(/\D/g, '')
  if (cleaned === '') return { countryCode: DEFAULT_SIGNUP_COUNTRY, local: '' }

  // Longest dialling code first, so a short one cannot match ahead of a longer
  // one that shares its prefix. `>` not `>=`: a number that is ONLY a dialling
  // code has no subscriber in it and is not a match.
  const match = [...SIGNUP_COUNTRIES]
    .sort((a, b) => b.diallingCode.length - a.diallingCode.length)
    .find((country) => cleaned.startsWith(country.diallingCode) && cleaned.length > country.diallingCode.length)

  if (match) return { countryCode: match.code, local: cleaned.slice(match.diallingCode.length) }

  // Unrecognised — the call centre is Saudi, so that is the honest default, and
  // the one national quirk applies: a Saudi number is dictated with a leading
  // zero and stored without it.
  const local = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned
  return { countryCode: DEFAULT_SIGNUP_COUNTRY, local }
}

export function beginSignup(mobile: string): SignupState {
  const detected = detectSignupCountry(mobile)
  return {
    step: 'details',
    countryCode: detected.countryCode,
    // 🚩 The number the agent already typed into the lookup carries over — as its
    // LOCAL part, with the country it implied moved into the picker beside it. A
    // not-found lookup is the natural entry to signup (the ticket's own ruling),
    // and asking for the number a second time would read as *that was wrong* when
    // it was merely new.
    mobile: detected.local,
    language: DEFAULT_SIGNUP_LANGUAGE,
    otp: '',
    created: null,
  }
}

export const CLOSED_SIGNUP: SignupState = {
  step: 'closed',
  countryCode: DEFAULT_SIGNUP_COUNTRY,
  mobile: '',
  language: DEFAULT_SIGNUP_LANGUAGE,
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
 *
 * 🚩 `preferredLanguage` IS on the wire now, and it rides on **both** legs. The
 * door defaults it to `"A"` per body, so a confirm that dropped it would silently
 * overwrite an English answer given on the send — the two legs must agree or the
 * agent's question was decorative.
 */
export function signupCapture(state: SignupState): LoyaltySignupCapture {
  return {
    countryCode: state.countryCode,
    mobile: state.mobile.trim(),
    preferredLanguage: state.language,
  }
}

/** The confirm's body — the same two values (the server re-reads the number it
 *  sent the code to) plus the code itself. */
export function signupConfirmCapture(state: SignupState): LoyaltySignupConfirmCapture {
  return { ...signupCapture(state), otp: state.otp.trim() }
}
