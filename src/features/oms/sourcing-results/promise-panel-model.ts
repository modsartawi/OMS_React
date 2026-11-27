/**
 * The promise check panel (ticket 971, results ticket decision 9): one row per mode, the share kept, a gauge from 50%
 * to 100% with the 85% to 95% band shaded, and a word for where the share stands. Where it stands is the server's pill
 * (BO 4393 `PromisePills`): inside, under or over the band; pick-up is two rows by channel group, a target with no band.
 *
 * Pure. The share is the reply's as sent; the gauge's positions are geometry only, never written as a figure.
 */
import type { ResultsChannelGroup, ResultsPromisePill, ResultsPromiseCheckRow, ResultsShipMode } from '@/core/models/sourcing-results'

export type PromiseState = 'inside' | 'under' | 'over' | 'target' | 'none'

export interface PromisePanelRow {
  key: string
  mode: ResultsShipMode
  channelGroup: ResultsChannelGroup | null
  /** Shipments (pick-ups, for pick-up) checked against a real delivery. */
  count: number
  within: number
  percent: number
  state: PromiseState
  /** Dawaa Now's express stamp (came in + 45 minutes): its own share, beside the promise's. */
  expressStampPercent: number | null
  /** Positions on the gauge, percent of its width from its start; no marker when nothing was checked. */
  gauge: { marker: number | null; band: { start: number; width: number } | null }
}

export const GAUGE_FROM = 50
export const GAUGE_TO = 100

const onGauge = (percent: number) => Math.max(0, Math.min(100, ((percent - GAUGE_FROM) / (GAUGE_TO - GAUGE_FROM)) * 100))

const STATE: Record<ResultsPromisePill, PromiseState> = {
  INSIDE: 'inside',
  UNDER: 'under',
  OVER: 'over',
  NO_BAND: 'target',
  NONE_CHECKED: 'none',
}

export function promisePanel(rows: readonly ResultsPromiseCheckRow[]): PromisePanelRow[] {
  return rows.map((row) => {
    const band =
      row.bandLow != null && row.bandHigh != null ? { start: onGauge(row.bandLow), width: onGauge(row.bandHigh) - onGauge(row.bandLow) } : null
    const state = STATE[row.pill] ?? 'target'
    return {
      key: row.channelGroup ? `${row.mode}:${row.channelGroup}` : row.mode,
      mode: row.mode,
      channelGroup: row.channelGroup,
      count: row.checked,
      within: row.within,
      percent: row.percent,
      state,
      expressStampPercent: row.expressStampPercent ?? null,
      gauge: { marker: state === 'none' ? null : onGauge(row.percent), band },
    }
  })
}
