import { useTranslation } from 'react-i18next'

/**
 * The note a command posts, captured inside the command's own dialog (spec 083
 * D-11, ticket 094).
 *
 * One component rather than three copies because the note is now typed in
 * several dialogs — `NoteDialog` for the four note-carrying commands,
 * `ChangeStoreDialog` beside the picked store, and `ReturnDialog` beneath the
 * return's own selections. It is the standing textarea that used to sit above
 * the action bar, moved to the places that can now say which command it belongs
 * to.
 *
 * They stay the same FIELD — same shape, same chrome. What it is ASKING for may
 * differ: the first two carry running commentary on a document and share one
 * label and placeholder; the return's note is the return's own reason in words,
 * which the warehouse reads on arrival, and overrides both (ticket 293).
 */
export default function NoteField({
  id,
  value,
  onChange,
  required = false,
  rows = 3,
  label,
  placeholder,
}: {
  /** Unique per dialog — only one dialog is ever open, but ids are global. */
  id: string
  value: string
  onChange: (value: string) => void
  /**
   * Whether the note IS the command (Add Note…) or merely annotates it. Only
   * the label changes here; the enforcement is the dialog's own confirm.
   */
  required?: boolean
  rows?: number
  /**
   * Override the copy when the note is NOT the running commentary a command
   * appends to a document — the bonded return's note is the return's own reason
   * in words, which the warehouse reads at BZ02 (ticket 293). The FIELD is the
   * same field; only what it is asking for differs.
   */
  label?: string
  placeholder?: string
}) {
  const { t } = useTranslation('document')
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground" htmlFor={id}>
        {label ?? (required ? t('note.label') : t('note.labelOptional'))}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('note.placeholder')}
        className="w-full resize-y rounded-lg border border-input bg-background px-2 py-1 text-[0.8125rem]"
      />
    </div>
  )
}
