import type { AnalyticsAccess, AnalyticsCatalogArea } from '@/core/models/analytics'
import { canAuthorAnalytics } from './access'
import { PREVIEW_PERIOD } from './catalog-preview'
import { newViewLink } from './editor'

/**
 * The Catalog's author actions (ticket 843, BackOffice spec 3437 §G, stories 49–51). Pure: no React.
 *
 * "New view from this" (story 49, agent ruling 5 as narrowed by the 3437 review): a measure or area node → the date by
 * day (the preview's axis). The measure is the node's own, else the area's first. The seed rides in route state
 * (`./editor` `newViewLink`).
 */
export function newViewFrom(area: AnalyticsCatalogArea, measure?: string) {
  const m = area.measures.find((x) => x.key === measure) ?? area.measures[0]
  const dimensions = m && m.dimensions.includes('date') ? ['date'] : []
  return newViewLink({
    definition: {
      chart: { type: 'line' },
      query: {
        measures: m ? [m.key] : [],
        dimensions,
        filters: [],
        period: PREVIEW_PERIOD,
        grain: dimensions.length > 0 ? 'day' : null,
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
