import { googleLoader, type GoogleLoader } from './google-loader'
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
 * - Points: plain, one size and one colour (908), as classic markers with a circle symbol, which need no map ID. 909
 *   decides the marker kind for sized, coloured and grouped points.
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
interface GMarker {
  setMap(map: GMap | null): void
}
interface GoogleMapsNs {
  importLibrary(name: 'maps'): Promise<{ Map: new (el: HTMLElement, options: Record<string, unknown>) => GMap; RenderingType: { RASTER: unknown } }>
  importLibrary(name: 'marker'): Promise<{ Marker: new (options: Record<string, unknown>) => GMarker }>
  ControlPosition: { TOP_LEFT: unknown; TOP_RIGHT: unknown }
  SymbolPath: { CIRCLE: unknown }
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
      let markers: GMarker[] = []
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
        const [{ Map, RenderingType }, { Marker }] = await Promise.all([g.importLibrary('maps'), g.importLibrary('marker')])
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
        const { radius, fill, ring } = start.plainPoint
        markers = start.points.map(
          (p) =>
            new Marker({
              map,
              position: { lat: p.lat, lng: p.lon },
              clickable: false,
              icon: { path: g!.SymbolPath.CIRCLE, scale: radius, fillColor: fill, fillOpacity: 1, strokeColor: ring, strokeWeight: 1.5 },
            }),
        )
        const m = map
        listeners.push(
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
          for (const marker of markers) marker.setMap(null)
          markers = []
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
