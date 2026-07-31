/**
 * PROTOTYPE (wayfinder ticket 159) — *this caller isn't in the system.*
 *
 * CC2's two-step loyalty OTP signup, drawn where the console actually needs it:
 * under a lookup that found nobody. [132](.issues/132-header-capture-inventory.md)
 * ruled the flow into phase 1 whole — country + mobile + language, then the code;
 * no name, no email, and customer *edit* stays out.
 *
 * 🚩 **Language joined the form on 2026-07-29** (owner-stated), the one field 132
 * left out that could not stay out: the door defaults it to Arabic per body, so
 * *not asking* was itself an answer, written onto the member permanently and used
 * for every message they are ever sent. See `signup-view.ts`.
 *
 * 🚩 **Inline in the rail, not a modal**, and that is this ticket's one
 * arrangement decision rather than a preference. The wait between *Send code* and
 * the code arriving is SPOKEN: the caller is holding the line reading digits back.
 * A modal would take the basket away for the length of a conversation the agent
 * is having anyway — and unlike the coupon, whose owner ruling made it a chip
 * off the header row, nothing about a signup is a fact of the ORDER. It belongs
 * to the caller, and the caller has a column.
 *
 * 🚩 **A miss is not a failure and this must not make it look like one.** The
 * rail already says the caller was not found and stops there (165). The signup is
 * offered as the ordinary next thing, in the same block, with no alarm ground.
 *
 * 🚩 **It ends at `attach`, it does not perform it.** The confirm returns the new
 * member and the agent still presses *Attach* — 165's deliberate two steps, which
 * a freshly enrolled caller does not get to skip. Enrolling somebody and putting
 * them on a live order are two acts, and only the second one is about this order.
 */
import { useTranslation } from 'react-i18next'
import type { LoyaltyMember } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { NOTE } from './console-notes'
import {
  canConfirmOtp,
  canSendCode,
  mobilePreview,
  SIGNUP_COUNTRIES,
  SIGNUP_LANGUAGES,
  type SignupState,
} from './signup-view'

export interface SignupActions {
  onChange: (next: SignupState) => void
  onSendCode: () => void
  onConfirm: () => void
  onCancel: () => void
  /** The member the confirm returned, handed to the rail's own attach. */
  onAttach: (member: LoyaltyMember) => void
  sending: boolean
  confirming: boolean
  /** The server's own words. A refused OTP and an unreachable loyalty service are
   *  both business outcomes the agent says out loud, so neither is dressed as a
   *  crash — nor as the other. */
  error: string | null
}

export default function SignupPanel({
  state,
  actions,
  /** True while the rail's attach is in flight. */
  attaching,
}: {
  state: SignupState
  actions: SignupActions
  attaching: boolean
}) {
  const { t } = useTranslation('callcenter')
  const { onChange, onSendCode, onConfirm, onCancel, onAttach, sending, confirming, error } = actions

  if (state.step === 'closed') return null

  const preview = mobilePreview(state.countryCode, state.mobile)
  const busy = sending || confirming

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border bg-card p-2.5" data-cc-signup>
      <div className="text-xs font-semibold">{t('signup.title')}</div>

      {/* ---- step 1: who is calling ------------------------------------- */}
      {state.step === 'details' && (
        <>
          {/* 🚩 STACKED, not a row. The country and the number shared one line
              until this was driven live (2026-07-29) — and a `<select>` is as wide
              as its longest option, so *United Arab Emirates +971* sized the
              control and pushed the MOBILE FIELD off the edge of a 200px rail.
              The agent could see the form and could not type the number into it.

              A row would fit in a modal, which is the case for making this one.
              It is not enough of a case: the wait between *Send code* and the code
              arriving is SPOKEN — the caller is on the line reading digits back —
              and a modal takes the basket away for the length of a conversation
              the agent is having anyway. Stacking costs one line of height. */}
          <div className="space-y-1.5">
            <select
              value={state.countryCode}
              onChange={(e) => onChange({ ...state, countryCode: e.target.value })}
              disabled={busy}
              aria-label={t('signup.country')}
              data-cc-signup-country
              // `w-full` + `min-w-0`: a select's intrinsic width is its longest
              // option, and without both it grows past the rail rather than
              // truncating inside it.
              className="w-full min-w-0 rounded-md border border-input bg-card px-2 py-2 text-sm outline-none focus:border-ring"
            >
              {SIGNUP_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {t(`signup.countryName.${country.code}`)} +{country.diallingCode}
                </option>
              ))}
            </select>
            <input
              value={state.mobile}
              onChange={(e) => onChange({ ...state, mobile: e.target.value })}
              inputMode="tel"
              autoComplete="off"
              disabled={busy}
              aria-label={t('signup.mobile')}
              placeholder={t('signup.mobilePlaceholder')}
              data-numeric
              data-cc-signup-mobile
              className="w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>

          {/* 🚩 THE LANGUAGE THE CALLER WILL BE WRITTEN DOWN AS. Two native
              radios rather than a second dropdown: the set is closed at two, and
              a control that has to be opened to reveal one alternative hides the
              question the agent is meant to ask out loud. CC2 draws the same
              pair, for what is plainly the same reason.

              ⚠️ It is not a nicety. The door defaults `PreferredLanguage` to
              `"A"` per body, so before this control existed every caller enrolled
              here was recorded as Arabic-preferred — and it is what the loyalty
              SMS goes out in, for the life of the membership. */}
          <div
            className="flex items-center gap-3"
            role="radiogroup"
            aria-label={t('signup.language')}
            data-cc-signup-languages
          >
            <span className="text-[11px] text-muted-foreground">{t('signup.language')}</span>
            {SIGNUP_LANGUAGES.map((code) => (
              <label
                key={code}
                className={`flex cursor-pointer items-center gap-1.5 text-xs ${
                  busy ? 'cursor-not-allowed opacity-60' : ''
                }`}
                data-cc-signup-language={code}
                {...(state.language === code ? { 'data-cc-signup-language-chosen': code } : {})}
              >
                <input
                  type="radio"
                  // The rail can hold only one signup at a time, so a fixed group
                  // name is safe and keeps the pair arrow-key navigable for free.
                  name="cc-signup-language"
                  checked={state.language === code}
                  onChange={() => onChange({ ...state, language: code })}
                  disabled={busy}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {t(`signup.languageName.${code}`)}
              </label>
            ))}
          </div>

          {/* 🚩 The number the agent reads back before anything is sent. It is a
              PREVIEW: the wire carries the country code beside what was typed and
              the server builds the enrolled number, so this never becomes a
              second implementation of a rule the loyalty base keys on. */}
          {preview && (
            <p className="text-[11px] text-muted-foreground" data-cc-signup-preview>
              {t('signup.willEnrol')} <Ltr>{preview}</Ltr>
            </p>
          )}

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onSendCode}
              disabled={!canSendCode(state) || busy}
              data-cc-signup-send
              className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {sending ? t('signup.sending') : t('signup.sendCode')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              data-cc-signup-cancel
              className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {t('signup.cancel')}
            </button>
          </div>
        </>
      )}

      {/* ---- step 2: the code, read back down the phone ------------------ */}
      {state.step === 'otp' && (
        <>
          {/* The instruction is the agent's SCRIPT. They are about to say it, so
              it is a sentence and not a field label. */}
          <p className="text-[11px] text-muted-foreground" data-cc-signup-spoken>
            {t('signup.spokenWait')}
          </p>
          <input
            value={state.otp}
            onChange={(e) => onChange({ ...state, otp: e.target.value })}
            inputMode="numeric"
            autoComplete="one-time-code"
            // The agent's hands are free the moment the code is sent and their
            // next keystroke is the code itself.
            autoFocus
            disabled={confirming}
            aria-label={t('signup.otp')}
            placeholder={t('signup.otpPlaceholder')}
            data-numeric
            data-cc-signup-otp
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-ring"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canConfirmOtp(state) || confirming}
              data-cc-signup-confirm
              className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {confirming ? t('signup.confirming') : t('signup.confirm')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              data-cc-signup-cancel
              className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {t('signup.cancel')}
            </button>
          </div>
          {/* 🚩 No resend, and no countdown. CC2 has neither, and a countdown the
              console invented would promise an expiry only the loyalty service
              knows. Cancelling and starting again is the honest retry. */}
        </>
      )}

      {/* ---- created: the same card the lookup draws, and the same attach -- */}
      {state.step === 'created' && state.created && (
        <div data-cc-signup-created>
          <div className="text-sm font-semibold leading-tight">{state.created.fullName}</div>
          <div data-numeric className="text-xs text-muted-foreground">
            <Ltr>{state.created.mobile}</Ltr>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t('signup.createdHint')}</p>
          <button
            type="button"
            onClick={() => onAttach(state.created!)}
            disabled={attaching}
            data-cc-signup-attach
            className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {attaching ? t('rail.attaching') : t('rail.attach')}
          </button>
        </div>
      )}

      {error && (
        <p className={NOTE.danger} data-cc-signup-error>
          {error}
        </p>
      )}
    </div>
  )
}
