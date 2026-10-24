import { useTranslation } from 'react-i18next'
import { Construction } from 'lucide-react'
import { hungerStationAccessQuery } from '@/core/hungerstation/api'
import { canManageCatalog, canViewOrders } from '@/core/hungerstation/access'
import ScreenGate from '@/core/ui/ScreenGate'

/**
 * The placeholder the HungerStation menu's Materials and Orders leaves open (ticket 551) until 555
 * and 556 re-point their route at their own page and delete this file. Each stands behind its OWN
 * flag on the ONE HungerStation probe — the very predicate its menu leaf reads — so a hand-typed
 * URL is gated exactly as the page will be. It lives in `app/` (the composition root) because it
 * belongs to no feature yet, and speaks in `hungerstation-stores`, the area's first namespace.
 */
export default function HungerStationPlaceholderPage({ screen }: { screen: 'materials' | 'orders' }) {
  const { t } = useTranslation('hungerstation-stores')
  return (
    <ScreenGate
      query={hungerStationAccessQuery()}
      can={screen === 'materials' ? canManageCatalog : canViewOrders}
      ns="hungerstation-stores"
      keyPrefix={`placeholder.${screen}.access`}
      title={t(`placeholder.${screen}.title`)}
      subtitle={t(`placeholder.${screen}.subtitle`)}
    >
      <div
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground"
        data-hs-placeholder={screen}
      >
        <Construction className="h-5 w-5 shrink-0" aria-hidden />
        <p>{t(`placeholder.${screen}.body`)}</p>
      </div>
    </ScreenGate>
  )
}
