import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { healthQuery } from './api'
import { serviceBanner } from './helpers'

/**
 * DataSync's service banner (spec 558 story 4): the state DB unreachable, the worker turned off, or
 * no worker tick for over a minute — so a stalled campaign never looks like a slow one. Polls
 * `DataSync/Health` with the list. Nothing when healthy. Shared by every Data sync page.
 */
export default function ServiceBannerView() {
  const { t } = useTranslation('data-sync')
  const health = useQuery(healthQuery())
  const banner = serviceBanner({ health: health.data, error: health.error }, Date.now())
  if (!banner) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
      data-service-banner={banner.kind}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        {banner.kind === 'workerStale' ? (
          banner.lastTick ? (
            <Trans
              t={t}
              i18nKey="banner.workerStale"
              values={{ at: formatDateTime(banner.lastTick) }}
              components={{ at: <Ltr /> }}
            />
          ) : (
            t('banner.workerNeverTicked')
          )
        ) : (
          t(`banner.${banner.kind}`)
        )}
      </p>
    </div>
  )
}
