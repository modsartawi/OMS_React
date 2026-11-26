import {
  cardAfter,
  featuresAt,
  GROUP_LABEL_INK,
  lineFeatures,
  openingZoom,
  RING_INK,
  ringFeatures,
  type MapCardState,
  type MapFeature,
  type MapGrouping,
  type MapLine,
  type MapLineFeature,
  type MapPoint,
  type MapRing,
  type MapRingFeature,
  type MapTarget,
} from './map-drawing'

export type { MapCard, MapCardState, MapFeature, MapGrouping, MapLine, MapLineFeature, MapPoint, MapRing, MapRingFeature, MapTarget } from './map-drawing'

/**
 * The map panel's own logic (ticket 879, BackOffice spec 3630 M28, M29, M33-M35; ticket 908, ADR 0139): what it hands the
 * map engine and what it signals back. Pure: no React, no DOM, no Google. The engine is a port ({@link MapEngine}) so the
 * tests drive a stand-in and `./google-engine` is the one place Google Maps is touched.
 */

/**
 * The model's `maps` part (BackOffice 3986): Google's browser key, and the map ID made in the key's Google project when
 * one is served. Configuration on the server, never in this code or the build. Absent or an empty key: the map cannot be
 * drawn (`no-key`) and the caller shows the table.
 */
export interface MapsAccess {
  key: string
  mapId?: string
}

/** The region Google draws the map for: Saudi Arabia, so the borders are KSA's and the Gulf is the "Arabian Gulf" (M33). */
export const MAP_REGION = 'SA'

/** The view the map opens on. */
export type MapView =
  /** Fitted to the box that holds every point. */
  | { kind: 'bounds'; west: number; south: number; east: number; north: number }
  /** One place (every point on it): centred, at a fixed zoom, since a box of no size has no fit. */
  | { kind: 'centre'; lon: number; lat: number; zoom: number }

/** The box a map with no point opens on: KSA and Bahrain (spec 3630 M8). */
export const KSA_BH_BOX: MapView = { kind: 'bounds', west: 34, south: 15, east: 56, north: 33 }

/**
 * The zoom one point opens at: streets and districts are named. BackOffice 3634 measured zoom 13 on MapLibre's 512-pixel
 * tiles; Google's tiles are 256 pixels, so the same ground at the same size is one zoom further in (review G8).
 */
export const SINGLE_POINT_ZOOM = 14

/** What the panel hands the engine. */
export interface MapEngineStart {
  /** Where to draw. Opaque here (an `HTMLElement` in the browser). */
  container: unknown
  view: MapView
  /** Google's browser key, from the model's `maps` part. Never empty: with no key the engine is not started. */
  key: string
  /** The map ID from the model's `maps` part, when served. */
  mapId?: string
  /** Where the zoom buttons stand: the top corner at the reading end. Physical corners. */
  controlsCorner: 'top-left' | 'top-right'
  /**
   * What to draw at a zoom (881, 909): each point at its size and colour, nearby points joined into groups that never
   * overlap on Google's map. The one source of the groups: the engine asks again whenever the whole-number zoom changes,
   * and a tap, a group's opening zoom and the card's fold are all read against the same features.
   */
  featuresAt(zoom: number): MapFeature[]
  /** The resolved ink of a group's words. */
  labelInk: string
  /** The screen's language: Google's labels are in it. */
  lang: MapLang
  /**
   * The lines to draw beneath the points (922), in the order given, colours resolved. The panel always hands the
   * list, empty when the caller gave none; absent is read as empty.
   */
  lines?: MapLineFeature[]
  /** The rings to draw beneath the points (964), colours resolved. Absent is read as none. */
  rings?: MapRingFeature[]
  /** The customer's pin (964), above every point, colours resolved. Absent: none. */
  pin?: MapPinFeature
}

/**
 * The customer's pin (964, spec 4354 §12, §19): one place drawn as a diamond above every store, that a drag moves. Its
 * colour is a token name; its words are its accessible name and its tooltip.
 */
export interface MapPin {
  lon: number
  lat: number
  ink: string
  label: string
}

/** The pin as the engine draws it: its colours resolved, and whether a drag moves it. */
export interface MapPinFeature {
  lon: number
  lat: number
  fill: string
  stroke: string
  label: string
  draggable: boolean
}

/** What the engine reports back. */
export interface MapEngineEvents {
  /**
   * Google reports the map's tiles loaded (`tilesloaded`). The engine puts the points on the map before it can report
   * anything, so with {@link idle} this is "drawn" (M37).
   */
  tilesLoaded(): void
  /** Google reports the map idle (`idle`): nothing left to move or draw for now. */
  idle(): void
  /**
   * The map cannot be drawn: Google refused the key or the page (`gm_authFailure`: the key or the referrer refused, the
   * API not enabled, billing off), Google's script failed or did not arrive in time (`unreachable`), or the map could not
   * start at all (`no-graphics`).
   */
  failed(reason: EngineFailure): void
  /** The pointer moved over a feature (its id from {@link MapEngineStart.featuresAt}), or off every feature (null). */
  pointer(target: MapTarget | null, zoom: number): void
  /**
   * A click or a tap on a feature, or on the map beside every feature (null). A click beside carries the place under it
   * when the engine can tell one (962: "a click places the customer"); a tap on a feature carries none that matters.
   */
  tap(target: MapTarget | null, zoom: number, place?: MapPlace): void
  /** The map moved (a pan, a zoom): a card on show follows its store (review W4). */
  moved(zoom: number): void
  /**
   * The map's box has this size, in pixels: once when the map has loaded, then on every resize (review W2). A map started
   * in a box with no size yet (a dialog still opening) is fitted to its points when the box gets one.
   */
  sized(width: number, height: number): void
  /**
   * The customer's pin was dragged and dropped at this place (964). Told once, on the drop, never while dragging: the
   * run plans again on the drop. Optional for an engine that draws no pin.
   */
  pinMoved?(place: MapPlace): void
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
  /**
   * Starts drawing: fetches Google's script on the first map of the page, then draws. Throws when the engine cannot start
   * at all; what fails later (the script, the key) arrives as {@link MapEngineEvents.failed}.
   */
  start(start: MapEngineStart, events: MapEngineEvents): MapEngineRunning
}

export type MapLang = 'en' | 'ar'

/** A place on the map, as a click reports it (962). */
export interface MapPlace {
  lon: number
  lat: number
}

/** Why the engine could not draw. */
export type EngineFailure = 'refused' | 'unreachable' | 'no-graphics'

/** Why the panel cannot draw: the engine's reasons, and `no-key` (no `maps` part, or an empty key: Google never asked). */
export type CannotDrawReason = 'no-key' | EngineFailure

export interface OpenMapPanel {
  engine: MapEngine
  container: unknown
  points: readonly MapPoint[]
  /** Lines between places (922): a case's legs. Absent: none. The view opens on the points and every line's ends. */
  lines?: readonly MapLine[]
  /** Rings round a place (964): the customer's 5 km and 10 km. Absent: none. They do not widen the view. */
  rings?: readonly MapRing[]
  lang: MapLang
  dir: 'ltr' | 'rtl'
  /** The model's `maps` part (BackOffice 3986), as the caller holds it. Absent, null or an empty key: `no-key`. */
  maps: MapsAccess | null | undefined
  onDrawn(): void
  onCannotDraw(reason: CannotDrawReason): void
  /** A colour token's value on the page (the engine takes a colour, not a CSS variable). Absent: the token as written. */
  inkOf?: (token: string) => string
  /** How groups read (881). Absent: a group shows its count only. */
  grouping?: MapGrouping | null
  /**
   * Whether nearby points join into groups (881, 909). Absent or true: they do, as on every map before. False (spec 4050
   * review 4, a case's route): each point stays its own at every zoom, so no group disc lies over a short leg.
   */
  groupNearby?: boolean
  /** The card to show changed (881, M23): whose, where, pinned or not; null hides it. */
  onCard?(card: MapCardState): void
  /**
   * A click on the map beside every point, at this place (ticket 962, spec 4354 §19: "a click places the customer").
   * A click on a store is that store's, and places nothing. Absent: a click beside only closes a card, as before.
   */
  onPlace?(place: MapPlace): void
  /** The customer's pin (964), drawn above every point. Absent or null: none. The view opens on it with the points. */
  pin?: MapPin | null
  /** The pin was dragged and dropped here (964). Absent: the pin is drawn but cannot be dragged. */
  onPinMoved?(place: MapPlace): void
}

/** The view that holds every point (and every line's two ends, 922: pass them as places). */
export function fittedView(points: readonly { lon: number; lat: number }[]): MapView {
  if (points.length === 0) return KSA_BH_BOX
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
 * - **drawn**, once Google has reported both its tiles loaded and the map idle, the points on it (908, M37). The print
 *   page waits on it (883). A later repaint (a pan, a zoom) signals nothing more.
 * - **cannot draw**, with its reason, so the caller can show the table instead (882, 883): no key (Google is then never
 *   asked), the key or the page refused, Google's script unreachable, or the map unable to start. A refusal after "drawn"
 *   still signals it: Google then greys the map out, which is not a drawn map (review W9). (Google's raster map draws
 *   no WebGL canvas, so it has no lost-graphics ending: review G8 took MapLibre's out.)
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
  const key = open.maps?.key?.trim() ?? ''
  if (key === '') {
    open.onCannotDraw('no-key')
    return { close: () => {} }
  }
  const lines = open.lines ?? []
  const pin = open.pin ?? null
  const view = fittedView([...open.points, ...lines.flatMap((l) => [l.from, l.to]), ...(pin ? [pin] : [])])
  let tilesLoaded = false
  let idle = false
  const drawnWhenBoth = () => {
    if (tilesLoaded && idle) end(open.onDrawn, 'drawn')
  }
  // A drawn map that is refused is no longer drawn: it ends again, as cannot-draw (review W9).
  const fail = (reason: EngineFailure) => {
    if (state === 'drawn' && reason !== 'unreachable') {
      state = 'ended'
      open.onCannotDraw(reason)
      return
    }
    end(() => open.onCannotDraw(reason))
  }
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
    if (!f) drawn.set(z, (f = featuresAt(open.points, z, open.grouping ?? null, inkOf, open.groupNearby !== false)))
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
        view,
        key,
        ...(open.maps?.mapId ? { mapId: open.maps.mapId } : {}),
        controlsCorner: open.dir === 'rtl' ? 'top-left' : 'top-right',
        featuresAt: featuresOf,
        labelInk: inkOf(GROUP_LABEL_INK),
        lang: open.lang,
        lines: lineFeatures(lines, inkOf),
        rings: ringFeatures(open.rings ?? [], inkOf),
        ...(pin
          ? { pin: { lon: pin.lon, lat: pin.lat, fill: inkOf(pin.ink), stroke: inkOf(RING_INK), label: pin.label, draggable: !!open.onPinMoved } }
          : {}),
      },
      {
        tilesLoaded: () => {
          tilesLoaded = true
          drawnWhenBoth()
        },
        idle: () => {
          idle = true
          drawnWhenBoth()
        },
        failed: fail,
        // A group has no card: pointing at one is pointing at no store.
        pointer: (target, zoom) => cardOn({ kind: 'point', target: featureOf(target, zoom)?.kind === 'point' ? target : null }),
        tap: (target, zoom, place) => {
          const f = featureOf(target, zoom)
          // A click on a group zooms in, centred on it, to where it opens (M19).
          if (f?.kind === 'group') {
            running?.zoomTo(f.lon, f.lat, openingZoom(open.points, f.members ?? [], zoom, open.grouping ?? null))
            return
          }
          cardOn({ kind: 'tap', target: f ? target : null })
          // 962: a click beside every point places the customer there.
          if (!f && place && state !== 'closed') open.onPlace?.(place)
        },
        // 964: the pin's drop is the caller's, until the panel is closed.
        pinMoved: (place) => {
          if (state !== 'closed') open.onPinMoved?.(place)
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
