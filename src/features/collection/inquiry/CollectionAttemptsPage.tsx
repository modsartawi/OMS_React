import { useTranslation } from 'react-i18next'
import { canOpenAttempts } from './api'
import ScreenGate from './ScreenGate'

/**
 * Collection Attempts (`/collection/attempts`) — the smallest screen in the
 * suite: one flat list, no document, and ⚠️ **no row action at all**, matching
 * WPF. An attempt is immutable evidence, not a voucher (244 §10, spec 249
 * story 39) — so no row action joins this screen for symmetry with the other
 * three.
 *
 * A shell for now (ticket 253);
 * [255](../../../../.issues/255-acrs-and-attempts-list-on-the-same-template.md) fills it.
 */
export default function CollectionAttemptsPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate can={canOpenAttempts} title={t('attempts.title')} subtitle={t('attempts.subtitle')} />
  )
}
