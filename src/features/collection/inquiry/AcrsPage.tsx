import { useTranslation } from 'react-i18next'
import { canOpenAcrs } from './api'
import ScreenGate from './ScreenGate'

/**
 * ACRs (`/collection/acrs`) — the accumulated collection receipts list.
 *
 * A shell for now (ticket 253); [255](../../../../.issues/255-acrs-and-attempts-list-on-the-same-template.md)
 * fills it on the same template Cash Collections establishes.
 */
export default function AcrsPage() {
  const { t } = useTranslation('collection')
  return <ScreenGate can={canOpenAcrs} title={t('acrs.title')} subtitle={t('acrs.subtitle')} />
}
