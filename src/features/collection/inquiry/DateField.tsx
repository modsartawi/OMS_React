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
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

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
    <Field label={label}>
      <Input
        type="date"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40"
      />
    </Field>
  )
}
