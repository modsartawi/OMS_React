import { useTranslation } from 'react-i18next'
import { canOpenCollections } from './api'
import ScreenGate from './ScreenGate'

/**
 * Cash Collections (`/collection/collections`) — the area's landing screen.
 *
 * A shell for now: ticket 253 mints the area, its access model and its four
 * routes; [254](../../../../.issues/254-cash-collections-opens-on-today.md)
 * fills this one with the toolbar, the today-default query and the grid.
 */
export default function CashCollectionsPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      can={canOpenCollections}
      title={t('collections.title')}
      subtitle={t('collections.subtitle')}
    />
  )
}
