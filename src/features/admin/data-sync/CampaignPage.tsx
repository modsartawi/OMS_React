import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenDataSync, dataSyncAccessQuery } from './api'

/**
 * One campaign's page — `/admin/data-sync/campaigns/:campaignId`. A placeholder (ticket 559) so a
 * campaigns row has somewhere to go; ticket 560 builds the rollup, the jobs grid and the drawer.
 */
export default function CampaignPage() {
  const { t } = useTranslation('data-sync')
  const { campaignId = '' } = useParams()
  return (
    <ScreenGate
      query={dataSyncAccessQuery()}
      can={canOpenDataSync}
      ns="data-sync"
      title={t('campaign.placeholderTitle')}
      subtitle={t('subtitle')}
    >
      <div className="flex flex-col gap-2 text-sm" data-campaign-page={campaignId}>
        <p className="font-mono text-xs">
          <Ltr>{campaignId}</Ltr>
        </p>
        <p className="text-muted-foreground">{t('campaign.placeholder')}</p>
        <Link to="/admin/data-sync" className="text-primary underline-offset-2 hover:underline">
          {t('campaign.back')}
        </Link>
      </div>
    </ScreenGate>
  )
}
