/**
 * The Came in / Handed over chart's columns, labels and axis (ticket 486, brief 2641). Pure, pinned
 * by `chart-model.test.ts`; `SeriesChart` only draws what this returns.
 *
 * 🚩 **The chart draws `series` as the door sent it.** One column pair per bucket, in the server's
 * order (it sends every bucket, zeros included); nothing is summed, averaged or filled in. A value
 * the server leaves out reads the dash and draws no column — never a 0.
 *
 * As on the till (`DashboardChart`): one axis whose top is the first round step at or above the
 * largest value, so its thirds are whole; hours labelled every third hour (`HH`), days by their day
 * of the month, thinned as the range grows. Unlike the till's two charts, the two series share ONE
 * axis here — the largest of either scales both — so the pair in a bucket reads against each other.
 *
 * A bucket is the server's local `yyyy-MM-ddTHH:mm:ss` (a C# `DateTime`, no zone). It is read as
 * text, never through `Date` — no UTC round trip can move an hour.
 */
import type { DeliveryStatisticsBucket, StatisticsGranularity } from '@/core/models/delivery-statistics'
import { hasFigure, readFigure } from './figures'

/** The till's round axis tops (`DashboardChart.NiceSteps`); past the last, whole 300s. */
const NICE_STEPS = [6, 12, 30, 60, 90, 120, 150, 180, 240, 300] as const

/** The axis' top: the first round step at or above `largest`. Never 0, so a share never divides by it. */
export function niceTop(largest: number): number {
  for (const step of NICE_STEPS) if (largest <= step) return step
  return Math.ceil(largest / 300) * 300
}

export interface ChartColumn {
  /** The axis label under the column; `''` where labels are thinned out. */
  label: string
  /** The bucket as the readout names it: `09:00` by the hour, `2026-10-13` by the day. */
  readout: string
  /** Each value as it reads (grouped, or the dash), and its height as a share of the top, 0 to 1. */
  cameIn: string
  handedOver: string
  cameInShare: number
  handedOverShare: number
}

export interface ChartModel {
  columns: ChartColumn[]
  top: number
  /** The axis' four labels, top to bottom: the top, two thirds, one third, 0. */
  axis: string[]
}

const BUCKET = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/

/** Day labels thin out as a range grows, so they never crowd (the till's steps). */
const dayStep = (count: number): number => (count > 14 ? 5 : count > 7 ? 2 : 1)

function labelled(bucket: string, granularity: StatisticsGranularity, index: number, count: number) {
  const m = BUCKET.exec(bucket.trim())
  if (!m) return { label: '', readout: bucket }
  const [, year, month, day, hour = '00'] = m
  if (granularity === 'hour') return { label: Number(hour) % 3 === 0 ? hour : '', readout: `${hour}:00` }
  return { label: index % dayStep(count) === 0 ? String(Number(day)) : '', readout: `${year}-${month}-${day}` }
}

/** `series` → the chart: its columns in the server's order, one shared top and the axis' labels. */
export function chartModel(
  series: readonly DeliveryStatisticsBucket[] | undefined,
  granularity: StatisticsGranularity,
  dash: string,
): ChartModel {
  const buckets = series ?? []
  const values = buckets.flatMap((b) => [b.cameIn, b.handedOver]).filter(hasFigure)
  const top = niceTop(Math.max(0, ...values))
  const share = (value: unknown) => (hasFigure(value) ? Math.min(1, Math.max(0, value / top)) : 0)

  return {
    columns: buckets.map((b, i) => ({
      ...labelled(String(b.bucket ?? ''), granularity, i, buckets.length),
      cameIn: readFigure(b.cameIn, dash),
      handedOver: readFigure(b.handedOver, dash),
      cameInShare: share(b.cameIn),
      handedOverShare: share(b.handedOver),
    })),
    top,
    axis: [top, (top * 2) / 3, top / 3, 0].map((v) => readFigure(v, dash)),
  }
}
