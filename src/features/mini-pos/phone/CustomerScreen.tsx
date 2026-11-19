import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Search, UserPlus, UserRound } from 'lucide-react'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import Ltr from '@/core/ui/Ltr'
import { newRequestId } from '@/core/engine-session/request-id'
import type { LoyaltyMember } from '@/core/models/callcenter'
import { miniPosApi } from './api'
import { isNoConnection, SIGNUP_COUNTRIES } from './flow'
import NoConnection from './NoConnection'
import RefusalBanner from './RefusalBanner'
import ScannerView from './ScannerView'
import { readRefusal, type ShownRefusal } from './refusal'
import { MEMBER_CODE_FORMATS, type ScanRead } from './scanner'

interface SignUpCapture {
  mobile: string
  countryCode: string
  preferredLanguage: string
}

type Step =
  | { kind: 'find' }
  /** The server answered "not a member" for this mobile: offer the sign-up. */
  | { kind: 'notMember'; mobile: string }
  /** The sign-up code was sent to this mobile: the customer reads it back. */
  | ({ kind: 'codeSent' } & SignUpCapture)

/**
 * The customer step (spec 4063, oms 917; BackOffice 4070): before the basket, the promoter finds the loyalty member by
 * mobile or by the Arbahi app's QR, or signs a new mobile up with the code the customer receives. Each answer is the
 * server's: a mobile is a member or not because the server says so, and the member found goes up to be attached
 * (`onMember`). The server refuses pricing until one is attached, so nothing here can be skipped.
 *
 * The Arbahi code is single use and lives 120 seconds: the lookup burns it, so a refused or abandoned attach needs the
 * customer to show a fresh code (the hint says so).
 */
export default function CustomerScreen({
  attaching,
  refusal,
  noConnection,
  found,
  onMember,
  onAbandon,
}: {
  /** The attach of a found member is in flight (the basket verb). */
  attaching: boolean
  /** The attach's refusal, if it was refused. */
  refusal: ShownRefusal | null
  /** The last basket call never reached the server. */
  noConnection: boolean
  /** The member last found, while the session still has no customer: its attach is in flight, or failed and can be
   *  tried again without a new lookup (an Arbahi code is burnt by its lookup). */
  found: LoyaltyMember | null
  onMember: (member: LoyaltyMember) => void
  onAbandon: () => void
}) {
  const { t } = useTranslation('mini-pos-phone')
  const [step, setStep] = useState<Step>({ kind: 'find' })
  const [mobile, setMobile] = useState('')
  const [country, setCountry] = useState<string>(SIGNUP_COUNTRIES[0])
  const [language, setLanguage] = useState('')
  const [otp, setOtp] = useState('')
  const [problem, setProblem] = useState<unknown>(null)
  // One sign-up send (or confirm) is one action: a retry after a lost connection re-sends the same id.
  const sendId = useRef<string | null>(null)
  const confirmId = useRef<string | null>(null)

  const byMobile = useMutation({
    mutationFn: (typed: string) => miniPosApi.memberByMobile(typed),
    onMutate: () => setProblem(null),
    onSuccess: (member, typed) => (member ? onMember(member) : setStep({ kind: 'notMember', mobile: typed })),
    onError: setProblem,
  })

  const byScan = useMutation({
    mutationFn: (code: string) => miniPosApi.memberByScanCode(code),
    onMutate: () => setProblem(null),
    onSuccess: onMember,
    onError: setProblem,
  })

  const signUp = useMutation({
    mutationFn: (capture: SignUpCapture) => miniPosApi.signUp((sendId.current ??= newRequestId()), capture),
    onMutate: () => setProblem(null),
    onSuccess: (_answer, capture) => {
      sendId.current = null
      confirmId.current = null
      setOtp('')
      setStep({ kind: 'codeSent', ...capture })
    },
    onError: (err) => {
      if (!isNoConnection(err)) sendId.current = null
      setProblem(err)
    },
  })

  const confirm = useMutation({
    mutationFn: (capture: SignUpCapture & { otp: string }) =>
      miniPosApi.confirmSignUp((confirmId.current ??= newRequestId()), capture),
    onMutate: () => setProblem(null),
    onSuccess: (member) => {
      confirmId.current = null
      onMember(member)
    },
    onError: (err) => {
      if (!isNoConnection(err)) confirmId.current = null
      setProblem(err)
    },
  })

  const busy = attaching || byMobile.isPending || byScan.isPending || signUp.isPending || confirm.isPending
  const shown = problem && !isNoConnection(problem) ? readRefusal(problem, t('app.failed')) : refusal
  const offline = noConnection || (!!problem && isNoConnection(problem))

  const find = () => {
    const typed = mobile.trim()
    if (typed && !busy) byMobile.mutate(typed)
  }
  const onQr = (read: ScanRead) => {
    if (!busy) byScan.mutate(read.value.trim())
  }
  const capture = (s: SignUpCapture): SignUpCapture => ({
    mobile: s.mobile,
    countryCode: s.countryCode,
    preferredLanguage: s.preferredLanguage,
  })

  return (
    <div className="flex flex-col gap-4" data-screen="customer">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <UserRound className="size-5" aria-hidden />
        {t('customer.title')}
      </h1>

      {offline && <NoConnection />}
      {shown && <RefusalBanner refusal={shown} />}

      {found && (
        <div data-found={found.loyId} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <bdi className="font-medium">{found.fullName}</bdi>
            <Ltr>{found.mobile}</Ltr>
          </div>
          {found.tier && (
            <span className="text-xs text-muted-foreground">
              {t('basket.tier')} <bdi>{found.tier}</bdi>
            </span>
          )}
          <Button className="h-11 w-full justify-center" disabled={busy} onClick={() => onMember(found)}>
            {attaching ? t('customer.attaching') : t('customer.attach')}
          </Button>
        </div>
      )}

      {step.kind === 'find' && (
        <>
          <p className="text-sm text-muted-foreground">{t('customer.hint')}</p>
          <div className="flex items-end gap-2">
            <Field label={t('customer.mobile')} className="flex-1">
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    find()
                  }
                }}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                enterKeyHint="search"
                dir="ltr"
                className="h-11 font-mono"
              />
            </Field>
            <Button variant="secondary" className="h-11" disabled={busy || !mobile.trim()} onClick={find}>
              <Search className="size-4" aria-hidden />
              {t('customer.find')}
            </Button>
          </div>
          <p className="text-sm font-medium">{t('customer.scanTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('customer.scanHint')}</p>
          <ScannerView formats={MEMBER_CODE_FORMATS} onRead={onQr} paused={busy} />
        </>
      )}

      {step.kind === 'notMember' && (
        <div className="flex flex-col gap-3" data-step="not-member">
          <p className="text-sm">
            {t('customer.notMember')} <Ltr>{step.mobile}</Ltr>
          </p>
          <Field label={t('customer.country')}>
            <Select value={country} onChange={(e) => setCountry(e.target.value)} className="h-11">
              {SIGNUP_COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {t(`customer.countries.${code}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('customer.language')}>
            <Select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-11">
              <option value="">{t('customer.languageChoose')}</option>
              <option value="A">{t('customer.languageArabic')}</option>
              <option value="E">{t('customer.languageEnglish')}</option>
            </Select>
          </Field>
          <Button
            className="h-12 w-full justify-center"
            disabled={busy || !language}
            onClick={() => signUp.mutate({ mobile: step.mobile, countryCode: country, preferredLanguage: language })}
          >
            <UserPlus className="size-4" aria-hidden />
            {signUp.isPending ? t('app.working') : t('customer.sendCode')}
          </Button>
          <Button variant="outlined" className="h-11 w-full justify-center" disabled={busy} onClick={() => setStep({ kind: 'find' })}>
            {t('customer.back')}
          </Button>
        </div>
      )}

      {step.kind === 'codeSent' && (
        <div className="flex flex-col gap-3" data-step="code-sent">
          <p className="text-sm">
            {t('customer.codeSent')} <Ltr>{step.mobile}</Ltr>
          </p>
          <Field label={t('customer.code')}>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              className="h-11 font-mono"
            />
          </Field>
          <Button
            className="h-12 w-full justify-center"
            disabled={busy || !otp.trim()}
            onClick={() => confirm.mutate({ ...capture(step), otp: otp.trim() })}
          >
            {confirm.isPending ? t('app.working') : t('customer.confirm')}
          </Button>
          <Button variant="outlined" className="h-11 w-full justify-center" disabled={busy} onClick={() => signUp.mutate(capture(step))}>
            {t('customer.resend')}
          </Button>
        </div>
      )}

      <Button variant="text" className="h-10 w-full justify-center" disabled={busy} onClick={onAbandon}>
        {t('basket.abandon')}
      </Button>
    </div>
  )
}
