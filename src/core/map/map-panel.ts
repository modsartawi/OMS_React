import type { StyleSpecification } from 'maplibre-gl'
import { BASEMAP_SOURCE, mapStyle, RTL_TEXT_PLUGIN_PATH } from './map-style'
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
  /** The screen's language: an Arabic map is painted only once its letters are shaped (review W6). */
  lang: MapLang
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
  /** The map moved (a pan, a zoom): a card on show follows its store (review W4). */
  moved(zoom: number): void
  /**
   * The map's box has this size, in pixels: once when the map has loaded, then on every resize (review W2). A map started
   * in a box with no size yet (a dialog still opening) is fitted to its points when the box gets one.
   */
  sized(width: number, height: number): void
  /** The browser took the map's graphics away (WebGL context lost): the canvas is blank (review W9). */
  graphicsLost(): void
}

/** The engine once started. */
export interface MapEngineRunning {
  destroy(): void
  zoomTo(lon: number, lat: number, zoom: number): void
  /** Shows a view again, at once (no animation). */
  fit(view: MapView): void
  /** Where a place stands on the panel now, in physical pixels. */
  project(lon: number, lat: number): { x: number; y: number }
}

export interface MapEngine {
  /** Starts drawing. Throws when the engine cannot start at all (no graphics support). */
  start(start: MapEngineStart, events: MapEngineEvents): MapEngineRunning
}

export type MapLang = 'en' | 'ar'

export type CannotDrawReason = 'no-graphics' | 'basemap-unreadable'

/**
 * Whether an engine error means the base-map file cannot be read (review W5): an error on the base map's own source that
 * is not about one tile — the file or its header not read. One tile failing leaves the rest of the map drawn.
 */
export function isBasemapUnreadable(e: { sourceId?: string; tile?: unknown; error?: unknown }): boolean {
  return e.sourceId === BASEMAP_SOURCE && e.tile == null
}

/** The text-shaping add-on's state, as MapLibre reports it (`unavailable`, `deferred`, `requested`, `loading`, `loaded`, `error`). */
export type RtlTextStatus = string

/**
 * Whether the map is painted (879; review W6): the base map's tiles and the points are in, and on an Arabic screen its
 * letters are shaped — the add-on has loaded (or failed to: unshaped labels are not an undrawn map). Until then the print
 * page would print Arabic labels unjoined. On an English screen the add-on is not waited for.
 */
export function isPainted(p: { tilesLoaded: boolean; basemapLoaded: boolean; pointsLoaded: boolean; lang: MapLang; rtl: RtlTextStatus }): boolean {
  if (!p.tilesLoaded || !p.basemapLoaded || !p.pointsLoaded) return false
  return p.lang !== 'ar' || p.rtl === 'loaded' || p.rtl === 'error'
}

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
  let state: 'drawing' | 'drawn' | 'ended' | 'closed' = 'drawing'
  const end = (signal: () => void, to: 'drawn' | 'ended' = 'ended') => {
    if (state !== 'drawing') return
    state = to
    signal()
  }
  const view = fittedView(open.points)
  // Review W2: whether the box had no size when the map started, and whether it has been fitted since.
  let sawNoSize = false
  let sized = false
  let running: MapEngineRunning | null = null
  const inkOf = open.inkOf ?? ((token: string) => token)
  // The features at each whole zoom, made once: the engine asks on every zoom change, and a tap reads them back.
  const drawn = new Map<number, MapFeature[]>()
  const featuresOf = (zoom: number) => {
    const z = Math.floor(zoom)
    let f = drawn.get(z)
    if (!f) drawn.set(z, (f = featuresAt(open.points, z, open.grouping ?? null, inkOf)))
    return f
  }
  // A target is read against the features it was drawn from (review W8): the zoom may have moved on since.
  const featureOf = (target: MapTarget | null, zoom: number) => (target ? featuresOf(target.zoom ?? zoom).find((f) => f.id === target.id) : undefined)
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
        view,
        style: mapStyle(open.lang, open.origin),
        rtlTextPlugin: { url: open.origin + RTL_TEXT_PLUGIN_PATH, deferred: open.lang !== 'ar' },
        controlsCorner: open.dir === 'rtl' ? 'top-left' : 'top-right',
        featuresAt: featuresOf,
        labelInk: inkOf(GROUP_LABEL_INK),
        lang: open.lang,
      },
      {
        painted: () => end(open.onDrawn, 'drawn'),
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
        // Review W4: a card stands by its store, not where the store was when it was pointed at. A store joined into a
        // group by a zoom out is no longer a point to stand by: its card closes.
        sized: (width, height) => {
          if (state === 'closed' || sized) return
          if (width <= 0 || height <= 0) {
            sawNoSize = true
            return
          }
          sized = true
          // The engine fitted the view to a box of no size, which fits nothing: fit it now the box has one.
          if (sawNoSize) running?.fit(view)
        },
        // Review W9: a drawn map whose graphics are lost is a blank canvas, so it too falls back to the table.
        graphicsLost: () => {
          if (state !== 'drawing' && state !== 'drawn') return
          state = 'ended'
          open.onCannotDraw('no-graphics')
        },
        moved: (zoom) => {
          if (state === 'closed' || !card || !running) return
          const p = featuresOf(zoom).find((f) => f.id === card?.id && f.kind === 'point')
          if (!p) {
            card = null
          } else {
            const at = running.project(p.lon, p.lat)
            if (at.x === card.x && at.y === card.y) return
            card = { ...card, x: at.x, y: at.y }
          }
          open.onCard?.(card)
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
