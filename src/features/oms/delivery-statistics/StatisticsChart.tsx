import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ChartFrame from '@/core/charts/ChartFrame'
import SeriesChart, { type ChartSeries } from '@/core/charts/SeriesChart'
import type { DeliveryStatisticsBucket, StatisticsGranularity } from '@/core/models/delivery-statistics'
import { seriesRows } from './series-rows'

/**
 * Came in and Handed over per bucket, side by side (486, redrawn on `core/charts` by 815): by the hour
 * for Today and Yesterday, by the day for a Range. Bar form, grouped, the two series on ONE axis, as
 * ruled in 486; the tooltip, legend, a11y layer and RTL mirroring are `core/charts`' own.
 *
 * In a `ChartFrame`: while the page's query refetches (`busy`, the 5-minute Today refresh) the chart
 * stays on screen, dimmed, with the "Updating" mark.
 */
export default function StatisticsChart({
  series,
  granularity,
  busy,
}: {
  series: readonly DeliveryStatisticsBucket[]
  granularity: StatisticsGranularity
  busy: boolean
}) {
  const { t, i18n } = useTranslation('delivery-statistics')
  const rows = useMemo(() => seriesRows(series, granularity), [series, granularity])
  const chartSeries: ChartSeries[] = [
    { key: 'cameIn', label: t('flow.cameIn'), slot: 0, other: false, unit: 'count' },
    { key: 'handedOver', label: t('flow.handedOver'), slot: 1, other: false, unit: 'count' },
  ]

  return (
    <section className="flex flex-col gap-2" data-statistics-band="chart" data-chart-granularity={granularity}>
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(`chart.caption.${granularity}`)}</h2>
      <ChartFrame busy={busy} hasChart className="rounded-lg border border-border/60 bg-card p-3">
        {rows.length > 0 ? (
          <SeriesChart
            form="bar"
            stacking="grouped"
            series={chartSeries}
            rows={rows}
            colourBy="single"
            unit="count"
            format="integer"
            locale={i18n.language}
            ariaLabel={t(`chart.label.${granularity}`)}
            height={280}
          />
        ) : (
          <p className="text-sm text-muted-foreground" data-chart-empty="">
            {t('chart.empty')}
          </p>
        )}
      </ChartFrame>
    </section>
  )
}
