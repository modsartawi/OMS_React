import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { formatMoney } from '@/core/util/number-format'
import type { FieldValue } from './diff'
import type { FieldDef } from './fields'

/**
 * One setting's value as the detail and the diff show it (bidi rule): a flag in words, an amount and a code as a
 * machine value (`Ltr`), free text (the description) `<bdi>`, and a blank as a dash.
 */
export default function FieldValueText({ def, value }: { def: FieldDef; value: FieldValue }) {
  const { t } = useTranslation('doc-type-config')
  if (def.kind === 'flag') return <span data-flag-value={String(value)}>{t(value ? 'value.yes' : 'value.no')}</span>
  if (def.kind === 'amount') return <Ltr>{formatMoney(Number(value))}</Ltr>
  const text = String(value ?? '').trim()
  if (text === '') return <span className="text-muted-foreground">{t('value.blank')}</span>
  return def.freeText ? <bdi>{text}</bdi> : <Ltr>{text}</Ltr>
}
