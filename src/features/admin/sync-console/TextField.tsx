/**
 * One labelled text box of the onboarding forms (ticket 449): the New store wizard and
 * the Edit location / Edit store dialogs. A machine value (a code, an IP, a phone) is
 * typed left to right in mono; free text takes its own direction.
 */
export function TextField({
  label,
  hint,
  value,
  onChange,
  disabled = false,
  ltr = false,
  data,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  ltr?: boolean
  /** The `data-field` hook a drive finds it by. */
  data: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        dir={ltr ? 'ltr' : 'auto'}
        className={
          'h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal text-foreground outline-none focus:border-primary/60 disabled:opacity-60' +
          (ltr ? ' font-mono' : '')
        }
        data-field={data}
      />
      {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}
