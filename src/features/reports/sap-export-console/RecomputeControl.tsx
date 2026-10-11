import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { FLEET_KEY, sapExportApi, storeKey } from './api'
import { recomputeErrorKey } from './store-helpers'
import { figure } from './storeday-helpers'

/**
 * Recompute (BackOffice spec 2579, ticket 464) — `POST SapExport/Recompute`, the console's ONE
 * write. With no `day` it re-judges the store's whole window; with one, that day. Busy while it
 * runs; on success it re-reads the store's header and strip (and the fleet, which reads the same
 * rollup), and says how many days it re-judged. The store-day page is classified live, not from
 * the rollup, so it has nothing to re-read. A refusal shows its own sentence.
 *
 * 🚩 The copy says it plainly: it refreshes the console's numbers and never touches export data.
 */
export default function RecomputeControl({ code, day }: { code: string; day?: string }) {
  const { t } = useTranslation('sap-export-console')
  const qc = useQueryClient()
  const recompute = useMutation({
    mutationFn: () => sapExportApi.recompute(day ? { code, day } : { code }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: storeKey(code) })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
    },
  })

  const errorKey = recompute.isError ? recomputeErrorKey(apiErrorCode(recompute.error)) : null
  const done = recompute.isSuccess ? recompute.data : undefined

  return (
    <div className="flex flex-col gap-1.5" data-recompute={day ? 'day' : 'window'}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outlined"
          disabled={recompute.isPending}
          aria-busy={recompute.isPending}
          onClick={() => recompute.mutate()}
          data-recompute-button=""
        >
          {recompute.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          {recompute.isPending ? t('recompute.busy') : t(day ? 'recompute.day' : 'recompute.window')}
        </Button>
        {done && (
          <span className="text-sm text-muted-foreground" role="status" data-recompute-done={done.days}>
            <Trans
              t={t}
              i18nKey="recompute.done"
              count={done.days}
              values={{ n: figure(done.days), at: formatDateTime(done.computedAt) }}
              components={{ n: <Ltr />, at: <Ltr /> }}
            />
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t(day ? 'recompute.dayHint' : 'recompute.windowHint')}</p>
      {recompute.isError && (
        <ErrorBanner className="p-3" message={errorKey ? t(errorKey) : apiErrorMessage(recompute.error, t('recompute.failed'))} />
      )}
    </div>
  )
}
