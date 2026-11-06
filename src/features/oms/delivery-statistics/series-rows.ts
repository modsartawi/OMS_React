/**
 * The Came in / Handed over chart's rows for `core/charts` `SeriesChart` (ticket 815, spec 811;
 * replaces 486's hand-drawn chart and its `chart-model`). Pure, pinned by `series-rows.test.ts`.
 *
 * 🚩 **The chart draws `series` as the door sent it.** One row per bucket, in the server's order (it
 * sends every bucket, zeros included); nothing is summed, sorted or filled in. A value the server
 * leaves out stays `null` and draws no bar — never a 0.
 *
 * The label is the category axis' tick and the tooltip's heading: `HH:00` by the hour, the whole
 * `yyyy-MM-dd` by the day (Recharts thins crowded ticks itself). A bucket is the server's local
 * `yyyy-MM-ddTHH:mm:ss` (a C# `DateTime`, no zone), read as text, never through `Date` — no UTC round
 * trip can move an hour. A bucket it cannot read keeps its row, labelled as sent.
 */
import type { ChartSeriesRow } from '@/core/charts/SeriesChart'
import type { DeliveryStatisticsBucket, StatisticsGranularity } from '@/core/models/delivery-statistics'
import { hasFigure } from './figures'

/** The two series' keys, in drawing order (Came in first). */
export const SERIES_KEYS = ['cameIn', 'handedOver'] as const

const BUCKET = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/

function labelOf(bucket: string, granularity: StatisticsGranularity): string {
  const m = BUCKET.exec(bucket.trim())
  if (!m) return bucket
  const [, year, month, day, hour = '00'] = m
  return granularity === 'hour' ? `${hour}:00` : `${year}-${month}-${day}`
}

/** `series` → the chart's rows, in the server's order; an absent value stays `null`. */
export function seriesRows(
  series: readonly DeliveryStatisticsBucket[] | undefined,
  granularity: StatisticsGranularity,
): ChartSeriesRow[] {
  return (series ?? []).map((b) => {
    const x = String(b.bucket ?? '')
    return {
      x,
      label: labelOf(x, granularity),
      values: { cameIn: hasFigure(b.cameIn) ? b.cameIn : null, handedOver: hasFigure(b.handedOver) ? b.handedOver : null },
      slot: null,
    }
  })
}
