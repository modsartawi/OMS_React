/** The screen's two input shapes — a labelled text box and a labelled date — styled as the
 *  rest of the app's forms. */
const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground ' +
  'focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

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
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        className={`${INPUT} ${className}`}
      />
    </label>
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
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className={`${INPUT} w-40`}
      />
    </label>
  )
}
