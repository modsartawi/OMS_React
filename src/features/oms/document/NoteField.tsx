import { useTranslation } from 'react-i18next'

/**
 * The note a command posts, captured inside the command's own dialog (spec 083
 * D-11, ticket 094).
 *
 * One component rather than two copies because the note is now typed in two
 * different dialogs — `NoteDialog` for the four note-carrying commands, and
 * `ChangeStoreDialog` beside the picked store — and they must stay the same
 * field: same label, same placeholder, same shape. It is the standing textarea
 * that used to sit above the action bar, moved to the two places that can now
 * say which command it belongs to.
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
