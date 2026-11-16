import { describe, expect, it } from 'vitest'
import { MAP_ADDRESS_ALLOWED, mapCodeLeaks, outsideAddresses } from './map-build-check.mjs'

// Ticket 879 (BackOffice spec 3630 M29, M35; seam 7): the checks on the built app, as pure functions over its text and
// its chunk graph. `check-map-build.mjs` runs them over a real build in `npm run lint`.

describe('an address on another host, in the map code or its style', () => {
  it('a CDN the page would fetch is found', () => {
    const text = 'setRTLTextPlugin("https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js",!1)'
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual(['https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js'])
  })

  it('a tile or font server with no scheme (protocol-relative) is found', () => {
    const text = `glyphs:"//protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf"`
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual(['//protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf'])
  })

  it('the credit line\u2019s link is the one allowed address', () => {
    const text = 'href:"https://www.openstreetmap.org/copyright",text:"\u00a9 OpenStreetMap"'
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual([])
  })

  it('an allowed address allows only itself: the same host\u2019s tile server is found', () => {
    const text = 'tiles:["https://www.openstreetmap.org/tiles/{z}/{x}/{y}.png"]'
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual(['https://www.openstreetmap.org/tiles/{z}/{x}/{y}.png'])
  })

  it('a path on our own site is not an outside address', () => {
    const text = 'glyphs:e+"/map/fonts/{fontstack}/{range}.pbf",url:`pmtiles://${e}/basemap/ksa-bh.pmtiles`'
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual([])
  })

  it('a JavaScript comment is not an address', () => {
    expect(outsideAddresses('a=1;// see the README\nb=2', MAP_ADDRESS_ALLOWED)).toEqual([])
  })
})

/** A chunk of the build, as the bundler reports it. */
const chunk = (fileName, { modules = [], imports = [], dynamicImports = [], isEntry = false, facade = null } = {}) => ({
  type: 'chunk',
  fileName,
  isEntry,
  facadeModuleId: facade,
  moduleIds: modules,
  imports,
  dynamicImports,
})

const ROOT = 'C:/app'
const MAPLIBRE = `${ROOT}/node_modules/maplibre-gl/dist/maplibre-gl.js`
const BOARD = `${ROOT}/src/features/analytics/boards/AnalyticsBoardPage.tsx`

describe('the map code is loaded only when a map is on screen', () => {
  it('a map reached by a dynamic import only leaks nowhere', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, imports: ['assets/react.js'], dynamicImports: ['assets/AnalyticsBoardPage.js'] }),
      chunk('assets/react.js', { modules: [`${ROOT}/node_modules/react/index.js`] }),
      chunk('assets/AnalyticsBoardPage.js', { facade: BOARD, modules: [BOARD], dynamicImports: ['assets/MapPanel.js'] }),
      chunk('assets/MapPanel.js', { facade: `${ROOT}/src/core/map/MapPanel.tsx`, modules: [MAPLIBRE] }),
    ]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual([])
  })

  it('the entry reaching the map code by static imports is a leak, named with the path to it', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, imports: ['assets/shared.js'] }),
      chunk('assets/shared.js', { imports: ['assets/maplibre.js'] }),
      chunk('assets/maplibre.js', { modules: [MAPLIBRE] }),
    ]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual(['assets/index.js -> assets/shared.js -> assets/maplibre.js (maplibre-gl)'])
  })

  it('a board page chunk reaching the map code by a static import is a leak', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, dynamicImports: ['assets/AnalyticsBoardPage.js'] }),
      chunk('assets/AnalyticsBoardPage.js', { facade: BOARD, modules: [BOARD], imports: ['assets/MapPanel.js'] }),
      chunk('assets/MapPanel.js', { modules: [MAPLIBRE] }),
    ]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual(['assets/AnalyticsBoardPage.js -> assets/MapPanel.js (maplibre-gl)'])
  })

  it('the copilot panel chunk is held to the same rule', () => {
    const PANEL = `${ROOT}/src/features/copilot/CopilotPanel.tsx`
    const chunks = [
      chunk('assets/CopilotPanel.js', { facade: PANEL, modules: [PANEL, `${ROOT}/node_modules/pmtiles/dist/esm/index.js`] }),
    ]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual(['assets/CopilotPanel.js (pmtiles)'])
  })
})
