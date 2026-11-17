/**
 * What the map panel draws (ticket 881, BackOffice spec 3630 M15-M20, M23): each point at its size and colour, nearby
 * stores joined into one group at a zoom, and the card a point shows. Pure: no React, no DOM, no MapLibre — the engine
 * is handed the features this module makes ({@link MapFeature}) and draws them as given.
 *
 * The panel compares no value with an edge (M18): a point arrives with its share of the size range, its hollow mark and
 * its colour token already chosen by the caller from the server's legend. The one figure the panel makes is a group's
 * sum, and only when the caller says the size adds up (M20).
 */

/** One point to draw: a store's id and where it stands, and how it is drawn. */
export interface MapPoint {
  id: string
  lon: number
  lat: number
  /** Its share of the size range, 0 (the legend's smallest) to 1 (its largest). Absent: the plain point of 879. */
  size?: number
  /** Drawn as the smallest point, with no fill (the server's `hollow`: zero, negative or empty, M15). */
  hollow?: boolean
  /** Its colour, as a token name (`--map-better`). Absent: the one colour of a one-measure map. */
  ink?: string
  /** Its size figure as the server sent it, for a group's sum (M20). Null or absent adds nothing. */
  weight?: number | null
  /** What its card says (M23). Absent: no card. */
  card?: MapCard
}

/** A point's card: the store's name and city, and its figures already formatted as the table formats them. */
export interface MapCard {
  title: string
  subtitle: string
  figures: { label: string; value: string }[]
}

/** How groups read (M19, M20). */
export interface MapGrouping {
  /** The size measure adds up: a group also shows its sum. False for a rate: the count only. */
  sums: boolean
  /** A group's sum in words (Latin digits, M19). */
  formatSum(n: number): string
}

/** What the engine draws: one point, or one group of points. Colours are resolved values, not tokens. */
export interface MapFeature {
  /** The point's id, or the group's own id. */
  id: string
  kind: 'point' | 'group'
  lon: number
  lat: number
  radius: number
  fill: string
  /** 0 for a hollow point. */
  fillOpacity: number
  stroke: string
  strokeWidth: number
  /** A group's words: its count, then its sum on a second line when the size adds up. A point's is empty. */
  label: string
  /** A group's members' ids, in the order given. */
  members?: string[]
}

/** The point radii in pixels: the smallest and the largest value of the legend, and the plain point of 879. */
export const POINT_RADIUS = { min: 4, max: 20, plain: 6 } as const

/** A group's smallest radius in pixels: a count alone fits it. */
export const GROUP_RADIUS = 16

/** How a group's words are set (the engine draws them so): the font size in pixels, and the line height in ems. */
export const GROUP_LABEL_TEXT = { size: 11, lineHeight: 1.1 } as const

/**
 * The widest a character of a group's words is taken to be, in ems: above Noto Sans's digits (0.57), its `K` and the
 * Arabic letters of a sum's word, so the estimate errs on the wide side and the words never reach the circle's edge.
 */
const LABEL_CHAR_EM = 0.62

/** Room left between the words and the circle's edge, in pixels. */
const LABEL_INSET_PX = 2

/**
 * A group's radius for its words (884 shots): the smallest radius, grown until the circle reaches past every corner of
 * the words' box, so a long sum ("120.5K", "92 ألف") sits inside its group in either language. Still one neutral colour.
 */
export function groupRadius(label: string): number {
  const lines = label.split('\n')
  const width = Math.max(...lines.map((l) => [...l].length)) * LABEL_CHAR_EM * GROUP_LABEL_TEXT.size
  const height = lines.length * GROUP_LABEL_TEXT.size * GROUP_LABEL_TEXT.lineHeight
  return Math.max(GROUP_RADIUS, Math.ceil(Math.hypot(width / 2, height / 2) + LABEL_INSET_PX))
}

/** Points closer than this on screen, in pixels, join into one group. */
export const GROUP_DISTANCE_PX = 40

/** At this zoom and past it nothing joins: every store is its own point, even two at one address. */
export const MAX_GROUP_ZOOM = 18

/** The one colour of a one-measure map (and of a point given no colour). */
export const PLAIN_INK = '--chart-1'

/** A group's one neutral colour (M19), whatever its members' steps. */
export const GROUP_INK = '--map-group'

/** The ink of a group's words, on {@link GROUP_INK}. */
export const GROUP_LABEL_INK = '--map-group-ink'

/** The ring round a filled point, so a light step still has an edge on the grey base map. */
export const RING_INK = '--map-ring'

/** The ring round a group. */
export const GROUP_RING_INK = '--card'

/** A point's radius for its share of the size range: by AREA, so the eye reads the value from the size (M15). */
export function pointRadius(share: number): number {
  const t = Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0))
  const a = POINT_RADIUS.min ** 2
  const b = POINT_RADIUS.max ** 2
  return Math.sqrt(a + t * (b - a))
}

/** A point projected to web-mercator pixels at a zoom (MapLibre's 512-pixel tiles). */
function pixelOf(p: MapPoint, zoom: number): { x: number; y: number } {
  const world = 512 * 2 ** zoom
  const phi = (Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180
  return {
    x: ((p.lon + 180) / 360) * world,
    y: ((1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2) * world,
  }
}

export type MapGroupOrPoint = { kind: 'point'; point: MapPoint } | { kind: 'group'; id: string; lon: number; lat: number; members: MapPoint[] }

/**
 * The points as the reader sees them at a zoom: each point within {@link GROUP_DISTANCE_PX} of an earlier, unjoined
 * point joins its group; a point with no near neighbour stays a point. Greedy, in the order given, so the same points
 * group the same way every time. Past {@link MAX_GROUP_ZOOM} nothing joins.
 */
export function groupsAt(points: readonly MapPoint[], zoom: number): MapGroupOrPoint[] {
  const z = Math.floor(zoom)
  if (z >= MAX_GROUP_ZOOM) return points.map((point) => ({ kind: 'point', point }))
  const px = points.map((p) => pixelOf(p, z))
  // A grid of cells one group distance wide: a point's neighbours are in its own cell or the eight round it.
  const cells = new Map<string, number[]>()
  const cellOf = (i: number) => [Math.floor(px[i].x / GROUP_DISTANCE_PX), Math.floor(px[i].y / GROUP_DISTANCE_PX)]
  points.forEach((_, i) => {
    const [cx, cy] = cellOf(i)
    const key = `${cx}:${cy}`
    const list = cells.get(key)
    if (list) list.push(i)
    else cells.set(key, [i])
  })
  const taken = new Array<boolean>(points.length).fill(false)
  const out: MapGroupOrPoint[] = []
  for (let i = 0; i < points.length; i++) {
    if (taken[i]) continue
    taken[i] = true
    const members = [i]
    const [cx, cy] = cellOf(i)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (taken[j]) continue
          if (Math.hypot(px[j].x - px[i].x, px[j].y - px[i].y) <= GROUP_DISTANCE_PX) {
            taken[j] = true
            members.push(j)
          }
        }
    if (members.length === 1) {
      out.push({ kind: 'point', point: points[i] })
      continue
    }
    members.sort((a, b) => a - b)
    const ms = members.map((k) => points[k])
    out.push({
      kind: 'group',
      id: `group:${ms[0].id}:${ms.length}`,
      lon: ms.reduce((s, p) => s + p.lon, 0) / ms.length,
      lat: ms.reduce((s, p) => s + p.lat, 0) / ms.length,
      members: ms,
    })
  }
  return out
}

/** The first zoom past `zoom` at which these members are no longer one group: where a click on the group opens it. */
export function openingZoom(points: readonly MapPoint[], memberIds: readonly string[], zoom: number): number {
  const wanted = new Set(memberIds)
  for (let z = Math.floor(zoom) + 1; z < MAX_GROUP_ZOOM; z++) {
    const together = groupsAt(points, z).some((g) => g.kind === 'group' && g.members.length === wanted.size && g.members.every((m) => wanted.has(m.id)))
    if (!together) return z
  }
  return MAX_GROUP_ZOOM
}

/**
 * A group's sum: the size figures of its members as the server sent them, added (M20). The one place the panel adds.
 * A member with no figure adds nothing.
 */
export function groupSum(members: readonly MapPoint[]): number {
  let sum = 0
  for (const m of members) if (typeof m.weight === 'number' && Number.isFinite(m.weight)) sum += m.weight
  return sum
}

/** The features the engine draws at a zoom, with each colour token resolved by `inkOf`. */
export function featuresAt(points: readonly MapPoint[], zoom: number, grouping: MapGrouping | null, inkOf: (token: string) => string): MapFeature[] {
  return groupsAt(points, zoom).map((g): MapFeature => {
    if (g.kind === 'group') {
      const count = String(g.members.length)
      const label = grouping?.sums ? `${count}\n${grouping.formatSum(groupSum(g.members))}` : count
      return {
        id: g.id,
        kind: 'group',
        lon: g.lon,
        lat: g.lat,
        radius: groupRadius(label),
        fill: inkOf(GROUP_INK),
        fillOpacity: 1,
        stroke: inkOf(GROUP_RING_INK),
        strokeWidth: 2,
        label,
        members: g.members.map((m) => m.id),
      }
    }
    const p = g.point
    const ink = inkOf(p.ink ?? PLAIN_INK)
    const base = { id: p.id, kind: 'point' as const, lon: p.lon, lat: p.lat, fill: ink, label: '' }
    if (p.hollow) return { ...base, radius: POINT_RADIUS.min, fillOpacity: 0, stroke: ink, strokeWidth: 2 }
    return { ...base, radius: p.size === undefined ? POINT_RADIUS.plain : pointRadius(p.size), fillOpacity: 1, stroke: inkOf(RING_INK), strokeWidth: 1 }
  })
}

/** Where the engine reports a pointer or a tap: the feature under it, and the place on the panel in pixels. */
export interface MapTarget {
  id: string
  x: number
  y: number
  /**
   * The whole zoom the feature under the pointer was made at (review W8). The map's zoom moves on while its features
   * are redrawn, so an id is read against the features it came from. Absent: the zoom the event reports.
   */
  zoom?: number
}

/** The card on show: whose, where on the panel, and whether a tap pinned it. Null: no card. */
export type MapCardState = { id: string; x: number; y: number; pinned: boolean } | null

/**
 * The card after a pointer move or a tap (M23). Pointing at a store shows its card; pointing away hides it. A tap pins
 * it, and pointing elsewhere then leaves it; a tap elsewhere closes it, a tap on another store pins that one. The
 * target is a store, or null for none (the caller passes a group as none: a group has no card).
 */
export function cardAfter(state: MapCardState, event: { kind: 'point' | 'tap'; target: MapTarget | null }): MapCardState {
  const t = event.target
  if (event.kind === 'tap') return t ? { id: t.id, x: t.x, y: t.y, pinned: true } : null
  if (state?.pinned) return state
  return t ? { id: t.id, x: t.x, y: t.y, pinned: false } : null
}

/** How far the card stands from its point, in pixels. */
export const CARD_GAP_PX = 12

/**
 * Where a card stands on the panel (review W4): beside its point, below and after it; flipped to the other side of the
 * point on an axis where it would run past the panel's edge; and held inside the panel whatever the point's place (a
 * point panned off the panel keeps its card at the edge). Physical pixels, as the engine reports them.
 */
export function placeCard(
  at: { x: number; y: number },
  box: { width: number; height: number },
  card: { width: number; height: number },
): { left: number; top: number } {
  const along = (p: number, size: number, room: number) => {
    const after = p + CARD_GAP_PX
    const start = after + size <= room ? after : p - CARD_GAP_PX - size
    return Math.max(0, Math.min(start, room - size))
  }
  return { left: along(at.x, card.width, box.width), top: along(at.y, card.height, box.height) }
}
