import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { figure } from '../helpers'
import Loading from '../Loading'
import TabGrid from '../TabGrid'
import { storeDbLiveQuery } from './api'
import { buildLiveColumns } from './live-columns'
import { liveSections, lookTime } from './live-helpers'
import type { StoreDbPanelProps } from './panel-views'

/**
 * The Live activity panel (oms 917, BO 4032 door `GET StoreDatabase/LiveActivity`): one look at what the store's
 * database is doing (running requests, head blockers, the sync worker's own sessions, transactions open over 30 s)
 * as four tables, with the time of the look. Look again takes another; nothing polls (each look queries a till).
 */
export default function LivePanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const live = useQuery(storeDbLiveQuery(store.code))
  const columns = useMemo(() => buildLiveColumns(t), [t])
  const at = lookTime(live.data, live.dataUpdatedAt)

  return (
    <div className="flex flex-col gap-4" data-live-panel="">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t('storeDb.live.intro')}</p>
        <span className="text-xs text-muted-foreground" data-live-looked-at={at ?? ''}>
          {at ? (
            <Trans t={t} i18nKey="storeDb.live.lookedAt" values={{ at: formatDateTime(at) }} components={{ at: <Ltr /> }} />
          ) : (
            t('storeDb.live.notLooked')
          )}
        </span>
        <Button variant="outlined" onClick={() => void live.refetch()} disabled={live.isFetching} data-live-refresh="">
          <Eye className={'h-3.5 w-3.5 ' + (live.isFetching ? 'animate-pulse' : '')} aria-hidden />
          {live.isFetching ? t('storeDb.live.looking') : t('storeDb.live.refresh')}
        </Button>
      </div>

      {live.isPending && <Loading label={t('storeDb.live.looking')} />}
      {live.isError && <ErrorBanner className="p-3" message={apiErrorMessage(live.error, t('storeDb.live.failed'))} />}

      {live.data &&
        !live.isError &&
        liveSections(live.data).map((section) => (
          <section key={section.key} className="flex flex-col gap-2" data-live-section={section.key} data-live-rows={section.rows.length}>
            <h3 className="flex items-baseline gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t(`storeDb.live.sections.${section.key}.title`)}
              <span className="font-normal normal-case">
                <Ltr>{figure(section.rows.length)}</Ltr>
              </span>
            </h3>
            <TabGrid<object>
              rows={section.rows}
              columns={columns[section.key]}
              pending={false}
              error={null}
              failed={t('storeDb.live.failed')}
              empty={t(`storeDb.live.sections.${section.key}.empty`)}
              loading={t('storeDb.live.looking')}
              data={`live-${section.key}`}
              maxRows={12}
            />
          </section>
        ))}
    </div>
  )
}
