import { cardAfter, featuresAt, GROUP_LABEL_INK, openingZoom, type MapCardState, type MapFeature, type MapGrouping, type MapPoint, type MapTarget } from './map-drawing'

export type { MapCard, MapCardState, MapFeature, MapGrouping, MapPoint, MapTarget } from './map-drawing'

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

/** The zoom one point opens at: streets and districts are named (BackOffice 3634: zoom 13 draws them). */
export const SINGLE_POINT_ZOOM = 13

/** What the panel hands the engine. */
export interface MapEngineStart {
  /** Where to draw. Opaque here (an `HTMLElement` in the browser). */
  container: unknown
  points: readonly MapPoint[]
  view: MapView
  /** Google's browser key, from the model's `maps` part. Never empty: with no key the engine is not started. */
  key: string
  /** The map ID from the model's `maps` part, when served. */
  mapId?: string
  /** Always {@link MAP_REGION}. */
  region: typeof MAP_REGION
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
  /**
   * Starts drawing: fetches Google's script on the first map of the page, then draws. Throws when the engine cannot start
   * at all; what fails later (the script, the key) arrives as {@link MapEngineEvents.failed}.
   */
  start(start: MapEngineStart, events: MapEngineEvents): MapEngineRunning
}

export type MapLang = 'en' | 'ar'

/** Why the engine could not draw. */
export type EngineFailure = 'refused' | 'unreachable' | 'no-graphics'

/** Why the panel cannot draw: the engine's reasons, and `no-key` (no `maps` part, or an empty key: Google never asked). */
export type CannotDrawReason = 'no-key' | EngineFailure

export interface OpenMapPanel {
  engine: MapEngine
  container: unknown
  points: readonly MapPoint[]
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
  /** The card to show changed (881, M23): whose, where, pinned or not; null hides it. */
  onCard?(card: MapCardState): void
}

/** The view that holds every point. */
export function fittedView(points: readonly MapPoint[]): MapView {
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
 *   asked), the key or the page refused, Google's script unreachable, or the map unable to start. A refusal or lost
 *   graphics after "drawn" still signals it: Google then greys the map out, which is not a drawn map (review W9).
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
  const view = fittedView(open.points)
  let tilesLoaded = false
  let idle = false
  const drawnWhenBoth = () => {
    if (tilesLoaded && idle) end(open.onDrawn, 'drawn')
  }
  // A drawn map that is refused or loses its graphics is no longer drawn: it ends again, as cannot-draw (review W9).
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
        key,
        ...(open.maps?.mapId ? { mapId: open.maps.mapId } : {}),
        region: MAP_REGION,
        controlsCorner: open.dir === 'rtl' ? 'top-left' : 'top-right',
        featuresAt: featuresOf,
        labelInk: inkOf(GROUP_LABEL_INK),
        lang: open.lang,
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
        tap: (target, zoom) => {
          const f = featureOf(target, zoom)
          // A click on a group zooms in, centred on it, to where it opens (M19).
          if (f?.kind === 'group') {
            running?.zoomTo(f.lon, f.lat, openingZoom(open.points, f.members ?? [], zoom, open.grouping ?? null))
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
        graphicsLost: () => fail('no-graphics'),
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
