import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { isBasemapUnreadable, isPainted, type MapEngine, type MapEngineEvents, type MapEngineStart, type MapView } from './map-panel'
import { GROUP_LABEL_TEXT } from './map-drawing'
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
const GROUP_WORDS_LAYER = 'group-words'

/** One protocol per page: MapLibre keeps the registration globally. */
let protocolAdded = false

/** The add-on is set once per page (MapLibre refuses a second call). */
function ensureRtlTextPlugin(plugin: MapEngineStart['rtlTextPlugin']) {
  if (maplibregl.getRTLTextPluginStatus() !== 'unavailable') return
  // A failed add-on load leaves Arabic labels unshaped, not the map undrawn: it is not a "cannot draw".
  maplibregl.setRTLTextPlugin(plugin.url, plugin.deferred).catch(() => {})
}

/** How a view is shown: a box fitted with a margin, or one place at its zoom. */
const FIT = { padding: 40, maxZoom: 15 } as const

/**
 * An Arabic map is "painted" only once its letters are shaped (review W6, `isPainted`). Under an
 * English-first session the add-on was set deferred; MapLibre loads it as soon as a tile carries Arabic text, which every
 * tile of an Arabic map does, and redraws those tiles, so the gate below waits for that load rather than a second set.
 */
export function maplibreEngine(): MapEngine {
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
        // Keep the drawn frame in the canvas: Chromium prints a WebGL canvas from its drawing buffer, which is otherwise
        // cleared once shown, so the report PDF would print a blank map (BackOffice 3635, spec 3630 M32/M37).
        canvasContextAttributes: { preserveDrawingBuffer: true },
        // The prototype's look: no rotation, no tilt.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        ...(view.kind === 'bounds'
          ? { bounds: [view.west, view.south, view.east, view.north] as [number, number, number, number], fitBoundsOptions: FIT }
          : { center: [view.lon, view.lat] as [number, number], zoom: view.zoom }),
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), start.controlsCorner)

      // Review W5: only the file (or its header) unread is "unreadable"; one tile failing leaves the rest drawn.
      map.on('error', (e: { sourceId?: string; tile?: unknown; error?: unknown }) => {
        if (isBasemapUnreadable(e)) events.basemapUnreadable()
      })
      // Review W9: the browser can take the graphics away (too many maps, a GPU reset); the canvas is then blank.
      map.on('webglcontextlost', () => events.graphicsLost())

      /** The features at a zoom as GeoJSON: each carries its own size, colours and words (`./map-drawing`). */
      const dataAt = (zoom: number) => ({
        type: 'FeatureCollection' as const,
        features: start.featuresAt(zoom).map((f) => ({
          type: 'Feature' as const,
          // `zoom`: the whole zoom these features were made at, so a hit is read against them (review W8).
          properties: { id: f.id, kind: f.kind, radius: f.radius, fill: f.fill, fillOpacity: f.fillOpacity, stroke: f.stroke, strokeWidth: f.strokeWidth, label: f.label, zoom },
          geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
        })),
      })
      const targetOf = (e: { point: { x: number; y: number } }) => {
        const hit = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: [POINTS_LAYER] })[0]
        const id = hit?.properties?.id
        const zoom = hit?.properties?.zoom
        return typeof id === 'string' ? { id, x: e.point.x, y: e.point.y, ...(typeof zoom === 'number' ? { zoom } : {}) } : null
      }

      map.on('load', () => {
        let drawnZoom = Math.floor(map.getZoom())
        map.addSource(POINTS_SOURCE, { type: 'geojson', data: dataAt(drawnZoom) })
        // Each point drawn as the panel sized and coloured it (881); the larger beneath the smaller, so none hides.
        map.addLayer({
          id: POINTS_LAYER,
          type: 'circle',
          source: POINTS_SOURCE,
          layout: { 'circle-sort-key': ['-', 0, ['get', 'radius']] },
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'fill'],
            'circle-opacity': ['get', 'fillOpacity'],
            'circle-stroke-color': ['get', 'stroke'],
            'circle-stroke-width': ['get', 'strokeWidth'],
          },
        })
        // A group's count, and its sum when the size adds up, on the group itself.
        map.addLayer({
          id: GROUP_WORDS_LAYER,
          type: 'symbol',
          source: POINTS_SOURCE,
          filter: ['==', ['get', 'kind'], 'group'],
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            // Set as the panel sized each group for them (`groupRadius`), so the words stay inside the circle.
            'text-size': GROUP_LABEL_TEXT.size,
            'text-line-height': GROUP_LABEL_TEXT.lineHeight,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': start.labelInk },
        })
        // Groups are made per whole zoom: a new one asks the panel again.
        map.on('zoom', () => {
          const z = Math.floor(map.getZoom())
          if (z === drawnZoom) return
          drawnZoom = z
          ;(map.getSource(POINTS_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(dataAt(z))
        })
        map.on('mousemove', (e) => {
          const target = targetOf(e)
          map.getCanvas().style.cursor = target ? 'pointer' : ''
          events.pointer(target, map.getZoom())
        })
        map.on('mouseout', () => events.pointer(null, map.getZoom()))
        map.on('click', (e) => events.tap(targetOf(e), map.getZoom()))
        map.on('move', () => events.moved(map.getZoom()))
        const sizeNow = () => {
          const canvas = map.getContainer()
          events.sized(canvas.clientWidth, canvas.clientHeight)
        }
        map.on('resize', sizeNow)
        sizeNow()
        const whenPainted = () => {
          const painted = isPainted({
            tilesLoaded: map.areTilesLoaded(),
            basemapLoaded: map.isSourceLoaded(BASEMAP_SOURCE),
            pointsLoaded: map.isSourceLoaded(POINTS_SOURCE),
            lang: start.lang,
            rtl: maplibregl.getRTLTextPluginStatus(),
          })
          if (painted) {
            map.off('idle', whenPainted)
            events.painted()
          }
        }
        map.on('idle', whenPainted)
      })

      const fit = (v: MapView) =>
        v.kind === 'bounds'
          ? map.fitBounds([v.west, v.south, v.east, v.north], { ...FIT, animate: false })
          : map.jumpTo({ center: [v.lon, v.lat], zoom: v.zoom })
      return {
        destroy: () => map.remove(),
        zoomTo: (lon, lat, zoom) => void map.easeTo({ center: [lon, lat], zoom }),
        fit: (v) => void fit(v),
        project: (lon, lat) => {
          const p = map.project([lon, lat])
          return { x: p.x, y: p.y }
        },
      }
    },
  }
}
