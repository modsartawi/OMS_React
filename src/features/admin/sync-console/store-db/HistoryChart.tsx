import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ChartFrame from '@/core/charts/ChartFrame'
import SeriesChart, { type ChartSeries } from '@/core/charts/SeriesChart'
import type { StoreDbHistoryDay } from '@/core/models/store-database'
import { historyRows } from './reading-helpers'

/**
 * The store's daily history (oms 916, BO 4031), on `core/charts` (the only Recharts importer).
 *
 * Two charts, never one with two axes (dataviz): the database files (used, allocated, log) in MB against the cap,
 * and the data drive's free space in GB, which runs at another scale. Line form (change over time); each series
 * keeps its slot whatever the store, so Used is the same colour on every store's page. The cap is a reference, not
 * an entity: no slot, the darker ink and a short dash (the `lastYear` comparison style), named "Cap" by its label.
 * A day the worker did not read draws a gap (`historyRows` keeps it `null`).
 */
export default function HistoryChart({
  history,
  capKb,
  busy,
}: {
  history: readonly StoreDbHistoryDay[]
  capKb: number
  busy: boolean
}) {
  const { t, i18n } = useTranslation('sync-console')
  const { files, drive } = useMemo(() => historyRows(history, capKb), [history, capKb])
  const fileSeries: ChartSeries[] = [
    { key: 'used', label: t('storeDb.readings.history.used'), slot: 0, other: false, unit: 'count' },
    { key: 'allocated', label: t('storeDb.readings.history.allocated'), slot: 1, other: false, unit: 'count' },
    { key: 'log', label: t('storeDb.readings.history.log'), slot: 2, other: false, unit: 'count' },
    ...(capKb > 0
      ? [{ key: 'cap', label: t('storeDb.readings.history.cap'), slot: null, other: false, lastYear: true, unit: 'count' as const }]
      : []),
  ]
  const driveSeries: ChartSeries[] = [
    { key: 'driveFree', label: t('storeDb.readings.history.driveFree'), slot: 3, other: false, unit: 'count' },
  ]

  return (
    <section className="flex flex-col gap-2" data-store-db-history={files.length}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.readings.history.title')}</h3>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-history-empty="">
          {t('storeDb.readings.history.empty')}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Chart caption={t('storeDb.readings.history.files')} data="files" busy={busy}>
            <SeriesChart
              form="line"
              stacking="none"
              series={fileSeries}
              rows={files}
              colourBy="member"
              unit="count"
              format="integer"
              locale={i18n.language}
              ariaLabel={t('storeDb.readings.history.filesLabel')}
              height={240}
            />
          </Chart>
          <Chart caption={t('storeDb.readings.history.drive')} data="drive" busy={busy}>
            <SeriesChart
              form="line"
              stacking="none"
              series={driveSeries}
              rows={drive}
              colourBy="member"
              unit="count"
              format="decimal"
              locale={i18n.language}
              ariaLabel={t('storeDb.readings.history.driveLabel')}
              height={240}
            />
          </Chart>
        </div>
      )}
    </section>
  )
}

function Chart({ caption, data, busy, children }: { caption: string; data: string; busy: boolean; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-1" data-history-chart={data}>
      <figcaption className="text-sm font-medium">{caption}</figcaption>
      <ChartFrame busy={busy} hasChart className="rounded-md border border-border/60 p-2">
        {children}
      </ChartFrame>
    </figure>
  )
}
