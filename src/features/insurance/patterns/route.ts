/**
 * A case's route on the map (oms 922; BackOffice spec 4050 story 11, 14): what the map panel draws for one case. Pure:
 * the words come from the page (`t()`), the map from `@/core/map`.
 *
 * - **One point per store visited**, in the order first visited, sized by its dispenses (`FULL_SIZE_DISPENSES` and up
 *   draw at full size), its card counting them. A delivery's store is a point like any other.
 * - **The legs are the server's** (4053: between consecutive counter dispenses, each marked `counter`); the client never
 *   invents one, and draws none the server did not mark `counter`. Drawn in
 *   time order, each labelled with its number, its km (when known) and its time; a leg that fired the travel signal in
 *   the warning colour, drawn above the plain legs. The same two stores travelled more than once are ONE line (the
 *   legs would lie on each other), its words a line per leg in time order, warning-coloured when any of them fired.
 * - **A delivery or online dispense is a point with no leg in or out** (spec 4050: it says where the medicine left from,
 *   not where the patient stood) — even if a server listed such a leg.
 * - **A store without coordinates is not drawn**, its legs are skipped, and it is listed as not on the map. The legs
 *   table (`routeLegs`) still lists every leg, numbered as on the map.
 */
import type { MapCard, MapLine, MapPoint } from '@/core/map/map-panel'
import type { PatternCaseDetail, PatternCaseStore, PatternDispense, PatternLeg } from '@/core/models/insurance-patterns'

/**
 * The legs' colours. Travel is the map's own warning orange, `--map-worse`: light only like the map itself (spec 3630
 * M33) and contrast-gated on it — not `--attention`, which lightens in the dark theme and would wash out on Google's
 * light base map. A plain leg is the map's ring ink.
 */
export const LEG_TONE = { travel: '--map-worse', plain: '--map-ring' } as const

/** A store with this many dispenses or more is drawn at the map's full point size; fewer, smaller (by area). */
export const FULL_SIZE_DISPENSES = 5

/** The page's words for the route. */
export interface RouteWords {
  /** A leg's words: its number in time order, its km (null: not known) and its minutes. */
  leg(n: number, km: number | null, minutes: number): string
  /** A store's card on the map. */
  card(store: PatternCaseStore, counts: { dispenses: number; deliveries: number }): MapCard
}

/** One of the server's legs, with its two dispenses, numbered in time order. */
export interface RouteLegRow {
  n: number
  leg: PatternLeg
  from: PatternDispense | null
  to: PatternDispense | null
  /** The map draws it: a `counter` leg whose both ends are counter dispenses, at two stores, both with coordinates. */
  drawn: boolean
}

export interface CaseRoute {
  points: MapPoint[]
  lines: MapLine[]
  /** The stores the case touches that have no coordinates: not on the map. */
  unplaced: PatternCaseStore[]
}

type Place = { lon: number; lat: number }

/** What the route reads of a case: its stores, its dispenses and its legs (the rest of the case never moves the map). */
export type RouteSource = Pick<PatternCaseDetail, 'stores' | 'dispenses' | 'legs'>

const placesOf = (detail: RouteSource): Map<string, Place> => {
  const places = new Map<string, Place>()
  for (const s of detail.stores) {
    if (typeof s.lat === 'number' && typeof s.lon === 'number' && Number.isFinite(s.lat) && Number.isFinite(s.lon))
      places.set(s.storeCode, { lon: s.lon, lat: s.lat })
  }
  return places
}

/** Local ISO times without a zone sort as text; a time not known (a leg's dispense missing) sorts last. */
const cmp = (a: string | undefined, b: string | undefined) => (a === b ? 0 : a === undefined ? 1 : b === undefined ? -1 : a < b ? -1 : 1)
const byTime = (a: PatternDispense, b: PatternDispense) => cmp(a.at, b.at) || a.eventId - b.eventId

/** Every leg the server sent, in time order (by its first dispense, then its second), numbered from 1. */
export function routeLegs(detail: RouteSource): RouteLegRow[] {
  const byId = new Map(detail.dispenses.map((d) => [d.eventId, d]))
  const places = placesOf(detail)
  return detail.legs
    .map((leg) => ({ leg, from: byId.get(leg.fromEventId) ?? null, to: byId.get(leg.toEventId) ?? null }))
    .sort((a, b) => cmp(a.from?.at, b.from?.at) || cmp(a.to?.at, b.to?.at) || a.leg.fromEventId - b.leg.fromEventId)
    .map((row, i) => ({
      ...row,
      n: i + 1,
      drawn:
        row.leg.counter &&
        !!row.from &&
        !!row.to &&
        row.from.counter &&
        row.to.counter &&
        row.from.storeCode !== row.to.storeCode &&
        places.has(row.from.storeCode) &&
        places.has(row.to.storeCode),
    }))
}

/**
 * The legs listed under the route (review 9), so no leg the server sent is nowhere: every leg when there is no map to
 * read them on (it cannot draw, or has nothing to draw), else the legs the map does not draw (a store without
 * coordinates). Each keeps its number, so the list and the map count alike.
 */
export function legsBesideMap(rows: readonly RouteLegRow[], onMap: boolean): RouteLegRow[] {
  return onMap ? rows.filter((r) => !r.drawn) : [...rows]
}

/** The case as the map draws it. */
export function caseRoute(detail: RouteSource, words: RouteWords): CaseRoute {
  const places = placesOf(detail)
  const named = new Map(detail.stores.map((s) => [s.storeCode, s.storeName]))
  const storeOf = (code: string, fallback: string): PatternCaseStore => ({ storeCode: code, storeName: named.get(code) || fallback })

  // The stores visited, in the order first visited, with their counts.
  const visited = new Map<string, { store: PatternCaseStore; dispenses: number; deliveries: number }>()
  for (const d of [...detail.dispenses].sort(byTime)) {
    const v = visited.get(d.storeCode) ?? { store: storeOf(d.storeCode, d.storeName), dispenses: 0, deliveries: 0 }
    v.dispenses += 1
    if (!d.counter) v.deliveries += 1
    visited.set(d.storeCode, v)
  }

  const points: MapPoint[] = []
  for (const [code, v] of visited) {
    const place = places.get(code)
    if (!place) continue
    points.push({
      id: code,
      ...place,
      size: Math.min(v.dispenses, FULL_SIZE_DISPENSES) / FULL_SIZE_DISPENSES,
      card: words.card(v.store, { dispenses: v.dispenses, deliveries: v.deliveries }),
    })
  }

  const unplaced: PatternCaseStore[] = []
  const seen = new Set<string>()
  for (const store of [...[...visited.values()].map((v) => v.store), ...detail.stores.map((s) => storeOf(s.storeCode, s.storeName))]) {
    if (seen.has(store.storeCode)) continue
    seen.add(store.storeCode)
    if (!places.has(store.storeCode)) unplaced.push(store)
  }

  // One line per pair of stores, in the order its first leg was travelled.
  const pairs = new Map<string, { from: Place; to: Place; words: string[]; travel: boolean }>()
  for (const row of routeLegs(detail)) {
    if (!row.drawn || !row.from || !row.to) continue
    const a = row.from.storeCode
    const b = row.to.storeCode
    const pair = a < b ? `${a}|${b}` : `${b}|${a}`
    const line = pairs.get(pair) ?? { from: places.get(a)!, to: places.get(b)!, words: [], travel: false }
    line.words.push(words.leg(row.n, row.leg.km, row.leg.minutes))
    line.travel ||= row.leg.travel
    pairs.set(pair, line)
  }
  const lines: MapLine[] = [...pairs].map(([pair, l]) => ({
    id: `leg:${pair}`,
    from: l.from,
    to: l.to,
    tone: l.travel ? LEG_TONE.travel : LEG_TONE.plain,
    // A travel leg reads through the others: Hail, Buraydah and Riyadh lie nearly on one line.
    strong: l.travel,
    label: l.words.join('\n'),
  }))

  return { points, lines, unplaced }
}
