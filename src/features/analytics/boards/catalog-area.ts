import type { AnalyticsAreaReader, AnalyticsCatalogArea, AnalyticsItem, AnalyticsLabel } from '@/core/models/analytics'
import { ALL_ITEMS_PATH } from './library-pages'

/**
 * A catalog area's facts (ticket 842, BackOffice spec 3437 §C/§G, stories 22–26) — pure: no React, no i18n. The
 * Catalog's area detail draws these, and 845's print reuses them, so both say the same thing.
 *
 * - **data as of**: the freshness instant (Riyadh local, no zone) or `null` when not known (`''`, unreadable);
 * - **history**: a `yyyy-MM-dd` start, or `<N>d` ("400 days"), or unknown;
 * - **used by**: everyone's saved views, boards and reports using the area, each with a link to All my items
 *   narrowed to it (`?kind=…&area=…`), or `null` when the server could not count (never 0).
 */

export type AreaHistory = { kind: 'date'; day: string } | { kind: 'days'; days: number } | { kind: 'unknown' }

export interface AreaUsedBy {
  kind: AnalyticsItem['kind']
  count: number
  /** The library narrowed to this area's items of this kind. */
  href: string
}

export interface AreaFacts {
  dataAsOf: { day: string; at: string } | null
  history: AreaHistory
  refresh: AnalyticsLabel
  /** The area boundary: what it deliberately never contains. */
  boundary: AnalyticsLabel[]
  readers: AnalyticsAreaReader[]
  usedBy: AreaUsedBy[] | null
  /** Who may read it — the authorization id (today `AnalyticsView`). */
  grant: string
}

const DAY = /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/

export function historyOf(historyStart: string): AreaHistory {
  const s = historyStart.trim()
  const days = /^(\d+)d$/i.exec(s)
  if (days) return { kind: 'days', days: Number(days[1]) }
  const day = DAY.exec(s)
  return day ? { kind: 'date', day: day[1] } : { kind: 'unknown' }
}

/** The library (All my items) narrowed to one area's items of one kind. */
export function usedByHref(areaKey: string, kind: AnalyticsItem['kind']): string {
  const p = new URLSearchParams({ kind, area: areaKey })
  return `${ALL_ITEMS_PATH}?${p.toString()}`
}

export function areaFacts(area: AnalyticsCatalogArea): AreaFacts {
  const asOf = DAY.exec(area.dataAsOf.trim())
  const u = area.usedBy
  return {
    dataAsOf: asOf ? { day: asOf[1], at: area.dataAsOf.trim() } : null,
    history: historyOf(area.historyStart),
    refresh: area.refresh,
    boundary: area.boundary.filter((b) => b.en || b.ar),
    readers: area.readBy,
    usedBy: u
      ? [
          { kind: 'view', count: u.views, href: usedByHref(area.key, 'view') },
          { kind: 'board', count: u.boards, href: usedByHref(area.key, 'board') },
          { kind: 'report', count: u.reports, href: usedByHref(area.key, 'report') },
        ]
      : null,
    grant: area.access.grant,
  }
}
