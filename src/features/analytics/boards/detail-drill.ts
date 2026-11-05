import type { AnalyticsModel, AnalyticsViewDefinition, PeriodToken } from '@/core/models/analytics'
import { toIsoDate } from '@/core/util/date-format'
import type { MarkPoint } from './drill'
import { readPeriod } from './permalink'

/**
 * Drill to detail (spec 766 §F, ticket 774) — pure. A point hands off to an existing OMS screen BY ROUTE
 * STRING, under that screen's own grants and masking; analytics never imports the screen and never shows
 * its rows (755 item 2).
 *
 * - **Store → the Deliveries list**, filtered to that store and the panel's period. The list reads
 *   `store`, `from` and `to` once on entry (its URL entry, ticket 774's prefactor).
 * - **City → none.** The Deliveries list has no city criterion: neither its query bar nor its server door
 *   (`SdDocumentWeb/DeliveryDocumentList`) takes one, and adding one would change its saved-view bundles.
 *   §F: "or that drill is left out" (ruling recorded in ticket 774).
 * - **Till sales → none** (766 story 29): a panel showing any till measure offers no detail drill, and a
 *   measure outside the areas Deliveries holds records for (callouts → Dispatch, 783) does not hand off here.
 */

export const DELIVERIES_ROUTE = '/oms/deliveries'

/** The areas whose figures the Deliveries list holds the records behind. ⚠ ruling (774). */
const DELIVERIES_AREAS = new Set(['sales', 'delivery'])

/** A till measure: its key names the till (`till_value`). ⚠ the model carries no "has detail" flag. */
const isTillMeasure = (key: string) => key.startsWith('till_')

/** Local midnight `days` after (negative: before) `now`'s own day. */
const dayFrom = (now: Date, days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)

/** The relative token as two local days, Sunday weeks (as the server resolves it, 766 story 21). */
function tokenDays(token: PeriodToken, now: Date): { from: Date; to: Date } {
  const today = dayFrom(now, 0)
  const sunday = dayFrom(now, -now.getDay())
  switch (token) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: dayFrom(now, -1), to: dayFrom(now, -1) }
    case 'this-week':
      return { from: sunday, to: today }
    case 'last-week':
      return { from: dayFrom(sunday, -7), to: dayFrom(sunday, -1) }
    case 'last-7-days':
      return { from: dayFrom(now, -6), to: today }
    case 'last-28-days':
      return { from: dayFrom(now, -27), to: today }
    case 'last-30-days':
      return { from: dayFrom(now, -29), to: today }
    case 'this-month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today }
    case 'last-month':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) }
    case 'year-to-date':
      return { from: new Date(now.getFullYear(), 0, 1), to: today }
  }
}

/**
 * The panel's period (the wire's string: a relative token or `from..to`) as the two ISO days the
 * Deliveries list searches by, against `now`. A relative period resolves the way the list resolves its
 * own presets (today, yesterday, the last 7 days ending today, at local midnight). `null`: no range.
 */
export function periodDays(period: string | null | undefined, now: Date): { from: string; to: string } | null {
  const read = readPeriod(period)
  if (!read) return null
  if (read.kind === 'fixed') return { from: read.from, to: read.to }
  const { from, to } = tokenDays(read.token, now)
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

/** "See deliveries" for `point` on a panel showing `view`, or `null` when this point offers no such drill. */
export function deliveriesDrill(
  point: MarkPoint,
  view: AnalyticsViewDefinition,
  model: AnalyticsModel,
  period: string | null | undefined,
  now: Date,
): string | null {
  if (point.dimension !== 'store') return null
  const measures = view.query.measures
  if (measures.length === 0 || measures.some(isTillMeasure)) return null
  const areaOf = (key: string) => model.measures.find((m) => m.key === key)?.area
  if (!measures.every((k) => DELIVERIES_AREAS.has(areaOf(k) ?? ''))) return null
  const params = new URLSearchParams({ store: point.member })
  const days = periodDays(period, now)
  if (days) {
    params.set('from', days.from)
    params.set('to', days.to)
  }
  return `${DELIVERIES_ROUTE}?${params.toString()}`
}
