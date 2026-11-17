import type { MapPoint } from '@/core/map/map-panel'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { toTableView, type TableColumn, type TableView, type TableViewOptions } from './view-model-forms'

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

// ── 882 (BackOffice spec 3630 M21, M24): the stores not on the map, and the map as a table ─────────────────────────

/** A row is on the map only with both coordinates. */
const placed = (row: AnalyticsRow): boolean => coordinate(row[MAP_LATITUDE]) !== null && coordinate(row[MAP_LONGITUDE]) !== null

/** The `place` columns a table of the map's rows shows beside the store: its name and city (free text, as sent). */
export const MAP_STORE_NAME = 'store_name'
export const MAP_CITY = 'city'

/** The headers of the two text columns, in the screen's language. */
export interface MapTableWords extends TableViewOptions {
  storeName: string
  city: string
}

/**
 * The map's rows as a table (M24, "Show as table"; also the table drawn in place of the map): EVERY row of the result,
 * placed or not, sorted and formatted as the table chart shows them (`toTableView`: the first measure, largest first,
 * unless the view saved a sort) — never cut, since a map's top N is not a table's. The store, then its name and city,
 * then the measures; the coordinates and the legend columns (3639 `hollow`, `colour_step`) are the map's, not the reader's.
 */
export function mapTableView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
  words: MapTableWords,
): TableView {
  const { storeName, city, ...options } = words
  const asTable: AnalyticsViewDefinition = { ...definition, chart: { type: 'table', ...(definition.chart.sort ? { sort: definition.chart.sort } : {}) } }
  const view = toTableView(result, asTable, model, lang, options)
  const storeKey = definition.query.dimensions[0] ?? result.columns.find((c) => c.role === 'dimension')?.key ?? 'store'
  const byStore = new Map(result.rows.map((r) => [String(r[storeKey] ?? ''), r]))
  const text = (v: unknown): string => (v == null ? '' : String(v))
  const rows = view.rows.map((r, i) => {
    const source = byStore.get(view.members[i] ?? '')
    const { [storeKey]: store, ...rest } = r
    return { [storeKey]: store, [MAP_STORE_NAME]: text(source?.[MAP_STORE_NAME]), [MAP_CITY]: text(source?.[MAP_CITY]), ...rest }
  })
  const at = view.columns.findIndex((c) => c.key === storeKey) + 1
  const columns: TableColumn[] = [
    ...view.columns.slice(0, at),
    { key: MAP_STORE_NAME, role: 'dimension', label: storeName },
    { key: MAP_CITY, role: 'dimension', label: city },
    ...view.columns.slice(at),
  ]
  return { ...view, columns, rows }
}

/** The list the not-on-map line opens (M21): the rows with no coordinates, as the map's table shows them. */
export function notOnMapTableView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
  words: MapTableWords,
): TableView {
  return mapTableView({ ...result, rows: result.rows.filter((r) => !placed(r)) }, definition, model, lang, words)
}

/** What a map body shows, the line under it, and the switch it offers ("Show as table" / "Show as map"). */
export interface MapDisplay {
  shows: 'map' | 'table'
  line: 'notOnMap' | 'cannotDraw' | null
  switchTo: 'table' | 'map' | null
}

/**
 * - the panel cannot draw (879): the table, with "The map could not be drawn" — nothing to switch to;
 * - no row has coordinates: the table in place of the map, with the not-on-map line;
 * - "Show as table" chosen: the table, and a switch back to the map;
 * - otherwise the map, a switch to the table, and the not-on-map line when the SERVER counted any (`notOnMap`).
 */
export function mapDisplay({ placed: onMap, notOnMap, cannotDraw, asTable }: { placed: number; notOnMap: number; cannotDraw: boolean; asTable: boolean }): MapDisplay {
  if (cannotDraw) return { shows: 'table', line: 'cannotDraw', switchTo: null }
  if (onMap === 0) return { shows: 'table', line: notOnMap > 0 ? 'notOnMap' : null, switchTo: null }
  if (asTable) return { shows: 'table', line: null, switchTo: 'map' }
  return { shows: 'map', line: notOnMap > 0 ? 'notOnMap' : null, switchTo: 'table' }
}
