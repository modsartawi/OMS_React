import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, TriangleAlert } from 'lucide-react'
import { isError, type GuardIssue } from '@/core/insurance-rules/checks'
import { saysIn } from '@/core/rules/sentence'

// The guard editor's small controls (ticket 608): one look for every block's fields, the issues HQ's
// Validate pinned on a block or a field, and a labelled field with its unit.

export const CONTROL =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none ' +
  'aria-[invalid=true]:border-danger-border aria-[invalid=true]:bg-danger-050'

/** A labelled control, its unit after it; `invalid` marks the control HQ's checks point at. */
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

/** A number typed with its unit; an empty box reads 0 (HQ's Validate names a value it refuses). */
export function NumberInput({
  value,
  onValue,
  invalid,
  className = 'w-20',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number; onValue: (n: number) => void; invalid?: boolean }) {
  return (
    <input
      {...rest}
      type="number"
      dir="ltr"
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onValue(e.target.value === '' ? 0 : Number(e.target.value))}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} text-end ${className}`}
    />
  )
}

/** A machine value typed as text: a list id, codes, a `$`-path. */
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
  return (
    <ul className="flex flex-col gap-0.5 text-xs" data-issues={hook ?? ''}>
      {issues.map((i, k) => (
        <li
          key={k}
          className={`flex items-start gap-1 ${isError(i) ? 'text-danger-800' : 'text-attention-800'}`}
          data-issue={i.severity}
          data-issue-field={i.field ?? ''}
        >
          {isError(i) ? <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
          <bdi>{saysIn({ en: i.en, ar: i.ar }, i18n.language)}</bdi>
        </li>
      ))}
    </ul>
  )
}
