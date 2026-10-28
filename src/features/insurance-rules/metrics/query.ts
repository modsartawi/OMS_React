import { addDays, localToday, windowProblem, type LocalDate, type WindowProblem } from '@/core/util/date-window'
import { METRICS_BY, type MetricsBy } from './model'

// The Metrics screen's address (ticket 615): `?tab=metrics|flags|rejections&by=rule|store|pharmacist|day
// &from&to&payer`. The window is LOCAL days, both ends counted; the last 30 days to today unless the address
// says otherwise. Pure; the page reads it through `useUrlQuery(metricsFromParams, metricsToParams)`.

export const METRICS_TABS = ['metrics', 'flags', 'rejections'] as const
export type MetricsTab = (typeof METRICS_TABS)[number]

export interface MetricsQuery {
  tab: MetricsTab
  by: MetricsBy
  from: LocalDate
  to: LocalDate
  /** The rejection report's payer; '' = every payer. */
  payer: string
}

/** The default window: 30 local days ending today. */
export const DEFAULT_WINDOW_DAYS = 30
/** The longest window a read may ask for. ⚠️ GUESSED cap (the brief names none). */
export const MAX_WINDOW_DAYS = 366

const pick = <T extends string>(value: string | null, from: readonly T[], fallback: T): T =>
  from.includes(value as T) ? (value as T) : fallback

function defaults(today: LocalDate): MetricsQuery {
  return { tab: 'metrics', by: 'rule', from: addDays(today, -(DEFAULT_WINDOW_DAYS - 1)), to: today, payer: '' }
}

export function readMetricsQuery(params: URLSearchParams, today: LocalDate): MetricsQuery {
  const d = defaults(today)
  return {
    tab: pick(params.get('tab'), METRICS_TABS, d.tab),
    by: pick(params.get('by'), METRICS_BY, d.by),
    from: params.get('from') || d.from,
    to: params.get('to') || d.to,
    payer: params.get('payer')?.trim() ?? '',
  }
}

export function writeMetricsQuery(q: MetricsQuery, today: LocalDate): URLSearchParams {
  const d = defaults(today)
  const out = new URLSearchParams()
  for (const k of ['tab', 'by', 'from', 'to', 'payer'] as const) if (q[k] && q[k] !== d[k]) out.set(k, q[k])
  return out
}

/** Stable, module-level readers for `useUrlQuery`. */
export const metricsFromParams = (p: URLSearchParams) => readMetricsQuery(p, localToday())
export const metricsToParams = (q: MetricsQuery) => writeMetricsQuery(q, localToday())

/** Why the window may not be read, or null when it may. */
export function windowOf(q: Pick<MetricsQuery, 'from' | 'to'>): WindowProblem | null {
  return windowProblem(q.from, q.to, { maxDays: MAX_WINDOW_DAYS })
}

/**
 * The door's params: `by` + `daily` for the metrics (HQ answers per day unless `daily=false`; the day view asks the rule
 * rows per day, 3141 has no `by=day`), `payer` (dropped when empty) for the rejection report.
 */
export function metricsParams(q: MetricsQuery, rejections = false): Record<string, string> {
  const window = { from: q.from, to: q.to }
  if (!rejections) return q.by === 'day' ? { by: 'rule', ...window, daily: 'true' } : { by: q.by, ...window, daily: 'false' }
  return q.payer ? { payer: q.payer, ...window } : window
}
