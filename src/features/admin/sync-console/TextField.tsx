import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

/**
 * One labelled text box of the onboarding forms (ticket 449): the New store wizard and
 * the Edit location / Edit store dialogs. A machine value (a code, an IP, a phone) is
 * typed left to right in mono; free text takes its own direction.
 *
 * `onCommit` (the Replay page's target store, ticket 472) runs on Enter and on blur: the
 * moment a typed value is meant, not each keystroke.
 */
export function TextField({
  label,
  hint,
  value,
  onChange,
  disabled = false,
  ltr = false,
  onCommit,
  data,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  ltr?: boolean
  onCommit?: () => void
  /** The `data-field` hook a drive finds it by. */
  data: string
}) {
  return (
    <Field label={label} hint={hint || undefined}>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onCommit && ((e) => e.key === 'Enter' && onCommit())}
        onBlur={onCommit}
        disabled={disabled}
        dir={ltr ? 'ltr' : 'auto'}
        className={ltr ? 'font-mono' : undefined}
        data-field={data}
      />
    </Field>
  )
}
