import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'

/**
 * A callout reason (end reason, answer, withdraw outcome, release reason, ignore reason, not-competed
 * reason) as its words under `document:callout.<group>.*` when the client knows it, else the raw value
 * as one machine value. Shared by the spine's callout moments and the Callout sub-tab (ticket 542).
 */
export default function ReasonText({ group, value }: { group: string; value: string }) {
  const { t, i18n } = useTranslation('document')
  const key = `callout.${group}.${value}`
  return i18n.exists(`document:${key}`) ? <>{t(key)}</> : <Ltr>{value}</Ltr>
}
