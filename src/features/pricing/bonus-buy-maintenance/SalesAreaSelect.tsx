import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SALES_AREAS, type SalesAreaKey } from '@/core/bonus-buy/sales-area'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { salesAreaOption, type SalesAreaForm, type SalesAreaNames } from './overview'

/** The closed list's names through `t()`, for the pure label builders (stable per language, so a
 *  grid's column defs that read them are not rebuilt every render). */
export function useSalesAreaNames(): SalesAreaNames {
  const { t } = useTranslation('bonus-buy-maintenance')
  return useMemo(() => ({ ksa: t('salesArea.ksa'), bahrain: t('salesArea.bahrain') }), [t])
}

/**
 * The promotion's sales area (ticket 932, BackOffice spec 4096): KSA or Bahrain, each named with
 * its pair and currency. Disabled with its one-line reason once the promotion holds a bonus buy
 * (BO 4098). A pair outside the list (`other`) is shown as the document has it and offered no change.
 */
export default function SalesAreaSelect({
  form,
  onChange,
  disabled,
  otherLabel,
}: {
  form: SalesAreaForm
  onChange: (key: SalesAreaKey) => void
  disabled?: boolean
  /** The document's own label for a pair outside the list (`salesAreaLabel`). */
  otherLabel?: string
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const names = useSalesAreaNames()
  const other = form.choice === 'other'
  const hint = form.locked ? t('salesArea.locked') : other ? t('salesArea.other') : undefined
  return (
    <Field label={t('salesArea.label')} hint={hint}>
      <Select
        value={form.choice}
        disabled={disabled || form.locked || other}
        onChange={(e) => onChange(e.target.value as SalesAreaKey)}
        className="w-80"
        data-testid="bby-sales-area"
      >
        {SALES_AREAS.map((a) => (
          <option key={a.key} value={a.key}>
            {salesAreaOption(a.key, names)}
          </option>
        ))}
        {other && <option value="other">{fsi(otherLabel ?? '')}</option>}
      </Select>
    </Field>
  )
}
