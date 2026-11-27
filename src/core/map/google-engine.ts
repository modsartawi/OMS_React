import { googleLoader, type GoogleLoader } from './google-loader'
import { lineLabelLook, markerHits, markerLook, pinDrag, pinLook } from './map-markers'
import { lineStroke, POLYGON_EDGE_WIDTH, RING_LINE_WIDTH, type MapFeature } from './map-drawing'
import type { MapEngine, MapEngineEvents, MapEngineRunning, MapEngineStart, MapView } from './map-panel'

/**
 * The map engine: Google Maps JavaScript (ticket 908, BackOffice spec 3630 M28, M33, M34; ADR 0139). The one module that
 * touches Google's map; `./map-panel` decides everything it is handed, and the tests drive that module with a stand-in
 * instead of this one (spec 3630 seam 6: no library internals, no pixels). The script itself is `./google-loader`'s.
 *
 * Only `./MapPanel` imports this, and only `./LazyMapPanel` imports that — so the map's code is a chunk of its own,
 * loaded when a map is on screen, and Google's script only when that map starts (M35).
 *
 * - Google's standard road map: no restyle, no street view, no map-type switch, no full-screen or camera control; the
 *   zoom buttons at the reading end. Google's logo and terms are drawn by Google, on screen and in print (M34).
 * - Raster tiles (`renderingType: RASTER`), so a headless print needs no graphics card. Set on the map, it wins over a
 *   served map ID's own rendering setting (Google takes the map ID's only when the map sets none): BackOffice's
 *   `MapPdfProofTests` prints with Google's vector `DEMO_MAP_ID` and gets raster tiles (review B3).
 * - Points and groups (909): the panel's features at the whole zoom (`start.featuresAt`), drawn as HTML elements on one
 *   `OverlayView` with `./map-markers`' look — no map ID needed, so the map stays raster with Google's default style.
 *   Redrawn when the whole zoom changes; the panel's own grouping is the one source, so a tap, a group's opening zoom
 *   and the card's fold all read the features drawn. A click on a group eases to the zoom where it opens.
 * - Lines (922): each `start.lines` entry a Google `Polyline` in its resolved colour (beneath every overlay, so the
 *   points lie on top), taking no tap; its words an HTML element on the same overlay, at the line's middle as drawn.
 * - Shapes (947): each `start.polygons` entry a Google `Polygon` in its resolved fill, beneath the lines and every
 *   overlay; its click is reported as the shape's id (`events.shapeTap`).
 * - 964: a dashed or dotted line repeats a short stroke of its colour along a hidden polyline (`lineStroke`); a ring is
 *   such a dashed polyline round its closed path, beneath every leg, its words at its top; the customer's pin is an HTML
 *   element above every marker, that a drag moves (`pinDrag`) and whose drop is reported once (`pinMoved`).
 * - "Drawn": the points are put on the map before Google can report anything; the panel then waits for `tilesloaded` and
 *   `idle` (M37).
 * - Google draws into an element of the adapter's own inside the panel's box, taken out again when the map is closed
 *   (review G3): Google has no way to destroy a map, so a map started again in the same box (a new answer, StrictMode's
 *   second mount) never draws over the old one's element and listeners.
 * - A page Google has refused starts no map (review G10): a map made then would be a billed map load drawn grey.
 * - A store's place on the panel is Google's own container pixel for it (review G9), from the first pointer on.
 */

// The few shapes of Google's API this adapter uses: Google's script is not a package here, so its types are not either.
interface LatLngLiteral {
  lat: number
  lng: number
}
interface GListener {
  remove(): void
}
/** What Google hands a map's `click` listener (962): the place under the click, when there is one. */
interface GMouseEvent {
  latLng?: { lat(): number; lng(): number } | null
}

interface GMap {
  addListener(event: string, handler: (e?: GMouseEvent) => void): GListener
  fitBounds(bounds: { west: number; south: number; east: number; north: number }, padding?: number): void
  setOptions(options: Record<string, unknown>): void
  setCenter(at: LatLngLiteral): void
  setZoom(zoom: number): void
  panTo(at: LatLngLiteral): void
  getZoom(): number | undefined
}
interface GPixels {
  fromLatLngToDivPixel(at: LatLngLiteral): { x: number; y: number } | null
  fromLatLngToContainerPixel(at: LatLngLiteral): { x: number; y: number } | null
  /** 964: the place under a pixel of the overlay, for the pin's drop. */
  fromDivPixelToLatLng(at: { x: number; y: number }): { lat(): number; lng(): number } | null
}
interface GOverlayView {
  setMap(map: GMap | null): void
  getPanes(): { overlayMouseTarget: HTMLElement } | null
  getProjection(): GPixels | undefined | null
}
interface GOverlayViewClass {
  new (): GOverlayView
  preventMapHitsAndGesturesFrom(el: HTMLElement): void
}
/** 922: a line on the map. */
interface GPolyline {
  setMap(map: GMap | null): void
}
/** 947: a shape on the map. */
interface GPolygon {
  setMap(map: GMap | null): void
  addListener(event: string, handler: () => void): GListener
}
interface GoogleMapsNs {
  importLibrary(name: 'maps'): Promise<{
    Map: new (el: HTMLElement, options: Record<string, unknown>) => GMap
    RenderingType: { RASTER: unknown }
    Polyline: new (options: Record<string, unknown>) => GPolyline
    Polygon: new (options: Record<string, unknown>) => GPolygon
  }>
  ControlPosition: { TOP_LEFT: unknown; TOP_RIGHT: unknown }
  OverlayView: GOverlayViewClass
  event: { addListenerOnce(target: GMap, event: string, handler: () => void): GListener }
}

/** How a box is fitted: a margin in pixels, and no closer than this zoom (two stores on one street). */
const FIT = { padding: 40, maxZoom: 15 } as const

const googleMaps = () => (window as unknown as { google?: { maps?: GoogleMapsNs } }).google?.maps

export function googleEngine(loader: GoogleLoader = googleLoader()): MapEngine {
  return {
    start(start: MapEngineStart, events: MapEngineEvents): MapEngineRunning {
      const box = start.container as HTMLElement
      let destroyed = false
      let refused = false
      let ended = false
      let map: GMap | null = null
      let g: GoogleMapsNs | undefined
      const listeners: GListener[] = []
      let overlay: GOverlayView | null = null
      // 922: the lines drawn, taken off the map again when it is closed.
      const polylines: GPolyline[] = []
      // 947: the shapes drawn, taken off the map again when it is closed.
      const polygons: GPolygon[] = []
      // 947: a view shown before Google has made the map is the one it opens on.
      let pending: MapView | null = null
      let resize: ResizeObserver | null = null
      const fail = (reason: 'refused' | 'unreachable' | 'no-graphics') => {
        if (destroyed || ended) return
        ended = reason !== 'refused'
        events.failed(reason)
      }
      // Listened for before the script is asked for: a refusal can come before or after the map draws.
      const stopRefused = loader.onRefused(() => {
        refused = true
        if (!destroyed) events.failed('refused')
      })
      if (refused) {
        // Already refused (told at once above): Google is asked for nothing more on this page.
        return { destroy: () => void (destroyed = true), zoomTo: () => {}, fit: () => {}, project: () => ({ x: 0, y: 0 }) }
      }
      const container = document.createElement('div')
      container.style.width = '100%'
      container.style.height = '100%'
      box.appendChild(container)

      const fit = (v: MapView) => {
        if (!map || !g) {
          pending = v
          return
        }
        if (v.kind === 'centre') {
          map.setCenter({ lat: v.lat, lng: v.lon })
          map.setZoom(v.zoom)
          return
        }
        const m = map
        // Google fits as close as the box allows; two stores on one street would open at building level. The zoom is
        // held at 15 while it fits, and let go once the map is idle (review G4): the reader's own zoom is never snapped.
        m.setOptions({ maxZoom: FIT.maxZoom })
        listeners.push(g.event.addListenerOnce(m, 'idle', () => m.setOptions({ maxZoom: null })))
        m.fitBounds({ west: v.west, south: v.south, east: v.east, north: v.north }, FIT.padding)
      }

      const draw = async () => {
        g = googleMaps()
        if (!g) throw new Error('Google Maps did not define google.maps')
        const { Map, RenderingType, Polyline, Polygon } = await g.importLibrary('maps')
        if (destroyed || refused) return
        const view = pending ?? start.view
        try {
          map = new Map(container, {
            ...(view.kind === 'centre' ? { center: { lat: view.lat, lng: view.lon }, zoom: view.zoom } : { center: { lat: 24, lng: 45 }, zoom: 5 }),
            ...(start.mapId ? { mapId: start.mapId } : {}),
            renderingType: RenderingType.RASTER,
            mapTypeId: 'roadmap',
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: { position: start.controlsCorner === 'top-left' ? g.ControlPosition.TOP_LEFT : g.ControlPosition.TOP_RIGHT },
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            rotateControl: false,
            cameraControl: false,
            // A place's own pop-up is Google's, not a store: the map's taps are the panel's.
            clickableIcons: false,
          })
        } catch {
          fail('no-graphics')
          return
        }
        if (view.kind === 'bounds') fit(view)
        // The points are on the map before Google can report its tiles or idle: "drawn" then includes them.
        const m = map
        const hits = markerHits(events, () => m.getZoom() ?? 0)
        overlay = markersOverlay(g, m, start, hits, project, (place) => !destroyed && events.pinMoved?.(place))
        overlay.setMap(m)
        // 947: each shape a polygon in its fill, every ring a path, beneath the lines (zIndex 0) and every overlay; its
        // click is the shape's, reported by id.
        for (const shape of start.polygons ?? []) {
          const polygon = new Polygon({
            map: m,
            paths: shape.rings.map((ring) => ring.map(([lon, lat]) => ({ lat, lng: lon }))),
            fillColor: shape.fill,
            fillOpacity: shape.fillOpacity,
            strokeColor: shape.stroke,
            strokeOpacity: 1,
            strokeWeight: POLYGON_EDGE_WIDTH,
            zIndex: 0,
            clickable: true,
          })
          // A clickable polygon takes the map's own click, so the shape's click is also the tap on the map beside the
          // stores: a pinned card closes (review A5), as a click on bare map closes it.
          listeners.push(
            polygon.addListener('click', () => {
              if (destroyed) return
              hits.mapClick()
              events.shapeTap?.(shape.id)
            }),
          )
          polygons.push(polygon)
        }
        // 922: each line a polyline in its colour, in the order given. Google draws polylines beneath every overlay, so
        // the points (and the lines' words) lie on top; a strong line stacks above every plain one, so a later leg lying
        // along it never hides it; a line takes no tap; the map's taps stay the panel's.
        // 964: each ring a dashed closed polyline, beneath every line.
        for (const ring of start.rings ?? []) {
          polylines.push(
            new Polyline({
              map: m,
              path: ring.path.map((q) => ({ lat: q.lat, lng: q.lon })),
              ...lineStroke({ id: ring.id, from: ring.path[0], to: ring.path[0], stroke: ring.stroke, label: '', strong: false, dash: 'dashed' }, RING_LINE_WIDTH),
              zIndex: 0,
              clickable: false,
            }),
          )
        }
        for (const line of start.lines ?? []) {
          polylines.push(
            new Polyline({
              map: m,
              path: [
                { lat: line.from.lat, lng: line.from.lon },
                { lat: line.to.lat, lng: line.to.lon },
              ],
              // 964: a dashed or dotted line repeats a short stroke of its colour along a hidden one.
              ...lineStroke(line),
              zIndex: line.strong ? 2 : 1,
              clickable: false,
            }),
          )
        }
        listeners.push(
          // 962: the click's place rides with it, so a caller can place the customer where the map was clicked.
          m.addListener('click', (e?: GMouseEvent) => {
            if (destroyed) return
            hits.mapClick(e?.latLng ? { lon: e.latLng.lng(), lat: e.latLng.lat() } : undefined)
          }),
          m.addListener('tilesloaded', () => !destroyed && events.tilesLoaded()),
          m.addListener('idle', () => !destroyed && events.idle()),
          m.addListener('bounds_changed', () => !destroyed && events.moved(m.getZoom() ?? 0)),
        )
        const sizeNow = () => !destroyed && events.sized(container.clientWidth, container.clientHeight)
        if (typeof ResizeObserver !== 'undefined') {
          resize = new ResizeObserver(sizeNow)
          resize.observe(container)
        }
        sizeNow()
      }

      // Where a place stands in the box, in Google's own container pixels (review G9).
      const project = (lon: number, lat: number) => overlay?.getProjection()?.fromLatLngToContainerPixel({ lat, lng: lon }) ?? { x: 0, y: 0 }

      loader.load(start.key, start.lang).then(
        () => draw().catch(() => fail('unreachable')),
        () => fail('unreachable'),
      )

      return {
        destroy: () => {
          destroyed = true
          stopRefused()
          resize?.disconnect()
          for (const l of listeners) l.remove()
          for (const p of polylines) p.setMap(null)
          polylines.length = 0
          for (const p of polygons) p.setMap(null)
          polygons.length = 0
          overlay?.setMap(null)
          overlay = null
          map = null
          container.remove()
        },
        zoomTo: (lon, lat, zoom) => {
          map?.panTo({ lat, lng: lon })
          map?.setZoom(zoom)
        },
        fit: (v) => fit(v),
        project: (lon, lat) => {
          const at = project(lon, lat)
          return { x: at.x, y: at.y }
        },
      }
    },
  }
}

/**
 * One overlay holding every marker as an HTML element (909): the features at the map's whole zoom, placed at Google's
 * own pixel for their place on every redraw, made again when the whole zoom changes. Hits on a marker are the panel's
 * (`preventMapHitsAndGesturesFrom`: the map neither pans from a marker nor sees its click as a click beside it).
 */
function markersOverlay(
  g: GoogleMapsNs,
  map: GMap,
  start: MapEngineStart,
  hits: ReturnType<typeof markerHits>,
  project: (lon: number, lat: number) => { x: number; y: number },
  pinMoved: (place: { lon: number; lat: number }) => void,
): GOverlayView {
  const layer = document.createElement('div')
  layer.setAttribute('data-map-markers', '')
  let drawnZoom: number | null = null
  let shown: { f: MapFeature; el: HTMLElement }[] = []
  // A hit's place in the panel's pixels, as the card is placed: the store's own place (review G9), the same pixel the card
  // is moved to as the map moves, so it never jumps from where the pointer happened to be.
  const placeOf = (f: MapFeature) => {
    const at = project(f.lon, f.lat)
    return { x: at.x, y: at.y }
  }
  const make = (zoom: number) => {
    drawnZoom = zoom
    // The whole zoom the markers were made at, for the drives (as `data-map-state` is).
    layer.setAttribute('data-zoom', String(zoom))
    // The marker under the pointer goes with no `pointerleave` (review G5).
    hits.redrawn()
    layer.replaceChildren()
    shown = start.featuresAt(zoom).map((f) => {
      const el = document.createElement('div')
      const look = markerLook(f, start.labelInk)
      Object.assign(el.style, look.style)
      el.setAttribute('data-feature', f.kind)
      if (look.label) {
        // `auto`: an Arabic sum's word reads right to left inside its circle; the digits stay Latin (M19).
        el.dir = 'auto'
        el.textContent = look.label
      }
      el.addEventListener('pointerenter', () => hits.enter(f.id, zoom, placeOf(f)))
      el.addEventListener('pointerleave', () => hits.leave(zoom))
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        hits.click(f.id, zoom, placeOf(f))
      })
      g.OverlayView.preventMapHitsAndGesturesFrom(el)
      layer.appendChild(el)
      return { f, el }
    })
  }
  // 922: the lines' words, made once (a zoom does not change them), in a layer of their own beside the markers'.
  const wordsLayer = document.createElement('div')
  wordsLayer.setAttribute('data-map-lines', '')
  const words = (start.lines ?? [])
    .filter((line) => line.label !== '')
    .map((line) => {
      const el = document.createElement('div')
      const look = lineLabelLook(line)
      Object.assign(el.style, look.style)
      el.setAttribute('data-map-line', line.id)
      // `auto`: Arabic words read right to left; the digits stay Latin.
      el.dir = 'auto'
      el.textContent = look.label
      wordsLayer.appendChild(el)
      return { line, el }
    })
  // 964: each ring's words, at its top.
  const ringWords = (start.rings ?? [])
    .filter((ring) => ring.label !== '')
    .map((ring) => {
      const el = document.createElement('div')
      const look = lineLabelLook({ id: ring.id, from: ring.labelAt, to: ring.labelAt, stroke: ring.stroke, label: ring.label, strong: false })
      Object.assign(el.style, look.style, { zIndex: '49' })
      el.setAttribute('data-map-ring', ring.id)
      el.dir = 'auto'
      el.textContent = look.label
      wordsLayer.appendChild(el)
      return { ring, el }
    })
  // 964: the customer's pin, above every marker; a drag moves it, and its drop is reported once.
  const pin = start.pin
  let pinEl: HTMLElement | null = null
  const drag = pinDrag((x, y) => {
    const at = overlay.getProjection()?.fromDivPixelToLatLng({ x, y })
    return at ? { lon: at.lng(), lat: at.lat() } : null
  }, pinMoved)
  if (pin) {
    const el = document.createElement('div')
    Object.assign(el.style, pinLook(pin).style)
    el.setAttribute('data-map-pin', pin.draggable ? 'draggable' : 'fixed')
    el.setAttribute('role', 'img')
    el.setAttribute('aria-label', pin.label)
    el.setAttribute('title', pin.label)
    // The pointer's place in the overlay's own pixels: the markers' layer stands at the overlay's origin.
    const local = (e: PointerEvent) => {
      const box = layer.getBoundingClientRect()
      return { x: e.clientX - box.left, y: e.clientY - box.top }
    }
    if (pin.draggable) {
      el.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation()
        e.preventDefault?.()
        el.setPointerCapture?.(e.pointerId)
        const at = local(e)
        drag.down(at.x, at.y)
        el.style.cursor = 'grabbing'
      })
      el.addEventListener('pointermove', (e: PointerEvent) => {
        const at = local(e)
        const to = drag.move(at.x, at.y)
        if (!to) return
        el.style.left = `${to.x}px`
        el.style.top = `${to.y}px`
      })
      const release = (e: PointerEvent) => {
        e.stopPropagation()
        el.releasePointerCapture?.(e.pointerId)
        el.style.cursor = 'grab'
        // A drop is the pin's own, never a click beside the stores: the map's own click that follows places nothing.
        if (drag.up()) hits.held()
      }
      el.addEventListener('pointerup', release)
      el.addEventListener('pointercancel', release)
    }
    // A click on the pin is the pin's: it neither places the customer nor closes a card.
    el.addEventListener('click', (e: Event) => {
      e.stopPropagation()
      hits.held()
    })
    g.OverlayView.preventMapHitsAndGesturesFrom(el)
    pinEl = el
  }
  const overlay = new g.OverlayView()
  return Object.assign(overlay, {
    onAdd() {
      const pane = overlay.getPanes()?.overlayMouseTarget
      pane?.appendChild(layer)
      if (words.length + ringWords.length > 0) pane?.appendChild(wordsLayer)
      if (pinEl) pane?.appendChild(pinEl)
    },
    draw() {
      const zoom = Math.floor(map.getZoom() ?? 0)
      if (zoom !== drawnZoom) make(zoom)
      const projection = overlay.getProjection()
      if (!projection) return
      for (const { f, el } of shown) {
        const at = projection.fromLatLngToDivPixel({ lat: f.lat, lng: f.lon })
        if (!at) continue
        el.style.left = `${at.x}px`
        el.style.top = `${at.y}px`
      }
      // A line's words stand at its middle as drawn: halfway between its two ends' pixels (a polyline is straight on the
      // screen, so its middle there is not the middle of the two latitudes).
      for (const { line, el } of words) {
        const a = projection.fromLatLngToDivPixel({ lat: line.from.lat, lng: line.from.lon })
        const b = projection.fromLatLngToDivPixel({ lat: line.to.lat, lng: line.to.lon })
        if (!a || !b) continue
        el.style.left = `${(a.x + b.x) / 2}px`
        el.style.top = `${(a.y + b.y) / 2}px`
      }
      for (const { ring, el } of ringWords) {
        const at = projection.fromLatLngToDivPixel({ lat: ring.labelAt.lat, lng: ring.labelAt.lon })
        if (!at) continue
        el.style.left = `${at.x}px`
        el.style.top = `${at.y}px`
      }
      // The pin stands at its place, except while it is being dragged: then it is where the pointer is.
      if (pin && pinEl && !drag.dragging) {
        const at = projection.fromLatLngToDivPixel({ lat: pin.lat, lng: pin.lon })
        if (at) {
          pinEl.style.left = `${at.x}px`
          pinEl.style.top = `${at.y}px`
        }
      }
    },
    onRemove() {
      layer.remove()
      wordsLayer.remove()
      pinEl?.remove()
      shown = []
      drawnZoom = null
    },
  })
}
