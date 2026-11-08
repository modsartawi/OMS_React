import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { calloutDistanceMode, type DeliveryFieldDef, type DeliveryFieldValue } from './delivery-type-form'

/**
 * One delivery type setting as the detail and the diff show it (bidi rule): a flag in words, a number and a code as a
 * machine value (`Ltr`), free text (the description) `<bdi>`, and a blank as a dash. Ticket 3154.
 */
export default function DeliveryTypeValueText({ def, value }: { def: DeliveryFieldDef; value: DeliveryFieldValue }) {
  const { t } = useTranslation('doc-type-config')
  if (def.kind === 'flag') return <span data-flag-value={String(value)}>{t(value ? 'value.yes' : 'value.no')}</span>
  if (def.kind === 'number') return <Ltr>{String(Number(value))}</Ltr>
  const text = String(value ?? '').trim()
  if (def.choice === 'distanceMode') {
    // In words; a blank (not yet migrated) reads as Off; an unknown code is shown raw.
    const mode = calloutDistanceMode(text)
    if (mode) return <span data-distance-mode={mode}>{t(`deliveryTypes.distanceModes.${mode}.label`)}</span>
  }
  if (text === '') return <span className="text-muted-foreground">{t('value.blank')}</span>
  return def.freeText ? <bdi>{text}</bdi> : <Ltr>{text}</Ltr>
}
