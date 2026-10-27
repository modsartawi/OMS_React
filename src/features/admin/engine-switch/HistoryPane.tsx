import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { storeEngineHistoryQuery } from './api'
import EngineBadge from './EngineBadge'
import { inFlightCount } from './helpers'

/**
 * One store's switch history (ticket 517, re-pointed in 528; `GET Rules/Switch/History`): the engine
 * HQ holds it on now and who set it, then each flip's who, when (local), from → to, reason and what it
 * left in flight, newest first as HQ answers it. `storeName` is the list's, null when the search no
 * longer lists the store.
 */
export default function HistoryPane({ storeCode, storeName, onClose }: { storeCode: string; storeName: string | null; onClose: () => void }) {
  const { t } = useTranslation('engine-switch')
  const history = useQuery(storeEngineHistoryQuery(storeCode))
  const now = history.data?.store
  const changes = history.data?.changes ?? []

  return (
    <aside className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:w-80 lg:shrink-0" data-history={storeCode}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('history.title')}</h2>
          <p className="text-xs text-muted-foreground">
            <Ltr>{formatPair(storeCode, storeName)}</Ltr>
          </p>
        </div>
        <IconButton label={t('history.close')} onClick={onClose} data-history-close="">
          <X className="size-4" aria-hidden />
        </IconButton>
      </header>
      {history.isPending ? (
        <p className="text-xs text-muted-foreground">{t('history.loading')}</p>
      ) : history.isError ? (
        <ErrorBanner
          className="p-2.5"
          title={t('history.failedTitle')}
          message={isBareDenial(history.error) ? t('history.denied') : apiErrorMessage(history.error, t('history.failed'))}
        />
      ) : (
        <>
          {now && (
            <div className="flex flex-col gap-1 text-xs" data-history-now={now.engine} data-history-set={now.isSet}>
              <EngineBadge engine={now.engine} />
              {!now.isSet ? (
                <span className="text-muted-foreground" data-history-never-set="">
                  {t('history.neverSet')}
                </span>
              ) : (
                (formatDateTime(now.changedAt) || now.changedBy) && (
                  <span className="text-muted-foreground" data-history-now-by="">
                    <Trans t={t} i18nKey="history.setBy" values={{ v: formatPair(formatDateTime(now.changedAt), now.changedBy) }} components={{ v: <Ltr /> }} />
                  </span>
                )
              )}
            </div>
          )}
          {changes.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-history-empty="">
              {t('history.empty')}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {changes.map((e, i) => {
                const n = inFlightCount(e.inFlight)
                return (
                  <li key={i} className="flex flex-col gap-0.5 border-s-2 border-border ps-3 text-xs" data-history-entry={i}>
                    <span className="text-muted-foreground" data-history-when="">
                      <Ltr>{formatPair(formatDateTime(e.changedAt), e.changedBy)}</Ltr>
                    </span>
                    <span className="font-medium" data-history-change="">
                      {t('history.change', { from: t(`engine.${e.fromEngine}`), to: t(`engine.${e.engine}`) })}
                    </span>
                    <bdi data-history-reason="">{e.reason}</bdi>
                    {n > 0 && (
                      <span className="text-attention-800" data-history-in-flight={n}>
                        <Trans t={t} i18nKey="history.inFlight" count={n} values={{ n }} components={{ n: <Ltr /> }} />
                        {e.inFlight?.truncated && <> {t('history.inFlightTruncated')}</>}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </aside>
  )
}
