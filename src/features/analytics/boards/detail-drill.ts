import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import type { MarkPoint } from './drill'
import { readPeriod } from './permalink'
import { resolvePeriod } from './periods'

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

/**
 * The panel's period (the wire's string: a relative token or `from..to`) as the two ISO days the
 * Deliveries list searches by, against `now`. A relative period resolves in Riyadh time, Sunday weeks, as the
 * server resolves the panel's own period (766 §C), not on the browser's clock. `null`: no range.
 */
export function periodDays(period: string | null | undefined, now: Date): { from: string; to: string } | null {
  const read = readPeriod(period)
  if (!read) return null
  if (read.kind === 'fixed') return { from: read.from, to: read.to }
  return resolvePeriod(read.token, now)
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
