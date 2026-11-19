import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import { miniPosApi, type UaMobileLoginResult } from './api'
import { MINIPOS_API_KEY, type PhoneSession } from './phone-session'
import RefusalBanner from './RefusalBanner'
import { readRefusal, type ShownRefusal } from './refusal'

/**
 * Sign in on the Ua `mobile` channel: username and password, then the authenticator code (spec 4063 story 1). The
 * server answers each step in the body (`success`, `requiresTotp`, `mustChangePassword`), and a failed step is a
 * message, not a throw. The token it mints is what every Mini POS call then carries.
 */
export default function SignInScreen({ onSignedIn }: { onSignedIn: (session: PhoneSession) => void }) {
  const { t } = useTranslation('mini-pos-phone')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null)

  const finish = (r: UaMobileLoginResult) => {
    if (!r.success) {
      setRefusal({ code: r.errorCode, english: r.message || t('app.failed'), arabic: null })
      return
    }
    if (r.mustChangePassword) {
      setRefusal({ code: 'MUST_CHANGE_PASSWORD', english: t('signIn.mustChangePassword'), arabic: null })
      return
    }
    if (r.requiresTotp && r.challengeId) {
      setChallengeId(r.challengeId)
      return
    }
    if (r.token) onSignedIn({ token: r.token, userId: r.userId ?? userId, displayName: r.displayName, expiresAt: r.expiresAt })
  }

  const login = useMutation({
    mutationFn: () => miniPosApi.login(userId.trim(), password),
    onMutate: () => setRefusal(null),
    onSuccess: finish,
    onError: (err) => setRefusal(readRefusal(err, t('app.failed'))),
  })
  const verify = useMutation({
    mutationFn: () => miniPosApi.verifyTotp(challengeId!, totp.trim()),
    onMutate: () => setRefusal(null),
    onSuccess: finish,
    onError: (err) => setRefusal(readRefusal(err, t('app.failed'))),
  })
  const busy = login.isPending || verify.isPending

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (challengeId) verify.mutate()
    else login.mutate()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{challengeId ? t('signIn.totpTitle') : t('signIn.title')}</h1>
      {!MINIPOS_API_KEY && (
        <RefusalBanner refusal={{ code: 'NO_CHANNEL_KEY', english: t('signIn.notConfigured'), arabic: null }} />
      )}
      {challengeId ? (
        <>
          <p className="text-sm text-muted-foreground">{t('signIn.totpHint')}</p>
          <Field label={t('signIn.totpCode')}>
            <Input
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              dir="ltr"
              className="h-11 font-mono text-lg"
              autoFocus
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t('signIn.userId')}>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} autoComplete="username" dir="ltr" className="h-11" />
          </Field>
          <Field label={t('signIn.password')}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11"
            />
          </Field>
        </>
      )}
      {refusal && <RefusalBanner refusal={refusal} />}
      <Button
        type="submit"
        className="h-12 w-full text-base justify-center"
        disabled={busy || (challengeId ? totp.trim().length < 6 : !userId.trim() || !password)}
      >
        {busy ? t('app.working') : challengeId ? t('signIn.verify') : t('signIn.submit')}
      </Button>
    </form>
  )
}
