import { describe, expect, it } from 'vitest'
import { GOOGLE_MAP_HOSTS } from './google-map-hosts.mjs'
import { bareHostLiterals, googleNamedOutsideMap, keyShapedStrings, MAP_ADDRESS_ALLOWED, mapChunkFiles, mapCodeLeaks, mapCssFiles, outsideAddresses, retiredEngineIn } from './map-build-check.mjs'

// Ticket 879, rewritten by 911 for Google (BackOffice spec 3630 M29, M35 as amended 2026-11-17, ADR 0139; seam 7): the
// checks on the built app, as pure functions over its text and its chunk graph. `check-map-build.mjs` runs them over a
// real build in `npm run lint`.

describe('the map names no outside host but Google’s', () => {
  it('the allowed hosts are exactly the drives’ one named list of Google’s hosts, each with its reason', () => {
    expect([...MAP_ADDRESS_ALLOWED.keys()]).toEqual([...GOOGLE_MAP_HOSTS])
    for (const reason of MAP_ADDRESS_ALLOWED.values()) expect(reason.length).toBeGreaterThan(10)
  })

  it('each of Google’s hosts passes, at any path', () => {
    for (const host of ['maps.googleapis.com', 'maps.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'])
      expect(outsideAddresses(`src:"https://${host}/some/path?x=1"`, MAP_ADDRESS_ALLOWED)).toEqual([])
    expect(outsideAddresses('const SCRIPT_ORIGIN="https://maps.googleapis.com/maps/api/js";', MAP_ADDRESS_ALLOWED)).toEqual([])
  })

  it('a CDN the page would fetch is found', () => {
    const text = 'import("https://unpkg.com/@googlemaps/js-api-loader@1.16.8/dist/index.min.js")'
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual(['https://unpkg.com/@googlemaps/js-api-loader@1.16.8/dist/index.min.js'])
  })

  it('a tile server with no scheme (protocol-relative) is found', () => {
    const text = `tiles:"//tile.openstreetmap.org/{z}/{x}/{y}.png"`
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual(['//tile.openstreetmap.org/{z}/{x}/{y}.png'])
  })

  it('a host is matched exactly: a Google look-alike, a sub-domain or another Google host is found', () => {
    const text = '"https://maps.googleapis.com.evil.example/js" "https://x.maps.gstatic.com/a" "https://www.google.com/maps/search"'
    expect(outsideAddresses(text, MAP_ADDRESS_ALLOWED)).toEqual([
      'https://maps.googleapis.com.evil.example/js',
      'https://x.maps.gstatic.com/a',
      'https://www.google.com/maps/search',
    ])
  })

  it('a host is matched with its port ignored and its case folded', () => {
    expect(outsideAddresses('"https://MAPS.googleapis.com:443/maps/api/js"', MAP_ADDRESS_ALLOWED)).toEqual([])
  })

  it('a path on our own site is not an outside address', () => {
    expect(outsideAddresses('fetch(e+"/api/Analytics/Model")', MAP_ADDRESS_ALLOWED)).toEqual([])
  })

  it('a JavaScript comment is not an address', () => {
    expect(outsideAddresses('a=1;// see the README\nb=2', MAP_ADDRESS_ALLOWED)).toEqual([])
  })
})

describe('no key is in any built file', () => {
  it('a string shaped like a Google API key is found', () => {
    const key = 'AIzaSyB' + 'x'.repeat(32)
    expect(keyShapedStrings(`const k="${key}";`)).toEqual([key])
  })

  it('a key-shaped string inside a script address is found', () => {
    const key = 'AIza' + '0123456789abcdefghij_-ABCDEFGHIJKLMNO'.slice(0, 35)
    expect(keyShapedStrings(`"https://maps.googleapis.com/maps/api/js?key=${key}&v=3.66"`)).toEqual([key])
  })

  it('the word on its own, or a short run after it, is not a key', () => {
    expect(keyShapedStrings('AIza is the prefix of a key; AIzaShort')).toEqual([])
  })
})

/** A chunk of the build, as the bundler reports it. */
const chunk = (fileName, { modules = [], imports = [], dynamicImports = [], isEntry = false, facade = null, code = '', css = [] } = {}) => ({
  type: 'chunk',
  fileName,
  isEntry,
  facadeModuleId: facade,
  moduleIds: modules,
  imports,
  dynamicImports,
  code,
  viteMetadata: { importedCss: new Set(css) },
})

const ROOT = 'C:/app'
const PANEL = `${ROOT}/src/core/map/MapPanel.tsx`
const ENGINE = `${ROOT}/src/core/map/google-engine.ts`
const LOADER = `${ROOT}/src/core/map/google-loader.ts`
const BOARD = `${ROOT}/src/features/analytics/boards/AnalyticsBoardPage.tsx`

describe('the map code is loaded only when a map is on screen', () => {
  it('a map reached by a dynamic import only leaks nowhere', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, imports: ['assets/react.js'], dynamicImports: ['assets/AnalyticsBoardPage.js'] }),
      chunk('assets/react.js', { modules: [`${ROOT}/node_modules/react/index.js`] }),
      chunk('assets/AnalyticsBoardPage.js', { facade: BOARD, modules: [BOARD], dynamicImports: ['assets/MapPanel.js'] }),
      chunk('assets/MapPanel.js', { facade: PANEL, modules: [PANEL, ENGINE, LOADER] }),
    ]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual([])
  })

  it('the entry reaching the map code by static imports is a leak, named with the path to it', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, imports: ['assets/shared.js'] }),
      chunk('assets/shared.js', { imports: ['assets/google.js'] }),
      chunk('assets/google.js', { modules: [ENGINE] }),
    ]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual(['assets/index.js -> assets/shared.js -> assets/google.js (google-engine)'])
  })

  it('a board page chunk reaching the map panel by a static import is a leak', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, dynamicImports: ['assets/AnalyticsBoardPage.js'] }),
      chunk('assets/AnalyticsBoardPage.js', { facade: BOARD, modules: [BOARD], imports: ['assets/MapPanel.js'] }),
      chunk('assets/MapPanel.js', { modules: [PANEL] }),
    ]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual(['assets/AnalyticsBoardPage.js -> assets/MapPanel.js (MapPanel)'])
  })

  it('the copilot panel chunk is held to the same rule', () => {
    const COPILOT = `${ROOT}/src/features/copilot/CopilotPanel.tsx`
    const chunks = [chunk('assets/CopilotPanel.js', { facade: COPILOT, modules: [COPILOT, LOADER] })]
    expect(mapCodeLeaks(chunks, ROOT)).toEqual(['assets/CopilotPanel.js (google-loader)'])
  })
})

describe('no Google script is named outside the map’s own chunk', () => {
  it('the map’s chunk naming Google’s script is fine', () => {
    const chunks = [chunk('assets/MapPanel.js', { facade: PANEL, modules: [PANEL, LOADER], code: '"https://maps.googleapis.com/maps/api/js"' })]
    expect(googleNamedOutsideMap(chunks, ROOT)).toEqual([])
  })

  it('another chunk naming one of Google’s map hosts is found', () => {
    const chunks = [
      chunk('assets/MapPanel.js', { facade: PANEL, modules: [PANEL, LOADER] }),
      chunk('assets/AnalyticsBoardPage.js', { facade: BOARD, modules: [BOARD], code: 's.src="https://maps.googleapis.com/maps/api/js?v=3"' }),
    ]
    expect(googleNamedOutsideMap(chunks, ROOT)).toEqual(['assets/AnalyticsBoardPage.js: names maps.googleapis.com'])
  })

  it('maps.gstatic.com outside the map’s chunk is found too', () => {
    const chunks = [chunk('assets/shared.js', { code: '"https://maps.gstatic.com/mapfiles/x.png"' })]
    expect(googleNamedOutsideMap(chunks, ROOT)).toEqual(['assets/shared.js: names maps.gstatic.com'])
  })

  it('the grid’s Google Fonts stylesheet (AG Grid’s theme font loader) is not a Google map script', () => {
    const chunks = [chunk('assets/grid-base.js', { code: '`https://fonts.googleapis.com/css2?family=${f}`' })]
    expect(googleNamedOutsideMap(chunks, ROOT)).toEqual([])
  })

  it('a link to google.com’s map site (the call centre’s location card) is not a Google script', () => {
    const chunks = [chunk('assets/LocationCard.js', { code: '`https://www.google.com/maps/search/?api=1&query=${a}`' })]
    expect(googleNamedOutsideMap(chunks, ROOT)).toEqual([])
  })
})

describe('the map’s chunks are those reached only through the map door’s dynamic import (review G6)', () => {
  const ORDERS = `${ROOT}/src/features/orders/OrdersPage.tsx`

  it('the panel’s chunk and what only it imports are the map’s; the app’s own chunks are not', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, dynamicImports: ['assets/AnalyticsBoardPage.js'] }),
      chunk('assets/AnalyticsBoardPage.js', { facade: BOARD, modules: [BOARD], dynamicImports: ['assets/MapPanel.js'] }),
      chunk('assets/MapPanel.js', { facade: PANEL, modules: [PANEL], imports: ['assets/google-engine.js'] }),
      chunk('assets/google-engine.js', { modules: [ENGINE, LOADER] }),
    ]
    expect([...mapChunkFiles(chunks, ROOT)].sort()).toEqual(['assets/MapPanel.js', 'assets/google-engine.js'])
  })

  it('a chunk holding the loader that another screen imports statically is not the map’s, and naming Google there is found', () => {
    const chunks = [
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, dynamicImports: ['assets/OrdersPage.js', 'assets/AnalyticsBoardPage.js'] }),
      chunk('assets/OrdersPage.js', { facade: ORDERS, modules: [ORDERS], imports: ['assets/google-loader.js'] }),
      chunk('assets/AnalyticsBoardPage.js', { facade: BOARD, modules: [BOARD], dynamicImports: ['assets/MapPanel.js'] }),
      chunk('assets/MapPanel.js', { facade: PANEL, modules: [PANEL, ENGINE], imports: ['assets/google-loader.js'] }),
      chunk('assets/google-loader.js', { modules: [LOADER], code: '"https://maps.googleapis.com/maps/api/js"' }),
    ]
    expect([...mapChunkFiles(chunks, ROOT)]).toEqual(['assets/MapPanel.js'])
    expect(googleNamedOutsideMap(chunks, ROOT)).toEqual(['assets/google-loader.js: names maps.googleapis.com'])
  })
})

describe('the map’s stylesheets are scanned, and a host written without its scheme is found (review G7)', () => {
  it('the stylesheets the map’s chunks bring are named for the scan', () => {
    const chunks = [
      chunk('assets/MapPanel.js', { facade: PANEL, modules: [PANEL], css: ['assets/MapPanel.css'] }),
      chunk('assets/index.js', { isEntry: true, facade: `${ROOT}/index.html`, css: ['assets/index.css'] }),
    ]
    expect(mapCssFiles(chunks, mapChunkFiles(chunks, ROOT))).toEqual(['assets/MapPanel.css'])
  })

  it('a tile server in a stylesheet’s url() is found', () => {
    expect(outsideAddresses('.m{background:url(https://tile.example.com/a.png)}', MAP_ADDRESS_ALLOWED)).toEqual(['https://tile.example.com/a.png'])
  })

  it('a host in a string of its own (joined to its scheme at run time) is found', () => {
    expect(bareHostLiterals('const u="https://"+"tiles.example.com"+"/"+z', MAP_ADDRESS_ALLOWED)).toEqual(['tiles.example.com'])
    expect(bareHostLiterals('`${proto}//${"cdn.example.net/pkg/x.js"}`', MAP_ADDRESS_ALLOWED)).toEqual(['cdn.example.net/pkg/x.js'])
  })

  it('Google’s own hosts, bare, pass; a word with a dot that is no host is not one', () => {
    expect(bareHostLiterals('"maps.googleapis.com" "fonts.gstatic.com"', MAP_ADDRESS_ALLOWED)).toEqual([])
    expect(bareHostLiterals('"e.g." "1.5" "data-map-markers" "google.maps" "./MapPanel.js" "a.b.css"', MAP_ADDRESS_ALLOWED)).toEqual([])
  })
})

describe('MapLibre, pmtiles and Protomaps are in no chunk', () => {
  it('a chunk holding a retired engine module is found, by package', () => {
    const chunks = [
      chunk('assets/MapPanel.js', { modules: [PANEL, `${ROOT}/node_modules/maplibre-gl/dist/maplibre-gl.js`, `${ROOT}/node_modules/pmtiles/dist/esm/index.js`] }),
      chunk('assets/style.js', { modules: [`${ROOT}/node_modules/@protomaps/basemaps/dist/index.js`] }),
      chunk('assets/index.js', { modules: [`${ROOT}/src/main.tsx`] }),
    ]
    expect(retiredEngineIn(chunks, ROOT)).toEqual(['assets/MapPanel.js (maplibre-gl, pmtiles)', 'assets/style.js (@protomaps/basemaps)'])
  })

  it('a build on Google alone holds none', () => {
    expect(retiredEngineIn([chunk('assets/MapPanel.js', { modules: [PANEL, ENGINE, LOADER] })], ROOT)).toEqual([])
  })
})
