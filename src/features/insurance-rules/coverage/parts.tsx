import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react'
import { isError, type GuardIssue } from '@/core/insurance-rules/checks'
import type { CoverageEffect } from '@/core/insurance-rules/coverage-model'
import { saysIn } from '@/core/rules/sentence'
import StatusBadge from '@/core/ui/StatusBadge'
import { payerMark } from './ruleset-edit'

// The Insurers / Categories / Coverage screens' small pieces (oms 617): one control look, the denied card, the
// issues HQ's Validate pinned on a rule, and the payer mark every coverage value carries.

export const CONTROL =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none ' +
  'aria-[invalid=true]:border-danger-border aria-[invalid=true]:bg-danger-050'

/** A bare 403 — "You do not have access", never an empty screen (no probe until 618). */
export function DeniedCard({ hook }: { hook: string }) {
  const { t } = useTranslation('insurance-coverage')
  return (
    <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" {...{ [`data-${hook}`]: '' }}>
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
    </div>
  )
}

export function Loading() {
  const { t } = useTranslation('insurance-coverage')
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {t('loading')}
    </div>
  )
}

export function Select({ invalid, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select {...rest} aria-invalid={invalid || undefined} className={`${CONTROL} ${className}`} />
}

/** A number; an empty box is null when `nullable`, else 0. */
export function NumberInput({
  value,
  onValue,
  nullable = false,
  invalid,
  className = 'w-20',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null
  onValue: (n: number | null) => void
  nullable?: boolean
  invalid?: boolean
}) {
  return (
    <input
      {...rest}
      type="number"
      dir="ltr"
      value={value === null || !Number.isFinite(value) ? '' : value}
      onChange={(e) => onValue(e.target.value === '' ? (nullable ? null : 0) : Number(e.target.value))}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} text-end ${className}`}
    />
  )
}

/** A machine value typed as text (a code, a pattern). */
export function CodeInput({
  value,
  onValue,
  invalid,
  className = 'w-40',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValue: (s: string) => void; invalid?: boolean }) {
  return (
    <input
      {...rest}
      dir="ltr"
      value={value}
      onChange={(e) => onValue(e.target.value)}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} font-mono ${className}`}
    />
  )
}

const parseCodes = (text: string): string[] =>
  text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

/** Codes typed comma-separated: the text is kept as typed, the condition gets the codes. */
export function CodesInput({ value, onCodes, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string[]; onCodes: (c: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  useEffect(() => {
    if (parseCodes(text).join(',') !== value.join(',')) setText(value.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(',')])
  return (
    <CodeInput
      {...rest}
      value={text}
      onValue={(s) => {
        setText(s)
        const codes = parseCodes(s)
        if (codes.join(',') !== value.join(',')) onCodes(codes)
      }}
    />
  )
}

/** A labelled control with its unit after it. */
export function Field({ label, unit, children }: { label: string; unit?: ReactNode; children: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
      {unit && <span>{unit}</span>}
    </label>
  )
}

/** HQ's issues, each in the reader's language, errors first. */
export function Issues({ issues, hook }: { issues: readonly GuardIssue[]; hook?: string }) {
  const { i18n } = useTranslation()
  if (!issues.length) return null
  const sorted = [...issues.filter(isError), ...issues.filter((i) => !isError(i))]
  return (
    <ul className="flex flex-col gap-0.5 text-xs" data-issues={hook ?? ''}>
      {sorted.map((i, k) => (
        <li key={k} className={`flex items-start gap-1 ${isError(i) ? 'text-danger-800' : 'text-attention-800'}`} data-issue={i.severity} data-issue-field={i.field ?? ''}>
          {isError(i) ? <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
          <bdi>{saysIn({ en: i.en, ar: i.ar }, i18n.language)}</bdi>
        </li>
      ))}
    </ul>
  )
}

/** "Fills what the payer left out" or "Overrides the payer" — shown on every coverage value (3146). */
export function PayerMark({ effect }: { effect: Pick<CoverageEffect, 'overridesPayer'> }) {
  const { t } = useTranslation('insurance-coverage')
  const mark = payerMark(effect)
  return (
    <span data-payer-mark={mark} title={t(`payerMark.${mark}Hint`)}>
      <StatusBadge sev={mark === 'overrides' ? 'warn' : 'mute'}>{t(`payerMark.${mark}`)}</StatusBadge>
    </span>
  )
}
