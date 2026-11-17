import type { StyleSpecification } from 'maplibre-gl'
import { mapStyle, RTL_TEXT_PLUGIN_PATH } from './map-style'
import { cardAfter, featuresAt, GROUP_LABEL_INK, openingZoom, type MapCardState, type MapFeature, type MapGrouping, type MapPoint, type MapTarget } from './map-drawing'

export type { MapCard, MapCardState, MapFeature, MapGrouping, MapPoint, MapTarget } from './map-drawing'

/**
 * The map panel's own logic (ticket 879, BackOffice spec 3630 M28, M29, M33-M35; ADR 0135): what it hands the map
 * engine and what it signals back. Pure: no React, no DOM, no MapLibre. The engine is a port ({@link MapEngine}) so the
 * tests drive a stand-in and `./maplibre-engine` is the one place MapLibre is touched.
 */

/** The view the map opens on. */
export type MapView =
  /** Fitted to the box that holds every point. */
  | { kind: 'bounds'; west: number; south: number; east: number; north: number }
  /** One place (every point on it): centred, at a fixed zoom, since a box of no size has no fit. */
  | { kind: 'centre'; lon: number; lat: number; zoom: number }

/** The base map's box: KSA and Bahrain (spec 3630 M8; the release file of BackOffice 3634). */
export const BASEMAP_BOX: MapView = { kind: 'bounds', west: 34, south: 15, east: 56, north: 33 }

/** The zoom one point opens at: streets and districts are named (BackOffice 3634: zoom 13 draws them). */
export const SINGLE_POINT_ZOOM = 13

/** What the panel hands the engine. */
export interface MapEngineStart {
  /** Where to draw. Opaque here (an `HTMLElement` in the browser). */
  container: unknown
  points: readonly MapPoint[]
  view: MapView
  style: StyleSpecification
  /**
   * MapLibre's Arabic text-shaping add-on, on our own site. Loaded before the map draws on an Arabic screen; on an
   * English one deferred until a label in Arabic script needs it (a place with no English name).
   */
  rtlTextPlugin: { url: string; deferred: boolean }
  /** Where the zoom buttons stand: the top corner at the reading end. MapLibre's corners are physical. */
  controlsCorner: 'top-left' | 'top-right'
  /**
   * What to draw at a zoom (881): each point at its size and colour, nearby points joined into groups. The engine asks
   * again whenever the whole-number zoom changes.
   */
  featuresAt(zoom: number): MapFeature[]
  /** The resolved ink of a group's words. */
  labelInk: string
}

/** What the engine reports back. */
export interface MapEngineEvents {
  /** The base map's tiles and the points are painted. */
  painted(): void
  /** The base-map file could not be read (missing, refused, or not answered by byte range). */
  basemapUnreadable(): void
  /** The pointer moved over a feature (its id from {@link MapEngineStart.featuresAt}), or off every feature (null). */
  pointer(target: MapTarget | null, zoom: number): void
  /** A click or a tap on a feature, or on the map beside every feature (null). */
  tap(target: MapTarget | null, zoom: number): void
}

export interface MapEngine {
  /** Starts drawing. Throws when the engine cannot start at all (no graphics support). */
  start(start: MapEngineStart, events: MapEngineEvents): { destroy(): void; zoomTo(lon: number, lat: number, zoom: number): void }
}

export type MapLang = 'en' | 'ar'

export type CannotDrawReason = 'no-graphics' | 'basemap-unreadable'

export interface OpenMapPanel {
  engine: MapEngine
  container: unknown
  points: readonly MapPoint[]
  lang: MapLang
  dir: 'ltr' | 'rtl'
  /** The page's own origin: every file the map reads is under it. */
  origin: string
  onDrawn(): void
  onCannotDraw(reason: CannotDrawReason): void
  /** A colour token's value on the page (MapLibre takes a colour, not a CSS variable). Absent: the token as written. */
  inkOf?: (token: string) => string
  /** How groups read (881). Absent: a group shows its count only. */
  grouping?: MapGrouping | null
  /** The card to show changed (881, M23): whose, where, pinned or not; null hides it. */
  onCard?(card: MapCardState): void
}

/** The view that holds every point. */
export function fittedView(points: readonly MapPoint[]): MapView {
  if (points.length === 0) return BASEMAP_BOX
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const p of points) {
    west = Math.min(west, p.lon)
    east = Math.max(east, p.lon)
    south = Math.min(south, p.lat)
    north = Math.max(north, p.lat)
  }
  if (west === east && south === north) return { kind: 'centre', lon: west, lat: south, zoom: SINGLE_POINT_ZOOM }
  return { kind: 'bounds', west, south, east, north }
}

/**
 * Opens the panel: starts the engine and turns what it reports into the signals a caller waits on. Exactly one ending
 * is signalled:
 *
 * - **drawn**, after the engine reports the base map's tiles and the points painted. The print page waits on it (883).
 *   A later repaint (a pan, a zoom) signals nothing more.
 * - **cannot draw**, when the engine fails to start (no graphics support) or cannot read the base-map file, so the
 *   caller can show the table instead (882, 883).
 *
 * Nothing is signalled once the panel is closed.
 */
export function openMapPanel(open: OpenMapPanel): { close(): void } {
  let state: 'drawing' | 'ended' | 'closed' = 'drawing'
  const end = (signal: () => void) => {
    if (state !== 'drawing') return
    state = 'ended'
    signal()
  }
  let running: ReturnType<MapEngine['start']> | null = null
  const inkOf = open.inkOf ?? ((token: string) => token)
  // The features at each whole zoom, made once: the engine asks on every zoom change, and a tap reads them back.
  const drawn = new Map<number, MapFeature[]>()
  const featuresOf = (zoom: number) => {
    const z = Math.floor(zoom)
    let f = drawn.get(z)
    if (!f) drawn.set(z, (f = featuresAt(open.points, z, open.grouping ?? null, inkOf)))
    return f
  }
  const featureOf = (target: MapTarget | null, zoom: number) => (target ? featuresOf(zoom).find((f) => f.id === target.id) : undefined)
  let card: MapCardState = null
  const cardOn = (event: { kind: 'point' | 'tap'; target: MapTarget | null }) => {
    if (state === 'closed') return
    const next = cardAfter(card, event)
    if (next === card) return
    card = next
    open.onCard?.(card)
  }
  try {
    running = open.engine.start(
      {
        container: open.container,
        points: open.points,
        view: fittedView(open.points),
        style: mapStyle(open.lang, open.origin),
        rtlTextPlugin: { url: open.origin + RTL_TEXT_PLUGIN_PATH, deferred: open.lang !== 'ar' },
        controlsCorner: open.dir === 'rtl' ? 'top-left' : 'top-right',
        featuresAt: featuresOf,
        labelInk: inkOf(GROUP_LABEL_INK),
      },
      {
        painted: () => end(open.onDrawn),
        basemapUnreadable: () => end(() => open.onCannotDraw('basemap-unreadable')),
        // A group has no card: pointing at one is pointing at no store.
        pointer: (target, zoom) => cardOn({ kind: 'point', target: featureOf(target, zoom)?.kind === 'point' ? target : null }),
        tap: (target, zoom) => {
          const f = featureOf(target, zoom)
          // A click on a group zooms in, centred on it, to where it opens (M19).
          if (f?.kind === 'group') {
            running?.zoomTo(f.lon, f.lat, openingZoom(open.points, f.members ?? [], zoom))
            return
          }
          cardOn({ kind: 'tap', target: f ? target : null })
        },
      },
    )
  } catch {
    end(() => open.onCannotDraw('no-graphics'))
  }
  return {
    close: () => {
      state = 'closed'
      running?.destroy()
    },
  }
}
