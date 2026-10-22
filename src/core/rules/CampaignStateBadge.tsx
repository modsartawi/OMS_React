import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { CAMPAIGN_STATE_SEV, type CampaignState } from './campaign-state'

/**
 * A campaign's state as a badge. The campaigns list and the workspace both draw it, so it sits in
 * `core/rules`; its words are the campaigns area's (`campaigns:states.*`, the namespace the area's
 * menu speaks too), as the `reports` namespace is its area's.
 */
export default function CampaignStateBadge({ state }: { state: CampaignState }) {
  const { t } = useTranslation('campaigns')
  return (
    <span data-campaign-state={state}>
      <StatusBadge sev={CAMPAIGN_STATE_SEV[state]}>{t(`states.${state}`)}</StatusBadge>
    </span>
  )
}
