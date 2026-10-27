import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, TriangleAlert } from 'lucide-react'
import { saysIn } from '@/core/rules/sentence'
import { isError, type GuardIssue } from './checks'

// The rule editors' small controls (the guard editor, 608, and the coverage rulesets, 617): one look for every
// field, a labelled field with its unit, and the issues HQ's Validate pinned on a block or a field.

export const CONTROL =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none ' +
  'aria-[invalid=true]:border-danger-border aria-[invalid=true]:bg-danger-050'

/** A labelled control, its unit after it. */
export function Field({ label, unit, children, hook }: { label: string; unit?: ReactNode; children: ReactNode; hook?: string }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-field={hook}>
      <span>{label}</span>
      {children}
      {unit && <span>{unit}</span>}
    </label>
  )
}

export function Select({ invalid, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select {...rest} aria-invalid={invalid || undefined} className={`${CONTROL} ${className}`} />
}

type NumberValue =
  | { value: number; onValue: (n: number) => void; nullable?: false }
  | { value: number | null; onValue: (n: number | null) => void; nullable: true }

/** A number typed with its unit; an empty box is null when `nullable`, else 0 (HQ's Validate names a value it refuses). */
export function NumberInput({
  value,
  onValue,
  nullable = false,
  invalid,
  className = 'w-20',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & NumberValue & { invalid?: boolean }) {
  const emit = onValue as (n: number | null) => void
  return (
    <input
      {...rest}
      type="number"
      dir="ltr"
      value={value === null || !Number.isFinite(value) ? '' : value}
      onChange={(e) => emit(e.target.value === '' ? (nullable ? null : 0) : Number(e.target.value))}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} text-end ${className}`}
    />
  )
}

/** A machine value typed as text: a list id, codes, a `$`-path, a pattern. */
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

/** HQ's issues on a block or the rule, each in the reader's language, errors first. */
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
