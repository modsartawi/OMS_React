/**
 * The promise check panel (ticket 971, results ticket decision 9): one row per mode, the share kept, a gauge from 50%
 * to 100% with the 85% to 95% band shaded, and a word for where the share stands — inside, under or over the band.
 * Pick-up is two rows by channel group, each a target with no band.
 *
 * Pure. The share is the reply's as sent; the gauge's positions are geometry only, never written as a figure.
 */
import type { ResultsChannelGroup, ResultsPromiseMode, ResultsPromiseRow } from '@/core/models/sourcing-results'

export type PromiseState = 'inside' | 'under' | 'over' | 'target'

export interface PromisePanelRow {
  key: string
  mode: ResultsPromiseMode
  channelGroup: Exclude<ResultsChannelGroup, 'ALL'> | null
  count: number
  percent: number
  state: PromiseState
  targetMinutes: number | null
  /** Positions on the gauge, percent of its width from its start. */
  gauge: { marker: number; band: { start: number; width: number } | null }
}

export const GAUGE_FROM = 50
export const GAUGE_TO = 100

const onGauge = (percent: number) =>
  Math.max(0, Math.min(100, ((percent - GAUGE_FROM) / (GAUGE_TO - GAUGE_FROM)) * 100))

function stateOf(row: ResultsPromiseRow): PromiseState {
  if (!row.band) return 'target'
  if (row.percent < row.band.from) return 'under'
  if (row.percent > row.band.to) return 'over'
  return 'inside'
}

export function promisePanel(rows: readonly ResultsPromiseRow[]): PromisePanelRow[] {
  return rows.map((row) => {
    const band = row.band ? { start: onGauge(row.band.from), width: onGauge(row.band.to) - onGauge(row.band.from) } : null
    return {
      key: row.channelGroup ? `${row.mode}:${row.channelGroup}` : row.mode,
      mode: row.mode,
      channelGroup: row.channelGroup,
      count: row.count,
      percent: row.percent,
      state: stateOf(row),
      targetMinutes: row.targetMinutes ?? null,
      gauge: { marker: onGauge(row.percent), band },
    }
  })
}
