import type { AnalyticsAccess, AnalyticsCatalogArea } from '@/core/models/analytics'
import { canAuthorAnalytics } from './access'
import { PREVIEW_PERIOD } from './catalog-preview'
import { newViewLink } from './editor'

/**
 * The Catalog's author actions (ticket 843, BackOffice spec 3437 §G, stories 49–51). Pure: no React.
 *
 * "New view from this" (agent ruling 5): a dimension node → that dimension; a measure or area node → the date by day
 * (the preview's axis). The measure is the node's own, else the area's first (on a dimension node, the first that can
 * be cut by it). The seed rides in route state (`./editor` `newViewLink`).
 */
export function newViewFrom(area: AnalyticsCatalogArea, node: { measure?: string; dimension?: string }) {
  const byDay = !node.dimension
  const axis = node.dimension ?? 'date'
  const measure =
    area.measures.find((m) => m.key === node.measure) ??
    (byDay ? area.measures[0] : area.measures.find((m) => m.dimensions.includes(axis)) ?? area.measures[0])
  const dimensions = measure && measure.dimensions.includes(axis) ? [axis] : []
  return newViewLink({
    definition: {
      chart: { type: byDay ? 'line' : 'bar' },
      query: {
        measures: measure ? [measure.key] : [],
        dimensions,
        filters: [],
        period: PREVIEW_PERIOD,
        grain: byDay && dimensions.length > 0 ? 'day' : null,
      },
    },
  })
}

/**
 * Which author actions a node offers (story 51): both need the author grant, so a runner sees neither; "Ask about
 * this area" also needs the copilot probe (`@/core/copilot-panel` `available`), as the ask box does. Fails closed.
 */
export function catalogAuthorActions(probe: AnalyticsAccess | null | undefined, copilotAvailable: boolean): { newView: boolean; ask: boolean } {
  const author = canAuthorAnalytics(probe)
  return { newView: author, ask: author && copilotAvailable }
}
