import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { measureOf } from './wire'

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
export type PanelFailure = 'retry' | 'unavailable' | 'refused'

export function panelFailure(code: string | null | undefined): PanelFailure {
  if (code === 'ANALYTICS-408' || code === 'ANALYTICS-409') return 'retry'
  if (code === 'ANALYTICS-410') return 'unavailable'
  return 'refused'
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
