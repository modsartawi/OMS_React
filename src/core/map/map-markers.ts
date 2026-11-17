import { GROUP_LABEL_TEXT, POINT_RADIUS, type MapFeature } from './map-drawing'
import type { MapEngineEvents } from './map-panel'

/**
 * What the Google adapter puts on the map for each feature, and how it reports the reader's hits (ticket 909, BackOffice
 * spec 3630 M15-M20, M23; ADR 0139). Pure: no DOM, no Google — `./google-engine` makes one element per feature with
 * {@link markerLook}'s style and words, and routes its pointer and taps through {@link markerHits}.
 *
 * Markers are plain HTML elements on one Google `OverlayView`, which needs no map ID: the map stays raster with Google's
 * default style. (`AdvancedMarkerElement` would need one; classic `Marker` icons cannot carry a group's two lines.)
 */

/** One marker's look: the style of its element (CSS property names in camelCase), and a group's words. */
export interface MarkerLook {
  style: Record<string, string>
  label: string
}

/**
 * How a feature is drawn: a circle of its radius (`./map-drawing` decided it), its ring outside that radius as MapLibre's
 * circle stroke was (881), centred on its place. A hollow point has no fill. The larger lies beneath the smaller, so no
 * point hides another, and a group lies above every point, so a point never covers its words.
 */
export function markerLook(f: MapFeature, labelInk: string): MarkerLook {
  const diameter = `${2 * f.radius}px`
  const style: Record<string, string> = {
    position: 'absolute',
    boxSizing: 'content-box',
    width: diameter,
    height: diameter,
    borderRadius: '50%',
    background: f.fillOpacity === 0 ? 'transparent' : f.fill,
    border: `${f.strokeWidth}px solid ${f.stroke}`,
    transform: 'translate(-50%, -50%)',
    cursor: 'pointer',
    zIndex: String(f.kind === 'group' ? 1000 : Math.round(100 + POINT_RADIUS.max - f.radius)),
  }
  if (f.kind === 'group') {
    Object.assign(style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      whiteSpace: 'pre',
      color: labelInk,
      fontSize: `${GROUP_LABEL_TEXT.size}px`,
      lineHeight: String(GROUP_LABEL_TEXT.lineHeight),
      fontWeight: '500',
      userSelect: 'none',
    })
  }
  return { style, label: f.label }
}

/** A tap on the map this soon after a tap on a marker is that same tap, seen by the map too: it closes nothing. */
const SAME_TAP_MS = 400

/**
 * The reader's hits on the markers and on the map, reported to the panel as the engine's `pointer` and `tap` (M23).
 * Each marker hit carries the whole zoom its marker was drawn at (review W8); the place is in the panel's pixels.
 */
export function markerHits(events: Pick<MapEngineEvents, 'pointer' | 'tap'>, mapZoom: () => number, now: () => number = Date.now) {
  let markerTapAt = -Infinity
  return {
    enter(id: string, drawnZoom: number, at: { x: number; y: number }) {
      events.pointer({ id, x: at.x, y: at.y, zoom: drawnZoom }, mapZoom())
    },
    leave(_drawnZoom: number) {
      events.pointer(null, mapZoom())
    },
    click(id: string, drawnZoom: number, at: { x: number; y: number }) {
      markerTapAt = now()
      events.tap({ id, x: at.x, y: at.y, zoom: drawnZoom }, mapZoom())
    },
    /** A tap on the map beside every marker. */
    mapClick() {
      if (now() - markerTapAt < SAME_TAP_MS) return
      events.tap(null, mapZoom())
    },
  }
}
