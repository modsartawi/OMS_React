import { useIsFetching } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'

import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { figure } from '../helpers'
import { storeDbStoreKey } from './api'
import HistoryChart from './HistoryChart'
import LargestTables from './LargestTables'
import { ReadingLineList } from './LineValue'
import type { StoreDbPanelProps } from './panel-views'
import { growth, readingLines } from './reading-helpers'
import { sizeText } from './size'

/**
 * The Readings panel (oms 916, BO 4031): the latest reading in plain words, days to cap with the growth behind it,
 * the daily history and the largest tables (the side copies are on the Space panel, 918). Everything comes from the
 * page's one `GET StoreDatabase/Store` answer — this panel reads no door of its own.
 */
export default function ReadingsPanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const busy = useIsFetching({ queryKey: storeDbStoreKey(store.code), exact: true }) > 0
  const lines = readingLines(store.reading, store.files)
  return (
    <div className="flex flex-col gap-5" data-readings-panel="">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-2" data-reading-lines={lines.length}>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.readings.latest')}</h3>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-no-reading="">
              {t('storeDb.readings.noReading')}
            </p>
          ) : (
            <ReadingLineList lines={lines} data="reading" />
          )}
        </section>
        <Growth store={store} />
      </div>
      <HistoryChart history={store.history} capKb={store.reading?.capKb ?? 0} busy={busy} />
      <LargestTables tables={store.largestTables} />
    </div>
  )
}

/** Days to cap as the server forecast it, with the growth rate behind it and the reading it is measured from. */
function Growth({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const g = growth(store)
  const rate = g?.perDay ? sizeText(t, g.perDay) : null
  const rateKey = g?.shrinking ? 'shrinking' : 'rate'
  return (
    <section className="flex flex-col gap-2 self-start rounded-md border border-border/60 p-3" data-store-db-growth={g?.days ?? ''}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.readings.growth.title')}</h3>
      <p className="text-2xl font-semibold tabular-nums" data-days-to-cap="">
        {g?.days != null ? (
          <Trans t={t} i18nKey="storeDb.readings.growth.days" values={{ days: figure(g.days) }} components={{ days: <Ltr /> }} />
        ) : (
          <span className="text-base font-medium text-muted-foreground">{t('storeDb.readings.growth.noForecast')}</span>
        )}
      </p>
      {rate && (
        <p className="text-sm text-muted-foreground" data-growth-rate="">
          {g?.since ? (
            <Trans
              t={t}
              i18nKey={`storeDb.readings.growth.${rateKey}`}
              values={{ rate, since: formatDateTime(g.since) }}
              components={{ rate: <Ltr />, since: <Ltr /> }}
            />
          ) : (
            <Trans t={t} i18nKey={`storeDb.readings.growth.${rateKey}Only`} values={{ rate }} components={{ rate: <Ltr /> }} />
          )}
        </p>
      )}
    </section>
  )
}
