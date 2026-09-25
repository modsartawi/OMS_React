/**
 * One end of a date range — a native date input speaking `yyyy-MM-dd`, which is
 * what the four collection doors' `DateTime?` parameters bind from.
 *
 * Ticket 315 drew it inside `CollectionsToolbar`; ticket 316 moved it here when the
 * ACRs, Deposits and Attempts toolbars took the same four ends (BackOffice 1993), so
 * the four strips cannot drift apart on how a date end looks or behaves.
 *
 * ⚠️ **Never `required`.** The four-filter contract makes every end optional — an
 * open-ended range is a real question, and asking by one range alone means leaving
 * the other empty.
 */
export default function DateField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type="date"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  )
}
