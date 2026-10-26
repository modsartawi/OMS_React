import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

/** The screen's two input shapes — a labelled text box and a labelled date — on the shared
 *  `Field` + `Input` (spec 590), the label above the control as every form has it. */
export function TextInput({
  label,
  value,
  onChange,
  maxLength,
  disabled,
  className = 'w-80',
  autoFocus,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  maxLength?: number
  disabled?: boolean
  className?: string
  autoFocus?: boolean
}) {
  return (
    <Field label={label}>
      <Input
        type="text"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        className={className}
      />
    </Field>
  )
}

export function DateInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Field label={label}>
      <Input type="date" value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} className="w-40" />
    </Field>
  )
}
