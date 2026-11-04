import { useTranslation } from 'react-i18next'
import ScreenGate from '@/core/ui/ScreenGate'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import AskBox from './AskBox'

/**
 * The analytics home at `/analytics` (spec 766 §F) — the menu leaf's destination. Ticket 767 lands only
 * its empty state behind the probe, so the leaf never opens a missing route; 770 lists the certified,
 * shared and own boards here, with search.
 */
export default function AnalyticsHomePage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('home.title')} subtitle={t('home.subtitle')}>
      <AskBox />
      <p className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground" data-analytics-home-empty>
        {t('home.empty')}
      </p>
    </ScreenGate>
  )
}
