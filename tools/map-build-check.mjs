// The checks on the built app for the map chart (ticket 879, BackOffice spec 3630 M29, M35; seam 7). Pure: they read
// text and the bundler's chunk graph; `check-map-build.mjs` feeds them a real build.

/**
 * The addresses on another host the map's code may name, each because the page never fetches it. Exact URLs: an
 * allowed address allows only itself, never its host.
 */
export const MAP_ADDRESS_ALLOWED = new Map([
  // 908 (ADR 0139): the one outside address the map fetches. 911 rewrites this list as Google's hosts only.
  ['https://maps.googleapis.com/maps/api/js', 'Google’s Maps JavaScript script, fetched by `google-loader` when a map starts (ADR 0139)'],
  ['https://www.openstreetmap.org/copyright', 'the credit line’s link (M34): followed by a reader’s click, never fetched'],
  ['http://www.w3.org/2000/svg', 'the SVG namespace: an identifier in createElementNS and CSS data URIs, never fetched'],
  ['https://maplibre.org/', 'MapLibre’s logo and default-credit link: off in this panel, and a link, never fetched'],
  ['https://github.com/mapbox/mapbox-gl-js/issues/2907', 'the text of a MapLibre warning ("too many glyphs"), never fetched'],
  ['https://github.com/maplibre/maplibre-gl-js/blob/v5.6.0/LICENSE.txt', 'MapLibre’s licence banner comment'],
  ['https://github.com/protomaps/PMTiles/tree/main/js', 'the text of a pmtiles error message, never fetched'],
])

// An absolute address (a scheme, or protocol-relative `//host` after a quote, a bracket or an `=`/`:`/`,`), whose host
// has a dot. A path on our own site (`/map/...`) and a comment (`// see`) are not one.
const ADDRESS = /(?:\b(?:https?|wss?):|(?<=["'`(=:,\s]))\/\/[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?[^\s"'`)<>\\]*/g

/** Every address on another host in `text` that `allowed` does not name, in order, each once. */
export function outsideAddresses(text, allowed) {
  const found = []
  for (const m of text.matchAll(ADDRESS)) {
    const address = m[0]
    if (allowed.has(address) || found.includes(address)) continue
    found.push(address)
  }
  return found
}

/** The map's own code: what `src/core/map/LazyMapPanel.tsx` keeps out of every other chunk. */
const MAP_MODULES = [
  ['node_modules/maplibre-gl/', 'maplibre-gl'],
  ['node_modules/pmtiles/', 'pmtiles'],
  ['node_modules/@protomaps/basemaps/', '@protomaps/basemaps'],
  ['src/core/map/MapPanel.tsx', 'MapPanel'],
  ['src/core/map/google-engine.ts', 'google-engine'],
  ['src/core/map/google-loader.ts', 'google-loader'],
  ['src/core/map/maplibre-engine.ts', 'maplibre-engine'],
  ['src/core/map/map-style.ts', 'map-style'],
]

const posix = (p) => p.replaceAll('\\', '/')

/** The map modules a chunk carries, by name, each once. */
function mapCodeIn(chunk, root) {
  const names = []
  for (const id of chunk.moduleIds ?? []) {
    const rel = posix(id).slice(posix(root).length + 1)
    for (const [prefix, name] of MAP_MODULES) if (rel.startsWith(prefix) && !names.includes(name)) names.push(name)
  }
  return names
}

/** A chunk that must load no map code: the app's entry, and every analytics (board, report) and copilot chunk. */
function isWatched(chunk, root) {
  if (chunk.isEntry && posix(chunk.facadeModuleId ?? '').endsWith('/index.html')) return true
  const rel = posix(chunk.facadeModuleId ?? '').slice(posix(root).length + 1)
  return rel.startsWith('src/features/analytics/') || rel.startsWith('src/features/copilot/')
}

/**
 * Every watched chunk whose STATIC imports reach map code, as `a -> b -> c (module)`: the shortest such path. A dynamic
 * import is how the map is meant to arrive, so it is not followed.
 */
export function mapCodeLeaks(chunks, root) {
  const byFile = new Map(chunks.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]))
  const leaks = []
  for (const start of byFile.values()) {
    if (!isWatched(start, root)) continue
    const seen = new Set([start.fileName])
    let frontier = [[start.fileName]]
    let hit = null
    while (frontier.length && !hit) {
      const next = []
      for (const path of frontier) {
        const c = byFile.get(path[path.length - 1])
        const code = c ? mapCodeIn(c, root) : []
        if (code.length) {
          hit = `${path.join(' -> ')} (${code.join(', ')})`
          break
        }
        for (const imp of c?.imports ?? []) if (!seen.has(imp)) (seen.add(imp), next.push([...path, imp]))
      }
      frontier = next
    }
    if (hit) leaks.push(hit)
  }
  return leaks
}
