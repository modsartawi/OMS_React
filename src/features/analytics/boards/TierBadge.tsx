import { useTranslation } from 'react-i18next'
import { BadgeCheck } from 'lucide-react'
import type { AnalyticsTier } from '@/core/models/analytics'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'

const TIER_SEVERITY: Record<AnalyticsTier, Severity> = { certified: 'ok', shared: 'go', personal: 'mute' }

/**
 * An item's tier badge (spec 766 user story 6; 770's home row, and since ticket 778 the view and the board): the
 * Certified badge carries its check, so curated figures read apart from personal experiments wherever they show.
 */
export default function TierBadge({ tier }: { tier: AnalyticsTier }) {
  const { t } = useTranslation('boards')
  return (
    <span data-analytics-tier-badge={tier}>
      <StatusBadge sev={TIER_SEVERITY[tier] ?? 'mute'}>
        {tier === 'certified' && <BadgeCheck className="me-1 size-3" aria-hidden />}
        {t(`home.tier.${tier}`)}
      </StatusBadge>
    </span>
  )
}
