import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { PROMOTION_STATE_SEV, type PromotionBadge } from './promotion-row'

/** A promotion's state badge; an unlisted state already reads `disabled` (`promotionBadge`). */
export default function PromotionStateBadge({ badge }: { badge: PromotionBadge }) {
  const { t } = useTranslation('campaign-promotions')
  return (
    <span data-promotion-state={badge}>
      <StatusBadge sev={PROMOTION_STATE_SEV[badge]}>{t(`state.${badge}`)}</StatusBadge>
    </span>
  )
}
