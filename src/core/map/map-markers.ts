import { GROUP_LABEL_TEXT, POINT_RADIUS, type MapFeature, type MapLineFeature } from './map-drawing'
import type { MapEngineEvents, MapPinFeature, MapPlace } from './map-panel'

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
      // The app's own face, which `./map-drawing`'s room for the words is measured against — not the Roboto Google's
      // `.gm-style` would otherwise hand down (review G8).
      fontFamily: GROUP_LABEL_TEXT.family,
      fontSize: `${GROUP_LABEL_TEXT.size}px`,
      lineHeight: String(GROUP_LABEL_TEXT.lineHeight),
      fontWeight: '500',
      userSelect: 'none',
    })
  }
  return { style, label: f.label }
}

/**
 * A line's words (922: a leg's km and time), drawn at the line's middle: a small card in the page's card colours, edged
 * in the line's own colour so a warning leg's words read as its, set in the app's face like a group's. They lie beneath
 * every point (a point is never hidden by a label), a strong line's above the others', and let the pointer through to
 * the map. A newline breaks them.
 */
export function lineLabelLook(line: MapLineFeature): MarkerLook {
  return {
    style: {
      position: 'absolute',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      textAlign: 'center',
      padding: '1px 6px',
      borderRadius: '6px',
      border: `1px solid ${line.stroke}`,
      background: 'var(--card)',
      color: 'var(--card-foreground)',
      fontFamily: GROUP_LABEL_TEXT.family,
      fontSize: `${GROUP_LABEL_TEXT.size}px`,
      lineHeight: '1.3',
      fontWeight: '500',
      zIndex: line.strong ? '51' : '50',
      userSelect: 'none',
    },
    label: line.label,
  }
}

/** A tap on the map this soon after a tap on a marker is that same tap, seen by the map too: it closes nothing. */
const SAME_TAP_MS = 400

/**
 * The reader's hits on the markers and on the map, reported to the panel as the engine's `pointer` and `tap` (M23).
 * Each marker hit carries the whole zoom its marker was drawn at (review W8); the place is in the panel's pixels.
 */
export function markerHits(events: Pick<MapEngineEvents, 'pointer' | 'tap'>, mapZoom: () => number, now: () => number = Date.now) {
  let markerTapAt = -Infinity
  // Whether the pointer is over a marker: the browser tells no `pointerleave` for an element taken off the page.
  let pointedAt = false
  return {
    enter(id: string, drawnZoom: number, at: { x: number; y: number }) {
      pointedAt = true
      events.pointer({ id, x: at.x, y: at.y, zoom: drawnZoom }, mapZoom())
    },
    leave(_drawnZoom: number) {
      pointedAt = false
      events.pointer(null, mapZoom())
    },
    click(id: string, drawnZoom: number, at: { x: number; y: number }) {
      markerTapAt = now()
      events.tap({ id, x: at.x, y: at.y, zoom: drawnZoom }, mapZoom())
    },
    /** A tap on the map beside every marker, with the place under it when Google reports one (962). */
    mapClick(place?: MapPlace) {
      if (now() - markerTapAt < SAME_TAP_MS) return
      if (place) events.tap(null, mapZoom(), place)
      else events.tap(null, mapZoom())
    },
    /** 964: the customer's pin took this press (a click or a drop): the map's own click for it places nothing. */
    held() {
      markerTapAt = now()
    },
    /**
     * The markers were made again (the whole zoom changed): the one under the pointer is gone with no `pointerleave`,
     * so the pointer is off every marker and an unpinned card goes (review G5). A pinned card stays.
     */
    redrawn() {
      if (!pointedAt) return
      pointedAt = false
      events.pointer(null, mapZoom())
    },
  }
}

/** The customer pin's size, in pixels: a square turned on its point, larger than a plain store. */
export const PIN_SIZE = 16

/**
 * The customer's pin (964): a diamond in its colour, edged in the ring ink, centred on its place, above every store and
 * group. A draggable pin shows a grab cursor and takes no touch scrolling, so a finger drags it rather than the page.
 */
export function pinLook(pin: MapPinFeature): MarkerLook {
  return {
    style: {
      position: 'absolute',
      boxSizing: 'border-box',
      width: `${PIN_SIZE}px`,
      height: `${PIN_SIZE}px`,
      background: pin.fill,
      border: `2px solid ${pin.stroke}`,
      transform: 'translate(-50%, -50%) rotate(45deg)',
      cursor: pin.draggable ? 'grab' : 'default',
      touchAction: 'none',
      zIndex: '2000',
    },
    label: '',
  }
}

/** How far the pointer must travel, in pixels, before a press on the pin is a drag and not a click. */
export const DRAG_MIN_PX = 4

/**
 * The drag of the customer's pin (964), as the adapter reports the pointer: pressed, moved, released, in the overlay's
 * own pixels. Each move past the jitter returns where the pin now stands (the adapter puts it there); the release reports
 * the place under the last move once, through `onDrop`, and says whether there was a drag. Nothing is told while dragging:
 * the run plans again on the drop, not on every move.
 */
export function pinDrag(toPlace: (x: number, y: number) => MapPlace | null, onDrop: (place: MapPlace) => void) {
  let from: { x: number; y: number } | null = null
  let last: { x: number; y: number } | null = null
  return {
    down(x: number, y: number) {
      from = { x, y }
      last = null
    },
    /** Where the pin stands after this move, or null while it is no drag. */
    move(x: number, y: number): { x: number; y: number } | null {
      if (!from) return null
      if (!last && Math.hypot(x - from.x, y - from.y) < DRAG_MIN_PX) return null
      last = { x, y }
      return last
    },
    /** True when the release ended a drag (and the drop was told). */
    up(): boolean {
      const at = from ? last : null
      from = null
      last = null
      if (!at) return false
      const place = toPlace(at.x, at.y)
      if (!place) return false
      onDrop(place)
      return true
    },
    get dragging() {
      return last !== null
    },
  }
}
