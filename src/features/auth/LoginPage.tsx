import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError, apiErrorMessage } from '@/core/api'
import { useSession } from '@/core/session'
import { authApi } from './api'

const DEFAULT_LANDING = '/oms/deliveries'

// The one error code that means the in-flight challenge is gone (expired, spent,
// or attempt-capped): the two-step flow must restart from the password step.
const CHALLENGE_INVALID = 'UAAUTH-90070'

/** Accept only same-app returnUrls; off-site values fall back to the default. */
function resolveReturnUrl(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return DEFAULT_LANDING
}

type Step = 'password' | 'change' | 'totp'

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

const submitClass =
  'w-full rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50'

const backClass =
  'mt-2 w-full rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted'

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

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || userId.trim() === '' || password === '') return
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await authApi.uaLogin(userId.trim(), password)
      if (!result.success) {
        setErrorMessage(result.message)
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

  function goBackToPassword() {
    resetToPassword(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        {/* Brand moment: the wordmark, small and bold, with the accent full stop. */}
        <p className="mb-5 text-sm font-semibold tracking-tight">
          {t('common:brand')}
          <span className="text-sidebar-active">.</span>
        </p>
        {sessionExpired && step === 'password' && (
          <div className="mb-3 rounded-md border border-border bg-muted px-3 py-2 text-sm">
            {t('sessionExpired')}
          </div>
        )}
        {errorMessage && (
          <div
            aria-live="polite"
            className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={onPasswordSubmit}>
            <h1 className="mb-4 text-base font-semibold tracking-tight">{t('title')}</h1>

            <label className="mb-1 block text-sm font-medium" htmlFor="userId">
              {t('userId')}
            </label>
            <input
              id="userId"
              autoFocus
              autoComplete="username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={`mb-3 ${inputClass}`}
            />
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mb-4 ${inputClass}`}
            />
            <button
              type="submit"
              disabled={busy || userId.trim() === '' || password === ''}
              className={submitClass}
            >
              {busy ? t('signingIn') : t('signIn')}
            </button>
          </form>
        )}

        {step === 'change' && (
          <form onSubmit={onChangeSubmit}>
            <h1 className="text-base font-semibold tracking-tight">{t('changeTitle')}</h1>
            <p className="mb-4 text-sm text-muted-foreground">{t('changeSubtitle')}</p>

            <label className="mb-1 block text-sm font-medium" htmlFor="newPassword">
              {t('newPassword')}
            </label>
            <input
              id="newPassword"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`mb-3 ${inputClass}`}
            />
            <label className="mb-1 block text-sm font-medium" htmlFor="confirmPassword">
              {t('confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`mb-4 ${inputClass}`}
            />
            <button
              type="submit"
              disabled={busy || newPassword === '' || confirmPassword === ''}
              className={submitClass}
            >
              {busy ? t('settingPassword') : t('setPassword')}
            </button>
            <button
              type="button"
              onClick={goBackToPassword}
              className={backClass}
            >
              {t('back')}
            </button>
          </form>
        )}

        {step === 'totp' && (
          <form onSubmit={onTotpSubmit}>
            <h1 className="text-base font-semibold tracking-tight">{t('totpTitle')}</h1>
            <p className="mb-4 text-sm text-muted-foreground">{t('totpSubtitle')}</p>

            <label className="mb-1 block text-sm font-medium" htmlFor="totpCode">
              {t('totpCode')}
            </label>
            <input
              id="totpCode"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className={`mb-4 ${inputClass}`}
            />
            <button
              type="submit"
              disabled={busy || totpCode.trim() === ''}
              className={submitClass}
            >
              {busy ? t('verifying') : t('verify')}
            </button>
            <button
              type="button"
              onClick={goBackToPassword}
              className={backClass}
            >
              {t('back')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
