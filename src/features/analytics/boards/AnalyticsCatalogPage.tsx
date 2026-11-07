import { useTranslation } from 'react-i18next'
import { Library } from 'lucide-react'
import ScreenGate from '@/core/ui/ScreenGate'
import { analyticsAccessQuery, canViewAnalytics } from './access'

/**
 * The Catalog leaf at `/analytics/catalog` (ticket 839, BackOffice spec 3437 §G) — a placeholder behind the same
 * `canView` gate as every analytics page, so the menu entry lands somewhere honest. Ticket 841 replaces it with the
 * catalog tree (areas → members → marts → sources) and its detail pane.
 */
export default function AnalyticsCatalogPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('pages.catalog.title')} subtitle={t('pages.catalog.subtitle')}>
      <p className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground" data-analytics-catalog-coming>
        <Library className="size-4" aria-hidden />
        {t('pages.catalog.coming')}
      </p>
    </ScreenGate>
  )
}
