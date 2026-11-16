import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import type { MapEngine, MapEngineEvents, MapEngineStart } from './map-panel'
import { BASEMAP_SOURCE } from './map-style'

/**
 * The map engine: MapLibre (ADR 0135), over the base-map file read by byte range through the `pmtiles://` protocol.
 * The one module that touches MapLibre; `./map-panel` decides everything it is handed, and the tests drive that module
 * with a stand-in instead of this one (spec 3630 seam 6: no library internals, no pixels).
 *
 * Only `./MapPanel` imports this, and only `./LazyMapPanel` imports that — so the map's code is a chunk of its own,
 * loaded when a map is on screen (M35).
 */

const POINTS_SOURCE = 'points'
const POINTS_LAYER = 'points'

/** One protocol per page: MapLibre keeps the registration globally. */
let protocolAdded = false

/** The add-on is set once per page (MapLibre refuses a second call). */
function ensureRtlTextPlugin(plugin: MapEngineStart['rtlTextPlugin']) {
  if (maplibregl.getRTLTextPluginStatus() !== 'unavailable') return
  // A failed add-on load leaves Arabic labels unshaped, not the map undrawn: it is not a "cannot draw".
  maplibregl.setRTLTextPlugin(plugin.url, plugin.deferred).catch(() => {})
}

/** The point's ink. Light only (M33), read from the page's tokens by the caller. */
export interface PointInk {
  fill: string
  outline: string
}

export function maplibreEngine(ink: PointInk): MapEngine {
  return {
    start(start: MapEngineStart, events: MapEngineEvents) {
      if (!protocolAdded) {
        maplibregl.addProtocol('pmtiles', new Protocol().tile)
        protocolAdded = true
      }
      ensureRtlTextPlugin(start.rtlTextPlugin)

      const view = start.view
      // Throws when the browser gives no graphics context: the panel reads that as "cannot draw".
      const map = new maplibregl.Map({
        container: start.container as HTMLElement,
        style: start.style,
        // The panel draws "© OpenStreetMap" itself, as an element that prints (M34).
        attributionControl: false,
        // The prototype's look: no rotation, no tilt.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        ...(view.kind === 'bounds'
          ? { bounds: [view.west, view.south, view.east, view.north] as [number, number, number, number], fitBoundsOptions: { padding: 40, maxZoom: 15 } }
          : { center: [view.lon, view.lat] as [number, number], zoom: view.zoom }),
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), start.controlsCorner)

      map.on('error', (e: { sourceId?: string; error?: unknown }) => {
        if (e.sourceId === BASEMAP_SOURCE) events.basemapUnreadable()
      })

      map.on('load', () => {
        map.addSource(POINTS_SOURCE, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: start.points.map((p) => ({
              type: 'Feature' as const,
              properties: { id: p.id },
              geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
            })),
          },
        })
        // Plain points of one size and one colour; size, colour and groups are 881's.
        map.addLayer({
          id: POINTS_LAYER,
          type: 'circle',
          source: POINTS_SOURCE,
          paint: { 'circle-radius': 6, 'circle-color': ink.fill, 'circle-stroke-color': ink.outline, 'circle-stroke-width': 1.5 },
        })
        const whenPainted = () => {
          if (map.areTilesLoaded() && map.isSourceLoaded(BASEMAP_SOURCE) && map.isSourceLoaded(POINTS_SOURCE)) {
            map.off('idle', whenPainted)
            events.painted()
          }
        }
        map.on('idle', whenPainted)
      })

      return { destroy: () => map.remove() }
    },
  }
}
