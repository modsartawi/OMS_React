import type { AnalyticsLabel, AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { dimensionOf, measureOf } from './wire'

/**
 * A panel's freshness and failure states (spec 766 §F, ticket 773). Pure: the view page and every
 * board panel read their chrome from here, and `panel-state.test.ts` proves the thresholds.
 */

/** 766 §F: three missed intraday runs. Provisional — the spec says the threshold may be tuned. */
export const BEHIND_AFTER_MINUTES = 45

const MINUTE = 60_000

const timeOf = (value: string | null | undefined): number | null => {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

/** `dataAsOf` more than 45 minutes behind `now`. An absent or unreadable time is never called behind. */
export function isBehind(dataAsOf: string | null | undefined, now: Date): boolean {
  const t = timeOf(dataAsOf)
  return t !== null && now.getTime() - t > BEHIND_AFTER_MINUTES * MINUTE
}

// ── 827: the model's marks — "may still rise" on young days, and each measure's caveat ────────────────

const DAY = 86_400_000
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/

/** An ISO day (or the date of a timestamp as written) as a UTC day number; `null` when it is not a day. */
const dayNumber = (value: string | null | undefined): number | null => {
  const m = value ? ISO_DAY.exec(value) : null
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null
}
const isoDay = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10)

/**
 * Spec 819 §B: a day younger than the measure's `mayStillRiseDays`, counted back from the day of `dataAsOf`,
 * may still rise (late cancels, the claims' submission lag): with 8, the day of `dataAsOf` and the 7 before it.
 * No window, no `dataAsOf` or a value that is not a day marks nothing.
 */
export function mayStillRise(day: string | null | undefined, dataAsOf: string | null | undefined, days: number | null | undefined): boolean {
  const d = dayNumber(day)
  const asOf = dayNumber(dataAsOf)
  if (d === null || asOf === null || !days || days <= 0) return false
  return asOf - d < days
}

export interface PanelMarks {
  /** The distinct caveats of the panel's measures, in measure order (e.g. "inside OMS only"). */
  caveats: AnalyticsLabel[]
  /** The first day that may still rise, and the window that says so; `null` when none does. */
  stillRising: { from: string; days: number } | null
}

/**
 * A panel's marks from the model (819 §E, on report and board panels alike). The window is the longest of
 * its measures'. On a time axis the young days are the rows' own; without one, the answer's period counts:
 * it may still rise when its last day is young, from the later of its first day and the window's.
 */
export function panelMarks(definition: AnalyticsViewDefinition, result: AnalyticsQueryResult | undefined, model: AnalyticsModel): PanelMarks {
  const measures = definition.query.measures.map((k) => measureOf(model, k)).filter((m) => !!m)
  const caveats: AnalyticsLabel[] = []
  for (const m of measures) {
    const c = m.caveat
    if (c && (c.en || c.ar) && !caveats.some((x) => x.en === c.en && x.ar === c.ar)) caveats.push(c)
  }
  const days = Math.max(0, ...measures.map((m) => m.mayStillRiseDays ?? 0))
  if (!result || days <= 0) return { caveats, stillRising: null }
  const asOf = dayNumber(result.dataAsOf)
  if (asOf === null) return { caveats, stillRising: null }
  const time = definition.query.dimensions.find((d) => dimensionOf(model, d)?.kind === 'time')
  let from: number | null = null
  if (time) {
    for (const row of result.rows) {
      const v = row[time]
      const n = typeof v === 'string' && mayStillRise(v, result.dataAsOf, days) ? dayNumber(v) : null
      if (n !== null && (from === null || n < from)) from = n
    }
  } else if (result.period && mayStillRise(result.period.to, result.dataAsOf, days)) {
    from = Math.max(dayNumber(result.period.from) ?? -Infinity, asOf - days + 1)
  }
  return { caveats, stillRising: from === null ? null : { from: isoDay(from), days } }
}

/** "Fetched N ago", as a `boards:panel.fetched.<key>` with its count; `null` when there is no time. */
export type FetchedAgo = { key: 'justNow' | 'minutes' | 'hours' | 'days'; n: number }

export function fetchedAgo(fetchedAt: string | null | undefined, now: Date): FetchedAgo | null {
  const t = timeOf(fetchedAt)
  if (t === null) return null
  const minutes = Math.floor((now.getTime() - t) / MINUTE)
  if (minutes < 1) return { key: 'justNow', n: 0 }
  if (minutes < 60) return { key: 'minutes', n: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'hours', n: hours }
  return { key: 'days', n: Math.floor(hours / 24) }
}

/**
 * What a failed answer shows (766 §C): `ANALYTICS-408` (past 30 s) and `-409` (the engine unreachable)
 * are the panel's retry state, while its neighbours keep going; `-410` is the area's unavailable reason;
 * anything else is a refusal in its own words (`Refused`).
 */
export type PanelFailure = 'retry' | 'unavailable' | 'retired' | 'refused'

/** `field`: the member a refusal names (`data.field`, ⚠ as `./editor-refusal` reads it); a 406 naming one is retired. */
export function panelFailure(code: string | null | undefined, field?: string | null): PanelFailure {
  if (code === 'ANALYTICS-408' || code === 'ANALYTICS-409') return 'retry'
  if (code === 'ANALYTICS-410') return 'unavailable'
  if (code === 'ANALYTICS-406' && field) return 'retired'
  return 'refused'
}

/**
 * The members a definition names that the model no longer holds (766 §B: "a definition that still names a
 * removed member renders a 'this measure was retired' panel and never fails the board"), measures first.
 * Such a panel is not asked at all: it shows the retired state while the rest of the board runs.
 */
export function retiredMembers(definition: AnalyticsViewDefinition, model: AnalyticsModel): string[] {
  return [
    ...definition.query.measures.filter((k) => !measureOf(model, k)),
    ...definition.query.dimensions.filter((k) => !dimensionOf(model, k)),
  ]
}

/** The field a refusal names, for {@link panelFailure}; `null` when it names none. */
export function refusalField(data: unknown): string | null {
  const field = data && typeof data === 'object' ? (data as Record<string, unknown>).field : undefined
  return typeof field === 'string' && field ? field : null
}

/**
 * The parameter an `ANALYTICS-412` names (823, spec 819 §C: "names the parameter in the strip"): ⚠ read
 * from `data.param`, else `data.field` as the other refusals name theirs. `null` for any other code.
 */
export function refusedParam(code: string | null | undefined, data: unknown): string | null {
  if (code !== 'ANALYTICS-412' || !data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const name = typeof d.param === 'string' && d.param ? d.param : d.field
  return typeof name === 'string' && name ? name : null
}

/** The model's own reason the view's area is not available yet, or `null` (the server's message stands). */
export function unavailableReason(definition: AnalyticsViewDefinition, model: AnalyticsModel): string | null {
  for (const key of definition.query.measures) {
    const area = model.areas.find((a) => a.key === measureOf(model, key)?.area)
    if (area && !area.available && area.unavailableReason) return area.unavailableReason
  }
  return null
}

/**
 * A panel's permalink: the page's URL as it stands — on a board that is the board filters, the
 * cross-filter and whatever else the query string carries (the query string IS the permalink) — with the
 * panel as its fragment (`#panel-<id>`), which the board scrolls to on open. A view page's is its URL.
 */
export function panelPermalink(href: string, panelId?: string): string {
  const url = new URL(href)
  url.hash = panelId ? `panel-${panelId}` : ''
  return url.toString()
}
