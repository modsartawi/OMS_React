import { useTranslation } from 'react-i18next'
import { formatPair, fsi } from '@/core/util/bidi'
import type { CodeChoice } from './delivery-type-form'

/**
 * A code dropdown (ticket 3154): blank (no reference) first, then each code with its description — the document type
 * form's default delivery type and the delivery type form's default document type. `<option>` is a string sink, so
 * each side is isolated with `fsi` (bidi rule).
 */
export default function CodeChoiceSelect({
  choices,
  value,
  disabled,
  invalid,
  onChange,
}: {
  choices: readonly CodeChoice[]
  value: string
  disabled: boolean
  invalid?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('doc-type-config')
  return (
    <select
      value={value.trim()}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      className="w-48 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
      data-code-choice=""
    >
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.value === '' ? t('value.blank') : formatPair(fsi(c.value), fsi(c.description))}
        </option>
      ))}
    </select>
  )
}
