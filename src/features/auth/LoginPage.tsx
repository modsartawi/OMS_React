import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import QRCode from 'react-qr-code'
import { Eye, EyeOff } from 'lucide-react'
import { ApiError, apiErrorMessage } from '@/core/api'
import { useSession } from '@/core/session'
import logoUrl from '@/assets/login/dmsco-logo.svg'
import backgroundUrl from '@/assets/login/login-background.webp'
import photoUrl from '@/assets/login/login-photo.webp'
import arrowUrl from '@/assets/login/next-arrow.svg'
import { authApi } from './api'

// Post-login lands on the BackOffice home (map 478), not a specific module.
const DEFAULT_LANDING = '/'

// The one error code that means the in-flight challenge is gone (expired, spent,
// or attempt-capped): the two-step flow must restart from the password step.
const CHALLENGE_INVALID = 'UAAUTH-90070'

// Step-1 steers: the login itself walks the user into the right self-service
// journey rather than showing a dead-end error (owner: offered, not hidden).
// NoCredential — active employee, no password yet (the 368/376 cutover seed):
// straight into set-password. NotEnrolled — valid password but no authenticator
// (day one): straight into QR activation.
const NO_CREDENTIAL = 'UAAUTH-90090'
const NOT_ENROLLED = 'UAAUTH-90060'

// A reset session that is gone (expired, spent, or attempt-capped): the otp /
// set-password steps drop back to the password step with the server's message.
const RESET_SESSION_INVALID = 'UAAUTH-90210'

/** Accept only same-app returnUrls; off-site values fall back to the default. */
function resolveReturnUrl(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return DEFAULT_LANDING
}

/**
 * The Base32 secret out of the otpauth URI, for the manual-entry fallback —
 * mirrors the server's UaOtpAuthUri.SecretOf: find `secret=`, cut at `&`,
 * degrade to the whole string on a malformed URI. Always shown, so a QR render
 * failure still enrolls (graceful degrade, like POS).
 */
function secretFromOtpauth(uri: string): string {
  const marker = 'secret='
  const start = uri.indexOf(marker)
  if (start === -1) return uri
  const rest = uri.slice(start + marker.length)
  const amp = rest.indexOf('&')
  return amp === -1 ? rest : rest.slice(0, amp)
}

type Step = 'password' | 'change' | 'totp' | 'otp' | 'setPassword' | 'activateQr'

// Which journey the shared `otp` step is serving — mirrors the server verify,
// which is shared too (the purpose is stamped at the request step).
type Flow = 'reset' | 'activate'

/** The greeting above the card follows the local clock. */
function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

// The DMSCO sign-in theme (Figma Login_Filled data, 84:4419): pill fields and
// buttons on a frosted card. Every colour is a fixed `--login-*` token.
const titleClass = 'text-[40px] font-bold leading-none text-login-ink'

const subtitleClass = 'mt-4 mb-10 text-[15px] text-login-body'

const labelClass = 'mb-2 block text-[15px] text-login-label'

const inputClass =
  'h-11 w-full rounded-full border border-login-field-border bg-login-field px-4 text-[15px] text-login-field-ink outline-none focus:border-login-field-focus'

const hintClass = 'mb-6 ps-4 text-[13px] text-login-label'

const submitClass =
  'relative flex h-[52px] w-full items-center justify-center rounded-full bg-login-cta px-8 text-[17px] font-bold text-login-cta-foreground hover:bg-login-cta/90 disabled:opacity-50'

const backClass =
  'mt-3 h-11 w-full rounded-full text-[15px] font-bold text-login-ink hover:bg-login-field/50'

const linkClass =
  'mt-8 block text-start text-[15px] font-bold text-login-ink underline decoration-1 underline-offset-4 hover:decoration-2 disabled:opacity-50'

/** The primary button's label, with the design's long arrow at the reading end. */
function SubmitLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* The arrow points along the reading direction, so it mirrors in RTL. */}
      <img
        src={arrowUrl}
        width={38}
        height={16}
        alt=""
        className="pointer-events-none absolute end-4 rtl:-scale-x-100"
      />
    </>
  )
}

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const setSession = useSession((s) => s.setSession)

  const [step, setStep] = useState<Step>('password')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('') // also the "current password" for the change step
  const [challengeId, setChallengeId] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Self-service (reset / activation) state: the reset id from the request step,
  // and which journey the shared otp step is driving.
  const [resetId, setResetId] = useState('')
  const [flow, setFlow] = useState<Flow>('reset')
  const [otpCode, setOtpCode] = useState('')
  // The otpauth URI the activation step renders as a QR (issue 477).
  const [qrCodeUri, setQrCodeUri] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [greeting] = useState(() => greetingKey(new Date().getHours()))

  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Captured once, pre-strip, so stripping ?reason doesn't lose it.
  const [returnUrl] = useState(() => resolveReturnUrl(params.get('returnUrl')))

  useEffect(() => {
    if (params.get('reason') === 'expired') {
      setSessionExpired(true)
      const next = new URLSearchParams(params)
      next.delete('reason')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Session established (cookie set server-side) — hydrate the mirror and go in. */
  function completeLogin(result: { userId: string | null; displayName: string | null }) {
    setSession({ userId: result.userId, displayName: result.displayName })
    navigate(returnUrl, { replace: true })
  }

  /** Any business failure surfaces inline; a dead challenge drops back to step 1. */
  function handleStepFailure(code: string | null, message: string | null) {
    if (code === CHALLENGE_INVALID) {
      resetToPassword(message)
      return
    }
    setErrorMessage(message)
  }

  function resetToPassword(message: string | null) {
    setStep('password')
    setChallengeId('')
    setTotpCode('')
    setNewPassword('')
    setConfirmPassword('')
    setResetId('')
    setOtpCode('')
    setQrCodeUri('')
    setShowPassword(false)
    setErrorMessage(message)
  }

  /** Transport/server/network errors (not the 200 business branch) → toast. */
  function reportUnexpected(err: unknown) {
    if (err instanceof ApiError && err.kind === 'business') {
      setErrorMessage(err.message)
    } else {
      toast.error(t('loginFailed'), { description: apiErrorMessage(err, t('loginFailed')) })
    }
  }

  /**
   * The shared login attempt — from the password form and from the auto re-login
   * after a self-service journey completes. Branches on the server flags; a
   * NoCredential steer launches set-password itself (no button to press).
   */
  async function runLogin(pw: string) {
    const result = await authApi.uaLogin(userId.trim(), pw)
    if (!result.success) {
      // Steer: an active employee with no password is walked into first-set,
      // not shown "wrong password". The SMS is sent by the request step.
      if (result.errorCode === NO_CREDENTIAL) {
        await startPasswordReset()
        return
      }
      // Steer: a valid password but no authenticator (day one) is walked straight
      // into QR activation rather than a dead-end error.
      if (result.errorCode === NOT_ENROLLED) {
        await startTotpReenroll()
        return
      }
      resetToPassword(result.message)
      return
    }
    if (!result.requiresTotp) {
      // Session-aware step 1 (issue 370): the cookie is already set.
      completeLogin(result)
      return
    }
    if (!result.challengeId) {
      // requiresTotp with no challenge is a contract violation — fail safe.
      setErrorMessage(result.message ?? t('loginFailed'))
      return
    }
    setChallengeId(result.challengeId)
    setStep(result.mustChangePassword ? 'change' : 'totp')
  }

  /**
   * Launch the reset / first-set journey: request an OTP to the registered phone
   * and land on the shared `otp` step. Used by both the "Forgot password?" link
   * and the NoCredential auto-steer. Always HTTP 200 — an unknown / phone-less
   * employee still reaches `otp` (anti-enum decoy), which is why the step carries
   * the "Contact HQ" line.
   */
  async function startPasswordReset() {
    const id = userId.trim()
    if (id === '') {
      setErrorMessage(t('enterUserIdFirst'))
      return
    }
    const result = await authApi.uaRequestPasswordReset(id)
    if (!result.success) {
      // Only validation / throttle fail here — stay put with the message.
      setErrorMessage(result.message)
      return
    }
    setFlow('reset')
    setResetId(result.resetId ?? '')
    setOtpCode('')
    setNewPassword('')
    setConfirmPassword('')
    setErrorMessage(null)
    setStep('otp')
  }

  /**
   * Launch the TOTP activation / re-enroll journey: request an OTP to the
   * registered phone and land on the shared `otp` step with the activate flag.
   * Used by both the "Lost your authenticator?" link and the NotEnrolled
   * auto-steer. Anti-enum like the reset request — always reaches `otp`.
   */
  async function startTotpReenroll() {
    const id = userId.trim()
    if (id === '') {
      setErrorMessage(t('enterUserIdFirst'))
      return
    }
    const result = await authApi.uaRequestTotpReenroll(id)
    if (!result.success) {
      // Only validation / throttle fail here — stay put with the message.
      setErrorMessage(result.message)
      return
    }
    setFlow('activate')
    setResetId(result.resetId ?? '')
    setOtpCode('')
    setQrCodeUri('')
    setErrorMessage(null)
    setStep('otp')
  }

  /** Re-enroll terminal — swap the secret and land on the QR step. */
  async function runReenroll() {
    const result = await authApi.uaReenrollTotp(resetId)
    if (!result.success) {
      // An expired / spent proof cannot be retried — start over.
      if (result.errorCode === RESET_SESSION_INVALID) {
        resetToPassword(result.message)
        return
      }
      setErrorMessage(result.message)
      return
    }
    setResetId('') // spent
    setQrCodeUri(result.qrCodeUri ?? '')
    setStep('activateQr')
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || userId.trim() === '' || password === '') return
    setBusy(true)
    setErrorMessage(null)
    try {
      await runLogin(password)
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  async function onForgotPassword() {
    if (busy) return
    setBusy(true)
    setErrorMessage(null)
    try {
      await startPasswordReset()
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  async function onChangeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || newPassword === '' || confirmPassword === '') return
    if (newPassword !== confirmPassword) {
      setErrorMessage(t('passwordMismatch'))
      return
    }
    setBusy(true)
    setErrorMessage(null)
    try {
      // Old password is the temporary one already entered at step 1.
      const result = await authApi.uaChangePassword(challengeId, password, newPassword)
      if (!result.success) {
        handleStepFailure(result.errorCode, result.message)
        return
      }
      // Password replaced — carry the new one forward and go to the TOTP step.
      setPassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setStep('totp')
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  async function onTotpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || totpCode.trim() === '') return
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await authApi.uaVerifyTotp(challengeId, totpCode.trim())
      if (!result.success) {
        handleStepFailure(result.errorCode, result.message)
        return
      }
      completeLogin(result)
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  /** Shared OTP step — verify the SMS code, then branch by journey. */
  async function onOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || otpCode.trim() === '') return
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await authApi.uaVerifyResetOtp(resetId, otpCode.trim())
      if (!result.success) {
        // An expired / spent reset session cannot be retried — start over.
        if (result.errorCode === RESET_SESSION_INVALID) {
          resetToPassword(result.message)
          return
        }
        // Wrong code / throttle: stay on the step with the inline message.
        setErrorMessage(result.message)
        return
      }
      // Verified — branch by journey: activation swaps the secret and shows the
      // QR; reset chooses a new password.
      setOtpCode('')
      if (flow === 'activate') {
        await runReenroll()
      } else {
        setStep('setPassword')
      }
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  /**
   * "I've added it" — the operator scanned the QR (or keyed the secret) into a
   * fresh authenticator. NotEnrolled short-circuited before a challenge was
   * issued, so re-run the login with the retained password to get a fresh one
   * and land on the normal TOTP code step — no retype.
   */
  async function onActivateAdded() {
    if (busy) return
    setBusy(true)
    setErrorMessage(null)
    try {
      setQrCodeUri('')
      await runLogin(password)
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  async function onLostAuthenticator() {
    if (busy) return
    setBusy(true)
    setErrorMessage(null)
    try {
      await startTotpReenroll()
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  /** Terminal of the reset journey — set the credential, then auto re-login. */
  async function onSetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || newPassword === '' || confirmPassword === '') return
    if (newPassword !== confirmPassword) {
      setErrorMessage(t('passwordMismatch'))
      return
    }
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await authApi.uaSetPassword(resetId, newPassword)
      if (!result.success) {
        // Expired session → start over; policy violation / anything else → inline.
        if (result.errorCode === RESET_SESSION_INVALID) {
          resetToPassword(result.message)
          return
        }
        setErrorMessage(result.message)
        return
      }
      // Credential set — retain the chosen password and re-run the login with it
      // so the user isn't asked to retype it (continues to TOTP / activation).
      const pw = newPassword
      setPassword(pw)
      setNewPassword('')
      setConfirmPassword('')
      setResetId('')
      await runLogin(pw)
    } catch (err) {
      reportUnexpected(err)
    } finally {
      setBusy(false)
    }
  }

  function goBackToPassword() {
    resetToPassword(null)
  }

  const otpSubtitle = flow === 'activate' ? t('otpSubtitleActivate') : t('otpSubtitleReset')

  return (
    // The DMSCO sign-in theme: a frosted card over the photographic ground. The
    // page is a fixed brand surface in both themes, so the focus ring is the
    // login ink here rather than the app's (gold in dark) `--ring`.
    // Short windows (584, ticket 605): below 912px tall the page's block padding drops to
    // 1rem and the card's 776px minimum yields to the window, so a 744px window no longer scrolls.
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-login-ground bg-cover bg-center p-4 [--ring:var(--login-ink)] lg:p-10 [@media(min-width:64rem)_and_(max-height:57rem)]:py-4"
      style={{ backgroundImage: `url(${backgroundUrl})` }}
    >
      {/* Decorative (20% white on the ground), so it stays out of the a11y tree. */}
      <p
        aria-hidden="true"
        className="mb-6 hidden w-full max-w-[1142px] text-[32px] font-bold leading-none text-login-greeting lg:block"
      >
        {t(`greeting.${greeting}`)}
      </p>

      <div className="grid w-full max-w-[1142px] gap-6 rounded-[32px] bg-login-glass/70 p-6 backdrop-blur-xl lg:min-h-[min(776px,calc(100dvh-5.5rem))] lg:grid-cols-[minmax(0,1fr)_656px]">
      {/* ===== Sign-in column ===== */}
      <div className="flex flex-col px-2 py-2 lg:ps-4 lg:pe-0 lg:py-4">
        <img src={logoUrl} width={262} height={140} alt={t('logoAlt')} className="max-w-full" />

        <div className="mt-12 w-full max-w-[382px] lg:mt-auto">
        {sessionExpired && step === 'password' && (
          <div className="mb-6 rounded-2xl border border-login-field-border bg-login-field px-4 py-2 text-sm text-login-field-ink">
            {t('sessionExpired')}
          </div>
        )}
        {errorMessage && (
          <div
            aria-live="polite"
            className="mb-6 rounded-2xl border border-danger-border bg-danger-050 px-4 py-2 text-sm text-danger-800"
          >
            {errorMessage}
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={onPasswordSubmit}>
            <h1 className={titleClass}>{t('welcomeTitle')}</h1>
            <p className={subtitleClass}>{t('welcomeSubtitle')}</p>

            <label className={labelClass} htmlFor="userId">
              {t('userId')}
            </label>
            <input
              id="userId"
              autoFocus
              autoComplete="username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={`mb-6 ${inputClass}`}
            />
            <label className={labelClass} htmlFor="password">
              {t('password')}
            </label>
            <div className="relative mb-6">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`pe-12 ${inputClass}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                aria-pressed={showPassword}
                className="absolute end-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-login-chip text-login-cta"
              >
                {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={busy || userId.trim() === '' || password === ''}
              className={submitClass}
            >
              <SubmitLabel>{busy ? t('signingIn') : t('signIn')}</SubmitLabel>
            </button>
            <button type="button" onClick={onForgotPassword} disabled={busy} className={linkClass}>
              {t('forgotPassword')}
            </button>
          </form>
        )}

        {step === 'change' && (
          <form onSubmit={onChangeSubmit}>
            <h1 className={titleClass}>{t('changeTitle')}</h1>
            <p className={subtitleClass}>{t('changeSubtitle')}</p>

            <label className={labelClass}htmlFor="newPassword">
              {t('newPassword')}
            </label>
            <input
              id="newPassword"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`mb-6 ${inputClass}`}
            />
            <label className={labelClass}htmlFor="confirmPassword">
              {t('confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`mb-6 ${inputClass}`}
            />
            <button
              type="submit"
              disabled={busy || newPassword === '' || confirmPassword === ''}
              className={submitClass}
            >
              <SubmitLabel>{busy ? t('settingPassword') : t('setPassword')}</SubmitLabel>
            </button>
            <button type="button" onClick={goBackToPassword} className={backClass}>
              {t('back')}
            </button>
          </form>
        )}

        {step === 'totp' && (
          <form onSubmit={onTotpSubmit}>
            <h1 className={titleClass}>{t('totpTitle')}</h1>
            <p className={subtitleClass}>{t('totpSubtitle')}</p>

            <label className={labelClass}htmlFor="totpCode">
              {t('totpCode')}
            </label>
            <input
              id="totpCode"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className={`mb-6 ${inputClass}`}
            />
            <button
              type="submit"
              disabled={busy || totpCode.trim() === ''}
              className={submitClass}
            >
              <SubmitLabel>{busy ? t('verifying') : t('verify')}</SubmitLabel>
            </button>
            <button type="button" onClick={goBackToPassword} className={backClass}>
              {t('back')}
            </button>
            <button
              type="button"
              onClick={onLostAuthenticator}
              disabled={busy}
              className={linkClass}
            >
              {t('lostAuthenticator')}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={onOtpSubmit}>
            <h1 className={titleClass}>{t('otpTitle')}</h1>
            <p className={subtitleClass}>{otpSubtitle}</p>

            <label className={labelClass}htmlFor="otpCode">
              {t('otpCode')}
            </label>
            <input
              id="otpCode"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className={`mb-2 ${inputClass}`}
            />
            <p className={hintClass}>{t('otpNoCode')}</p>
            <button type="submit" disabled={busy || otpCode.trim() === ''} className={submitClass}>
              <SubmitLabel>{busy ? t('verifying') : t('verify')}</SubmitLabel>
            </button>
            <button type="button" onClick={goBackToPassword} className={backClass}>
              {t('back')}
            </button>
          </form>
        )}

        {step === 'setPassword' && (
          <form onSubmit={onSetPasswordSubmit}>
            <h1 className={titleClass}>{t('setPwTitle')}</h1>
            <p className={subtitleClass}>{t('setPwSubtitle')}</p>

            <label className={labelClass}htmlFor="setPwNew">
              {t('newPassword')}
            </label>
            <input
              id="setPwNew"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`mb-6 ${inputClass}`}
            />
            <label className={labelClass}htmlFor="setPwConfirm">
              {t('confirmPassword')}
            </label>
            <input
              id="setPwConfirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`mb-6 ${inputClass}`}
            />
            <button
              type="submit"
              disabled={busy || newPassword === '' || confirmPassword === ''}
              className={submitClass}
            >
              <SubmitLabel>{busy ? t('settingPassword') : t('setPassword')}</SubmitLabel>
            </button>
            <button type="button" onClick={goBackToPassword} className={backClass}>
              {t('back')}
            </button>
          </form>
        )}

        {step === 'activateQr' && (
          <div>
            <h1 className={titleClass}>{t('activateTitle')}</h1>
            <p className={subtitleClass}>{t('activateScanHint')}</p>

            {/* Inline SVG QR — no external image service, no canvas, CSP-safe. */}
            <div className="mb-4 flex justify-center">
              <div className="rounded-lg bg-white p-3">
                <QRCode value={qrCodeUri} level="Q" size={184} />
              </div>
            </div>

            {/* Base32 fallback — always shown, so a render failure still enrolls. */}
            <p className={labelClass}>{t('activateCantScan')}</p>
            <p className="mb-6 break-all rounded-2xl border border-login-field-border bg-login-field px-4 py-2 font-mono text-sm text-login-field-ink">
              {secretFromOtpauth(qrCodeUri)}
            </p>

            <button
              type="button"
              onClick={onActivateAdded}
              disabled={busy}
              className={submitClass}
            >
              <SubmitLabel>{busy ? t('signingIn') : t('activateAdded')}</SubmitLabel>
            </button>
            <button type="button" onClick={goBackToPassword} disabled={busy} className={backClass}>
              {t('back')}
            </button>
          </div>
        )}
        </div>
      </div>

      {/* ===== Photo panel — desktop only. The object position keeps the
          design's crop (the counter scene) as the panel's height follows the
          column. ===== */}
      <div className="relative hidden overflow-hidden rounded-[26px] border border-login-photo-border lg:block">
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 size-full object-cover object-[44%_0%]"
        />
        <div className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-2 px-6 text-center">
          <p className="text-[48px] font-bold leading-none text-login-gold">
            {t('common:brandName')}
          </p>
          <p className="text-[28px] leading-9 text-login-cta-foreground">{t('brandPanel.tagline')}</p>
        </div>
      </div>
      </div>
    </div>
  )
}
