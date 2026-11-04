import { useTranslation } from 'react-i18next'
import { SearchX } from 'lucide-react'
import ScreenGate from '@/core/ui/ScreenGate'
import { analyticsAccessQuery, canViewAnalytics } from './access'

/**
 * A board at `/analytics/board/:id` — a placeholder from ticket 770 so the home's board items open a route
 * rather than the catch-all's redirect home. Board pages arrive in 771, which replaces this body; until
 * then every board opens its not-found state, behind the same probe as the rest of the area.
 */
export default function AnalyticsBoardPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('board.title')} subtitle={t('board.subtitle')}>
      <div
        className="mx-auto mt-10 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
        data-analytics-state="not-found"
      >
        <SearchX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t('board.notFoundTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('board.notYet')}</p>
      </div>
    </ScreenGate>
  )
}
