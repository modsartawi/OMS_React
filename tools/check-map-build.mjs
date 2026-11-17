// Map-build gate for oms-react (ticket 879; rewritten for Google by 911: BackOffice spec 3630 M29, M35 as amended
// 2026-11-17, ADR 0139; seam 7). Part of `npm run lint`.
//
// Builds the app in memory (production mode, nothing written to dist/) with the map's door,
// `src/core/map/LazyMapPanel.tsx`, as a second entry, so the map's chunk exists even before a screen draws a map, and
// is cut exactly as a screen's lazy import would cut it. Then:
//
//   1. M35 — the app's entry, and every analytics (board, report, print) and copilot chunk, reach no map code by
//      STATIC imports: the map arrives by a dynamic import only, when a map is on screen. And no chunk but the map's
//      names Google's map script hosts (`maps.googleapis.com`, `maps.gstatic.com`).
//   2. M29 — the map's chunks name no outside host but Google's (`MAP_ADDRESS_ALLOWED`, the drives' named list).
//   3. MapLibre, pmtiles and Protomaps are in no chunk; and the map's chunks hold the Google adapter (or the scan in 2
//      would scan nothing).
//   4. No built file, nor any file under `public/` (copied into dist/ as it is), holds a string shaped like a Google
//      API key: the key is the server's configuration (BackOffice 3986), never the build's.
//
// Exit non-zero with the findings, like the other gates.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { build } from 'vite'
import { googleNamedOutsideMap, isMapChunk, keyShapedStrings, MAP_ADDRESS_ALLOWED, mapCodeLeaks, outsideAddresses, retiredEngineIn } from './map-build-check.mjs'

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

// 1. The map loads only when shown, and only its chunk names Google.
for (const leak of mapCodeLeaks(chunks, ROOT)) failures.push(`map code loaded without a map on screen: ${leak}`)
for (const named of googleNamedOutsideMap(chunks, ROOT)) failures.push(`Google named outside the map's chunk: ${named}`)

// 2. No outside host but Google's in the map's chunks.
// The map's chunks: the map's own (`isMapChunk`) and every chunk holding a module of `src/core/map/` (its drawing rules).
const mapChunks = chunks.filter((c) => isMapChunk(c, ROOT) || c.moduleIds.some((id) => toPosix(id).includes('/src/core/map/')))
for (const c of mapChunks) for (const address of outsideAddresses(c.code, MAP_ADDRESS_ALLOWED)) failures.push(`${c.fileName}: names ${address}`)

// 3. The retired engine is gone; the map's chunks hold the Google adapter.
for (const c of retiredEngineIn(chunks, ROOT)) failures.push(`the retired map engine is in a chunk: ${c}`)
if (!mapChunks.some((c) => c.moduleIds.some((id) => /src[\\/]core[\\/]map[\\/]google-engine\.ts$/.test(id))))
  failures.push('no built chunk holds the Google adapter: the check would scan nothing (did the map door move?)')

// 4. No key in any built file (chunks, assets, and public/ as copied).
const builtFiles = outputs.map((o) => [o.fileName, o.type === 'chunk' ? o.code : typeof o.source === 'string' ? o.source : Buffer.from(o.source).toString('latin1')])
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
for (const f of walk('public')) builtFiles.push([toPosix(f), readFileSync(f).toString('latin1')])
for (const [file, text] of builtFiles) for (const k of keyShapedStrings(text)) failures.push(`${file}: holds a key-shaped string ${k.slice(0, 6)}…`)

if (failures.length) {
  console.error(`check-map-build: ${failures.length} finding(s)`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`check-map-build: ok — ${mapChunks.length} map chunk(s) loaded only on demand, naming no host but Google's; no retired engine; no key in ${builtFiles.length} built file(s)`)
