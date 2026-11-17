import type { MapPoint } from '@/core/map/map-panel'
import type { AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'

/**
 * The map chart's own rules on the web (oms-react 880, BackOffice spec 3630 M13, M22-M26; the door is 3638). Pure: no
 * React, and no map code — the map itself is `@/core/map/LazyMapPanel`, fetched only when a map is on screen (M35).
 */

/** Which measure a map draws as each point's size, and which as its colour (none with one measure). */
export interface MapRoles {
  size: string | null
  colour: string | null
}

/** The first measure is the size, the second the colour (M13): the order the query holds is the choice. */
export function mapRoles(definition: AnalyticsViewDefinition): MapRoles {
  const [size = null, colour = null] = definition.query.measures
  return { size, colour }
}

/** The definition with the size and the colour swapped: its two measures in the other order. One measure is unchanged. */
export function swapMapMeasures(definition: AnalyticsViewDefinition): AnalyticsViewDefinition {
  const measures = definition.query.measures
  if (measures.length !== 2) return definition
  return { ...definition, query: { ...definition.query, measures: [measures[1], measures[0]] } }
}

/** The `place` columns that hold a store's coordinates on a map result (3638 `AnalyticsMapChart.PlaceKeys`). */
export const MAP_LATITUDE = 'latitude'
export const MAP_LONGITUDE = 'longitude'

/** A view is drawn as a map. */
export const drawsAsMap = (definition: AnalyticsViewDefinition): boolean => definition.chart.type === 'map'

const coordinate = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * The map panel's points: one per row that has both coordinates, named by its store (the result's dimension column).
 * A store with no coordinates is still a row of the answer (its table shows it) but is not on the map.
 */
export function mapPoints(result: AnalyticsQueryResult): MapPoint[] {
  const idKey = result.columns.find((c) => c.role === 'dimension')?.key ?? 'store'
  const points: MapPoint[] = []
  for (const row of result.rows) {
    const lat = coordinate(row[MAP_LATITUDE])
    const lon = coordinate(row[MAP_LONGITUDE])
    if (lat === null || lon === null) continue
    points.push({ id: String(row[idKey] ?? ''), lat, lon })
  }
  return points
}
