import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Play } from 'lucide-react'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import type { Campaign } from '@/core/models/data-sync'
import { campaignKey, canOperateDataSync, dataSyncAccessQuery, dataSyncApi } from './api'
import { startRefusalWords } from './create-helpers'

/**
 * The campaign header's **Start** (spec 558, ticket 561): shown only while the campaign is `Ready`
 * and only to holders of `DataSync.Operate` (absent, not disabled, otherwise; gone after a bare
 * 403). Start → the door answers Running, and the whole page is re-read so the poll takes over.
 * A refusal (409 `DATASYNC_INVALID_STATE`, 404) shows beside it in words and re-reads the page,
 * which then shows the real status.
 *
 * Its own component in its own file: 563's Pause / Resume / Cancel sit beside it in the same seam.
 */
export default function StartCampaignButton({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation('data-sync')
  const qc = useQueryClient()
  const access = useQuery(dataSyncAccessQuery())
  const [denied, setDenied] = useState(false)
  const id = campaign.campaignId
  const start = useMutation({
    mutationFn: () => dataSyncApi.startCampaign(id),
    onSuccess: () => notify.success(t('start.started')),
    onError: (err) => {
      if (isBareDenial(err)) setDenied(true)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: campaignKey(id) }),
  })

  const error = start.error
  if (!canOperateDataSync(access.data) || denied) return null
  if (campaign.status !== 'Ready' && !error) return null

  const code = error ? apiErrorCode(error) : null
  const wordsKey = error ? startRefusalWords(error) : null
  return (
    <div className="flex flex-col items-end gap-2" data-campaign-start="">
      {campaign.status === 'Ready' && (
        <Button variant="primary" disabled={start.isPending} onClick={() => start.mutate()} data-start-campaign="">
          {start.isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {start.isPending ? t('start.starting') : t('start.button')}
        </Button>
      )}
      {error != null && (
        <ErrorBanner className="max-w-sm p-2" title={t('start.failed')} message={apiErrorMessage(error, t('start.failedHint'))}>
          {wordsKey && (
            <p className="mt-1 text-xs" data-start-refusal="">
              {t(wordsKey)}
            </p>
          )}
          {code && (
            <span className="font-mono text-xs" data-start-error={code}>
              <Ltr>{code}</Ltr>
            </span>
          )}
        </ErrorBanner>
      )}
    </div>
  )
}
