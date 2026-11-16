// Map-build gate for oms-react (ticket 879, BackOffice spec 3630 M29 + M35; seam 7). Part of `npm run lint`.
//
// Builds the app in memory (production mode, nothing written to dist/) with the map's door,
// `src/core/map/LazyMapPanel.tsx`, as a second entry, so the map's chunk exists even before a screen draws a map, and
// is cut exactly as a screen's lazy import would cut it. Then:
//
//   1. M35 — the app's entry, and every analytics (board, report, print) and copilot chunk, reach no map code by
//      STATIC imports. The map arrives by a dynamic import only, when a map is on screen.
//   2. M29 — the map's chunks, its stylesheet and the files under `public/map/` name no address on another host
//      except those in `MAP_ADDRESS_ALLOWED` (the licence texts beside them, `.txt`/`.md`, are never loaded by the page), each a link or a message the page never fetches. (The style itself is
//      built by code in those chunks; `src/core/map/map-panel.test.ts` checks its output names our origin only.)
//
// Exit non-zero with the findings, like the other gates.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { build } from 'vite'
import { MAP_ADDRESS_ALLOWED, mapCodeLeaks, outsideAddresses } from './map-build-check.mjs'

const ROOT = resolve('.')
const toPosix = (p) => p.split(sep).join('/')

const result = await build({
  configFile: resolve('vite.config.ts'),
  mode: 'production',
  logLevel: 'error',
  build: {
    write: false,
    reportCompressedSize: false,
    rolldownOptions: {
      input: { index: resolve('index.html'), 'map-door': resolve('src/core/map/LazyMapPanel.tsx') },
    },
  },
})
const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output)
const chunks = outputs.filter((o) => o.type === 'chunk')

const failures = []

// 1. The map loads only when shown.
for (const leak of mapCodeLeaks(chunks, ROOT)) failures.push(`map code loaded without a map on screen: ${leak}`)

// 2. No outside address. The map's chunks: every chunk holding a map module (the same list `mapCodeLeaks` uses).
const mapChunks = chunks.filter((c) => c.moduleIds.some((id) => /node_modules[\\/](maplibre-gl|pmtiles|@protomaps[\\/]basemaps)[\\/]|src[\\/]core[\\/]map[\\/]/.test(id)))
if (!mapChunks.some((c) => c.moduleIds.some((id) => /node_modules[\\/]maplibre-gl[\\/]/.test(id))))
  failures.push('no built chunk holds MapLibre: the check would scan nothing (did the map door move?)')
const scanned = []
for (const c of mapChunks) scanned.push([c.fileName, c.code])
for (const a of outputs.filter((o) => o.type === 'asset' && o.fileName.endsWith('.css')))
  if (String(a.source).includes('maplibregl')) scanned.push([a.fileName, String(a.source)])
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
for (const f of walk('public/map').filter((f) => /\.(js|json|css)$/.test(f))) scanned.push([toPosix(f), readFileSync(f, 'utf8')])

for (const [file, text] of scanned) for (const address of outsideAddresses(text, MAP_ADDRESS_ALLOWED)) failures.push(`${file}: names ${address}`)

if (failures.length) {
  console.error(`check-map-build: ${failures.length} finding(s)`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`check-map-build: ok — ${mapChunks.length} map chunk(s) loaded only on demand; ${scanned.length} file(s) name no outside address`)
