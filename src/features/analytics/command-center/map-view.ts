/**
 * The kingdom map's pure half (oms 947, BackOffice spec 4165 "The kingdom map"): what the map and the region table show
 * under a filter. Each pharmacy is a point in its stored colour for the filter, each region a shape in the server's
 * shade step for it, each region a row with the server's counts for it. The filter only picks a column of what the
 * server sent: the page chooses no colour and computes no figure (decisions §5).
 *
 * Only a pharmacy's code and coordinates reach Google (spec 4165, ADR 0139): the points carry nothing else.
 */
import type { MapPoint, MapPolygon, MapView } from '@/core/map/map-panel'
import type { CcColour, CcFilter, CcMapPoint, CcRegionKey, CommandCenterHome } from '@/core/models/command-center'
import boundaries from './regions/ksa-bh-regions.json'

/** A region's shape from the front end's boundary file (`tools/command-center-regions.py`; geoBoundaries, CC BY 4.0). */
export interface RegionShape {
  region: CcRegionKey
  rings: readonly (readonly (readonly [number, number])[])[]
}

export const REGION_SHAPES: readonly RegionShape[] = (boundaries.regions as unknown as { region: string; rings: [number, number][][] }[]).map((r) => ({
  region: r.region,
  rings: r.rings,
}))

/** A stored colour's point ink: the status tokens (the contrast gate holds each on the map's light ground). */
export const POINT_INK: Readonly<Record<CcColour, string>> = Object.freeze({ green: '--success', amber: '--attention', red: '--danger' })

/** A pharmacy not scored under the filter: hollow, in the map's neutral grey. */
export const NOT_SCORED_INK = '--map-same'

/** A region's fill for the server's step: none flagged reads as the neutral, then the five shades of the map scale. */
export const SHADE_FILL = ['--map-none', '--map-scale-1', '--map-scale-2', '--map-scale-3', '--map-scale-4', '--map-scale-5'] as const

/** The whole zoom from which the pharmacies are drawn as points; zoomed further out, only the regions show. */
export const POINTS_FROM_ZOOM = 6

/** A row of the region table under the filter. */
export interface RegionTableRow {
  region: CcRegionKey
  name: string
  scored: number
  flagged: number
  share: string
}

export interface KingdomView {
  points: MapPoint[]
  polygons: MapPolygon[]
  rows: RegionTableRow[]
}

/** A point Google can place: both coordinates are numbers. A pharmacy without them is counted under the map, never drawn. */
const placed = (p: CcMapPoint): boolean => Number.isFinite(p.lat) && Number.isFinite(p.lon)

/** The map's points, shapes and the table's rows under `filter`, in the server's order. */
export function kingdomView(home: Pick<CommandCenterHome, 'points' | 'regions'>, filter: CcFilter, shapes: readonly RegionShape[] = REGION_SHAPES): KingdomView {
  const points = home.points.filter(placed).map((p): MapPoint => {
    const colour = p.colour[filter]
    return colour ? { id: p.storeCode, lon: p.lon, lat: p.lat, ink: POINT_INK[colour] } : { id: p.storeCode, lon: p.lon, lat: p.lat, ink: NOT_SCORED_INK, hollow: true }
  })
  const shade = new Map(home.regions.map((r) => [r.region, r.byFilter[filter].shade]))
  const polygons = shapes.map((s): MapPolygon => ({ id: s.region, rings: s.rings, fill: SHADE_FILL[shade.get(s.region) ?? 0] }))
  const rows = home.regions.map((r): RegionTableRow => {
    const { scored, flagged, share } = r.byFilter[filter]
    return { region: r.region, name: r.name, scored, flagged, share }
  })
  return { points, polygons, rows }
}

/** Selecting a region zooms to it: the box that holds its shape. Null for a region the boundary file does not draw. */
export function regionView(region: CcRegionKey, shapes: readonly RegionShape[] = REGION_SHAPES): MapView | null {
  const at = shapes.find((s) => s.region === region)?.rings.flat() ?? []
  if (at.length === 0) return null
  const lons = at.map(([lon]) => lon)
  const lats = at.map(([, lat]) => lat)
  return { kind: 'bounds', west: Math.min(...lons), south: Math.min(...lats), east: Math.max(...lons), north: Math.max(...lats) }
}
