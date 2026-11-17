import { googleLoader, type GoogleLoader } from './google-loader'
import { markerHits, markerLook } from './map-markers'
import type { MapFeature } from './map-drawing'
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
 * - Raster tiles (`renderingType: RASTER`), so a headless print needs no graphics card. A served map ID brings its own
 *   rendering setting, which must be raster too (908's open question).
 * - Points and groups (909): the panel's features at the whole zoom (`start.featuresAt`), drawn as HTML elements on one
 *   `OverlayView` with `./map-markers`' look — no map ID needed, so the map stays raster with Google's default style.
 *   Redrawn when the whole zoom changes; the panel's own grouping is the one source, so a tap, a group's opening zoom
 *   and the card's fold all read the features drawn. A click on a group eases to the zoom where it opens.
 * - "Drawn": the points are put on the map before Google can report anything; the panel then waits for `tilesloaded` and
 *   `idle` (M37).
 */

// The few shapes of Google's API this adapter uses: Google's script is not a package here, so its types are not either.
interface LatLngLiteral {
  lat: number
  lng: number
}
interface GListener {
  remove(): void
}
interface GMap {
  addListener(event: string, handler: () => void): GListener
  fitBounds(bounds: { west: number; south: number; east: number; north: number }, padding?: number): void
  setCenter(at: LatLngLiteral): void
  setZoom(zoom: number): void
  panTo(at: LatLngLiteral): void
  getZoom(): number | undefined
  getBounds(): { getNorthEast(): GLatLng; getSouthWest(): GLatLng } | undefined
  getProjection(): { fromLatLngToPoint(at: LatLngLiteral): { x: number; y: number } | null } | undefined
}
interface GLatLng {
  lat(): number
  lng(): number
}
interface GOverlayView {
  setMap(map: GMap | null): void
  getPanes(): { overlayMouseTarget: HTMLElement } | null
  getProjection(): { fromLatLngToDivPixel(at: LatLngLiteral): { x: number; y: number } | null } | undefined
}
interface GOverlayViewClass {
  new (): GOverlayView
  preventMapHitsAndGesturesFrom(el: HTMLElement): void
}
interface GoogleMapsNs {
  importLibrary(name: 'maps'): Promise<{ Map: new (el: HTMLElement, options: Record<string, unknown>) => GMap; RenderingType: { RASTER: unknown } }>
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
      const container = start.container as HTMLElement
      let destroyed = false
      let ended = false
      let map: GMap | null = null
      let g: GoogleMapsNs | undefined
      const listeners: GListener[] = []
      let overlay: GOverlayView | null = null
      let resize: ResizeObserver | null = null
      const fail = (reason: 'refused' | 'unreachable' | 'no-graphics') => {
        if (destroyed || ended) return
        ended = reason !== 'refused'
        events.failed(reason)
      }
      // Listened for before the script is asked for: a refusal can come before or after the map draws.
      const stopRefused = loader.onRefused(() => {
        if (!destroyed) events.failed('refused')
      })

      const fit = (v: MapView) => {
        if (!map || !g) return
        if (v.kind === 'centre') {
          map.setCenter({ lat: v.lat, lng: v.lon })
          map.setZoom(v.zoom)
          return
        }
        const m = map
        // Google fits as close as the box allows; two stores on one street would open at building level.
        listeners.push(
          g.event.addListenerOnce(m, 'bounds_changed', () => {
            if ((m.getZoom() ?? 0) > FIT.maxZoom) m.setZoom(FIT.maxZoom)
          }),
        )
        m.fitBounds({ west: v.west, south: v.south, east: v.east, north: v.north }, FIT.padding)
      }

      const draw = async () => {
        g = googleMaps()
        if (!g) throw new Error('Google Maps did not define google.maps')
        const { Map, RenderingType } = await g.importLibrary('maps')
        if (destroyed) return
        const view = start.view
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
        overlay = markersOverlay(g, m, container, start, hits)
        overlay.setMap(m)
        listeners.push(
          m.addListener('click', () => !destroyed && hits.mapClick()),
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
          overlay?.setMap(null)
          overlay = null
          map = null
        },
        zoomTo: (lon, lat, zoom) => {
          map?.panTo({ lat, lng: lon })
          map?.setZoom(zoom)
        },
        fit: (v) => fit(v),
        project: (lon, lat) => {
          // Where a place stands on the panel: its world point against the north-west corner's, at the zoom's scale.
          const projection = map?.getProjection()
          const bounds = map?.getBounds()
          const zoom = map?.getZoom()
          if (!projection || !bounds || zoom == null) return { x: 0, y: 0 }
          const ne = bounds.getNorthEast()
          const sw = bounds.getSouthWest()
          const corner = projection.fromLatLngToPoint({ lat: ne.lat(), lng: sw.lng() })
          const at = projection.fromLatLngToPoint({ lat, lng: lon })
          if (!corner || !at) return { x: 0, y: 0 }
          const scale = 2 ** zoom
          return { x: (at.x - corner.x) * scale, y: (at.y - corner.y) * scale }
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
  container: HTMLElement,
  start: MapEngineStart,
  hits: ReturnType<typeof markerHits>,
): GOverlayView {
  const layer = document.createElement('div')
  layer.setAttribute('data-map-markers', '')
  let drawnZoom: number | null = null
  let shown: { f: MapFeature; el: HTMLElement }[] = []
  // A hit's place in the panel's pixels, as the card is placed (physical, from the map box's own corner).
  const placeOf = (e: MouseEvent) => {
    const box = container.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }
  const make = (zoom: number) => {
    drawnZoom = zoom
    // The whole zoom the markers were made at, for the drives (as `data-map-state` is).
    layer.setAttribute('data-zoom', String(zoom))
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
      el.addEventListener('pointerenter', (e) => hits.enter(f.id, zoom, placeOf(e)))
      el.addEventListener('pointerleave', () => hits.leave(zoom))
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        hits.click(f.id, zoom, placeOf(e))
      })
      g.OverlayView.preventMapHitsAndGesturesFrom(el)
      layer.appendChild(el)
      return { f, el }
    })
  }
  const overlay = new g.OverlayView()
  return Object.assign(overlay, {
    onAdd() {
      overlay.getPanes()?.overlayMouseTarget.appendChild(layer)
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
    },
    onRemove() {
      layer.remove()
      shown = []
      drawnZoom = null
    },
  })
}
