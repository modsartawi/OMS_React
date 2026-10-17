import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { CAMPAIGN_STATE_SEV, type CampaignState } from './campaign-state'

/**
 * A campaign's state as a badge. The campaigns list and the workspace both draw it, so it sits in
 * `core/rules`; its words are the list's (`campaign-list:states.*`), the `central-invoice`
 * precedent of a core piece speaking in the namespace of the feature that owns the words.
 */
export default function CampaignStateBadge({ state }: { state: CampaignState }) {
  const { t } = useTranslation('campaign-list')
  return (
    <span data-campaign-state={state}>
      <StatusBadge sev={CAMPAIGN_STATE_SEV[state]}>{t(`states.${state}`)}</StatusBadge>
    </span>
  )
}
