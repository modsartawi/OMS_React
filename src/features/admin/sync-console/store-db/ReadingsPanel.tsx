import { useIsFetching } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { formatParts } from '@/core/util/bidi'
import { figure } from '../helpers'
import { storeDbStoreKey } from './api'
import HistoryChart from './HistoryChart'
import LargestTables from './LargestTables'
import type { StoreDbPanelProps } from './panel-views'
import { growth, readingLines, type ReadingLine } from './reading-helpers'
import type { Size } from './size'

/**
 * The Readings panel (oms 916, BO 4031): the latest reading in plain words, days to cap with the growth behind it,
 * the daily history and the largest tables (the side copies are on the Space panel, 918). Everything comes from the
 * page's one `GET StoreDatabase/Store` answer — this panel reads no door of its own.
 */
export default function ReadingsPanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const busy = useIsFetching({ queryKey: storeDbStoreKey(store.code), exact: true }) > 0
  const lines = readingLines(store.reading)
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
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              {lines.map((line) => (
                <div key={line.key} className="contents" data-reading-line={line.key}>
                  <dt className="text-muted-foreground">{t(`storeDb.readings.lines.${line.key}`)}</dt>
                  <dd className="min-w-0 tabular-nums">
                    <LineValue line={line} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <Growth store={store} />
      </div>
      <HistoryChart history={store.history} capKb={store.reading?.capKb ?? 0} busy={busy} />
      <LargestTables tables={store.largestTables} />
    </div>
  )
}

const sizeText = (t: TFunction, size: Size | null): string => (size ? t(`storeDb.units.${size.unit}`, { n: size.n }) : '')

/** One reading line's value; every machine value isolated whole (bidi rule). The Space and Backup panels (918) reuse it. */
export function LineValue({ line }: { line: ReadingLine }) {
  const { t } = useTranslation('sync-console')
  const missing = <span className="text-muted-foreground">{t('storeDb.readings.values.missing')}</span>
  const slotted = (i18nKey: string, values: Record<string, string>, slots: Record<string, ReactElement>) => (
    <Trans t={t} i18nKey={i18nKey} values={values} components={slots} />
  )
  switch (line.kind) {
    case 'engine': {
      const bits = line.is64Bit == null ? null : t(line.is64Bit ? 'storeDb.fleet.bitness.x64' : 'storeDb.fleet.bitness.x86')
      const label = t(`storeDb.engines.${line.engine}`, { defaultValue: line.engine })
      // "2008 R2 · 10.50.6000.34 SP3 · Express Edition · 64-bit" — one value led by a machine value, isolated once.
      return <Ltr>{formatParts([label, line.version, line.edition, bits].filter((p): p is string => !!p))}</Ltr>
    }
    case 'size':
      return line.size ? <Ltr>{sizeText(t, line.size)}</Ltr> : missing
    case 'noCap':
      return <>{t('storeDb.readings.values.noCap')}</>
    case 'used':
      if (!line.size) return missing
      return line.share === null ? (
        <Ltr>{sizeText(t, line.size)}</Ltr>
      ) : (
        slotted('storeDb.readings.values.usedOfCap', { size: sizeText(t, line.size), share: line.share }, { size: <Ltr />, share: <Ltr /> })
      )
    case 'log':
      if (!line.size) return missing
      return line.used
        ? slotted('storeDb.readings.values.logUsed', { used: sizeText(t, line.used), size: sizeText(t, line.size) }, { used: <Ltr />, size: <Ltr /> })
        : <Ltr>{sizeText(t, line.size)}</Ltr>
    case 'text':
      return line.text ? <Ltr>{line.text}</Ltr> : missing
    case 'drive':
      if (!line.size) return missing
      return line.drive
        ? slotted('storeDb.readings.values.driveOn', { size: sizeText(t, line.size), drive: line.drive }, { size: <Ltr />, drive: <Ltr /> })
        : <Ltr>{sizeText(t, line.size)}</Ltr>
    case 'uptime':
      return slotted('storeDb.readings.values.uptime', { days: figure(line.days), hours: figure(line.hours) }, { days: <Ltr />, hours: <Ltr /> })
    case 'backup':
      return line.size
        ? slotted('storeDb.readings.values.backup', { at: formatDateTime(line.at), size: sizeText(t, line.size) }, { at: <Ltr />, size: <Ltr /> })
        : <Ltr>{formatDateTime(line.at)}</Ltr>
    case 'missing':
      return missing
  }
}

/** Days to cap as the server forecast it, with the growth rate and window behind it. */
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
          {g?.windowDays != null ? (
            <Trans
              t={t}
              i18nKey={`storeDb.readings.growth.${rateKey}`}
              values={{ rate, window: figure(g.windowDays) }}
              components={{ rate: <Ltr />, window: <Ltr /> }}
            />
          ) : (
            <Trans t={t} i18nKey={`storeDb.readings.growth.${rateKey}Only`} values={{ rate }} components={{ rate: <Ltr /> }} />
          )}
        </p>
      )}
    </section>
  )
}
