import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { StoreEngineRow } from '@/core/models/rule-campaign'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { storeEngineHistoryQuery } from './api'
import { engineOf } from './helpers'

/**
 * One store's switch history (ticket 517, BackOffice 2745): each flip's who, when (local),
 * from → to, and reason, newest first as HQ answers it.
 */
export default function HistoryPane({ row, onClose }: { row: StoreEngineRow; onClose: () => void }) {
  const { t } = useTranslation('engine-switch')
  const history = useQuery(storeEngineHistoryQuery(row.storeCode))
  const entries = history.data ?? []

  return (
    <aside className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 lg:w-80 lg:shrink-0" data-history={row.storeCode}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('history.title')}</h2>
          <p className="text-xs text-muted-foreground">
            <Ltr>{formatPair(row.storeCode, row.storeName)}</Ltr>
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          onClick={onClose}
          aria-label={t('history.close')}
          title={t('history.close')}
          data-history-close=""
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>
      {history.isPending ? (
        <p className="text-xs text-muted-foreground">{t('history.loading')}</p>
      ) : history.isError ? (
        <ErrorBanner className="p-2.5" title={t('history.failedTitle')} message={apiErrorMessage(history.error, t('history.failed'))} />
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-history-empty="">
          {t('history.empty')}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((e, i) => (
            <li key={i} className="flex flex-col gap-0.5 border-s-2 border-border ps-3 text-xs" data-history-entry={i}>
              <span className="text-muted-foreground" data-history-when="">
                <Ltr>{formatPair(formatDateTime(e.at), e.by)}</Ltr>
              </span>
              <span className="font-medium" data-history-change="">
                {t('history.change', { from: t(`engine.${engineOf({ engine: e.from })}`), to: t(`engine.${e.to}`) })}
              </span>
              <bdi data-history-reason="">{e.reason}</bdi>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
