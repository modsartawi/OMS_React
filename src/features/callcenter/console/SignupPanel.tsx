/**
 * PROTOTYPE (wayfinder ticket 159) — *this caller isn't in the system.*
 *
 * CC2's two-step loyalty OTP signup, drawn where the console actually needs it:
 * under a lookup that found nobody. [132](.issues/132-header-capture-inventory.md)
 * ruled the flow into phase 1 whole — country + mobile, then the code; no name,
 * no email, and customer *edit* stays out.
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
          <div className="flex gap-1.5">
            <select
              value={state.countryCode}
              onChange={(e) => onChange({ ...state, countryCode: e.target.value })}
              disabled={busy}
              aria-label={t('signup.country')}
              data-cc-signup-country
              className="rounded-md border border-input bg-card px-2 py-2 text-sm outline-none focus:border-ring"
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
              className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
            />
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
