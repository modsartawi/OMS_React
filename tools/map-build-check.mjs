// The checks on the built app for the map chart (ticket 879; rewritten for Google by 911: BackOffice spec 3630 M29, M35
// as amended 2026-11-17, ADR 0139; seam 7). Pure: they read text and the bundler's chunk graph; `check-map-build.mjs`
// feeds them a real build.

import { GOOGLE_MAP_HOSTS } from './google-map-hosts.mjs'

const REASONS = {
  'maps.googleapis.com': 'Google’s Maps JavaScript script (fetched by `google-loader` when a map starts), its libraries and the raster tiles',
  'maps.gstatic.com': 'Google’s map images: the logo, the controls, the markers’ sprites',
  'fonts.googleapis.com': 'the Roboto stylesheet Google’s own controls ask for',
  'fonts.gstatic.com': 'the Roboto font files that stylesheet names',
}

/**
 * The outside hosts the map's code may name: Google's, and only Google's (ADR 0139) — the same named list the map drives
 * let through (`./google-map-hosts.mjs`) and BackOffice 3987's PDF proof allows. Each with its reason. A host is matched
 * exactly: no sub-domain, look-alike or other Google host passes.
 */
export const MAP_ADDRESS_ALLOWED = new Map(
  GOOGLE_MAP_HOSTS.map((host) => {
    if (!REASONS[host]) throw new Error(`map-build-check: Google host ${host} has no reason written beside it`)
    return [host, REASONS[host]]
  }),
)

// An absolute address (a scheme, or protocol-relative `//host` after a quote, a bracket or an `=`/`:`/`,`), whose host
// has a dot. A path on our own site (`/api/...`) and a comment (`// see`) are not one.
const ADDRESS = /(?:\b(?:https?|wss?):|(?<=["'`(=:,\s]))\/\/([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)(?::\d+)?[^\s"'`)<>\\]*/g

/** Every address in `text` whose host `allowedHosts` does not name, in order, each once. */
export function outsideAddresses(text, allowedHosts) {
  const found = []
  for (const m of text.matchAll(ADDRESS)) {
    const [address, host] = m
    if (allowedHosts.has(host.toLowerCase()) || found.includes(address)) continue
    found.push(address)
  }
  return found
}

// A string literal that is a host on its own, with its port and path if any (review G7): an address joined to its scheme
// at run time (`"https://" + "tiles.example.com"`) has no scheme beside its host for {@link outsideAddresses} to find.
// Taken as a host only when its last label is a top-level domain an address would use, so a module path ("./a.js"), a
// property path ("google.maps") or a number ("1.5") is not one.
const BARE_HOST =
  /(?<=["'`])((?:[A-Za-z0-9-]+\.)+(?:com|net|org|io|dev|app|cloud|co|ai|xyz|info|biz|me|tech|site|online|gov|edu|sa|ae|bh|kw|om|qa|uk|de|fr|nl|ru|cn|jp|in|us|eu))(?::\d+)?(?:\/[^\s"'`]*)?(?=["'`])/g

/** Every string literal in `text` that is a host `allowedHosts` does not name (with its path), in order, each once. */
export function bareHostLiterals(text, allowedHosts) {
  const found = []
  for (const m of String(text).matchAll(BARE_HOST)) {
    const [literal, host] = m
    if (allowedHosts.has(host.toLowerCase()) || found.includes(literal)) continue
    found.push(literal)
  }
  return found
}

// Google's API keys: `AIza` and 35 more of `[0-9A-Za-z_-]`. Any such run of 30 or more is taken as a key.
const KEY_SHAPED = /AIza[0-9A-Za-z_-]{30,}/g

/**
 * Every string in `text` shaped like a Google API key. The key is configuration on the server (BackOffice 3986: the
 * model's `maps` part), never in the build.
 */
export function keyShapedStrings(text) {
  return [...new Set([...String(text).matchAll(KEY_SHAPED)].map((m) => m[0]))]
}

/** The map's own code: what `src/core/map/LazyMapPanel.tsx` keeps out of every other chunk. */
const MAP_MODULES = [
  ['src/core/map/MapPanel.tsx', 'MapPanel'],
  ['src/core/map/google-engine.ts', 'google-engine'],
  ['src/core/map/google-loader.ts', 'google-loader'],
]

/** The retired engine (ADR 0135, superseded by 0139): in no chunk. */
const RETIRED_MODULES = [
  ['node_modules/maplibre-gl/', 'maplibre-gl'],
  ['node_modules/pmtiles/', 'pmtiles'],
  ['node_modules/@protomaps/basemaps/', '@protomaps/basemaps'],
]

const posix = (p) => p.replaceAll('\\', '/')

/** The modules of `list` a chunk carries, by name, each once. */
function modulesIn(chunk, root, list) {
  const names = []
  for (const id of chunk.moduleIds ?? []) {
    const rel = posix(id).slice(posix(root).length + 1)
    for (const [prefix, name] of list) if (rel.startsWith(prefix) && !names.includes(name)) names.push(name)
  }
  return names
}

/**
 * The map's chunks, by file (review G6): those reached from the map panel's chunk (`MapPanel.tsx`, the target of
 * `LazyMapPanel`'s dynamic import) and from no entry by any road that does not pass through it. A chunk the app reaches
 * another way (a screen importing the loader statically) is not the map's, so it gets no exemption for naming Google.
 */
export function mapChunkFiles(chunks, root) {
  const byFile = new Map(chunks.filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]))
  const isPanel = (c) => posix(c.facadeModuleId ?? '').slice(posix(root).length + 1) === 'src/core/map/MapPanel.tsx'
  const reach = (starts, stop) => {
    const seen = new Set()
    const todo = [...starts]
    while (todo.length) {
      const c = byFile.get(todo.pop())
      if (!c || seen.has(c.fileName) || stop(c)) continue
      seen.add(c.fileName)
      todo.push(...(c.imports ?? []), ...(c.dynamicImports ?? []))
    }
    return seen
  }
  const all = [...byFile.values()]
  const outside = reach(all.filter((c) => c.isEntry && !isPanel(c)).map((c) => c.fileName), isPanel)
  const map = reach(all.filter(isPanel).map((c) => c.fileName), (c) => outside.has(c.fileName))
  return map
}

/** The stylesheets the map's chunks bring (review G7): scanned for outside hosts like the chunks' code. */
export function mapCssFiles(chunks, mapFiles) {
  const css = []
  for (const c of chunks) if (c.type === 'chunk' && mapFiles.has(c.fileName)) for (const f of c.viteMetadata?.importedCss ?? []) if (!css.includes(f)) css.push(f)
  return css
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
        const code = c ? modulesIn(c, root, MAP_MODULES) : []
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

/**
 * Google's hosts that serve the map's script and images (not the fonts: AG Grid's theme font loader names
 * `fonts.googleapis.com` in the grid's own chunk, and is no map).
 */
const GOOGLE_SCRIPT_HOSTS = GOOGLE_MAP_HOSTS.filter((h) => h.startsWith('maps.'))

/**
 * Every chunk other than the map's that names one of Google's map script hosts, as `file: names host`. Google's script
 * is fetched by the map's own chunk, when a map is on screen, and from nowhere else.
 */
export function googleNamedOutsideMap(chunks, root) {
  const found = []
  const mapFiles = mapChunkFiles(chunks, root)
  for (const c of chunks) {
    if (c.type !== 'chunk' || mapFiles.has(c.fileName)) continue
    for (const host of GOOGLE_SCRIPT_HOSTS) if (String(c.code ?? '').includes(host)) found.push(`${c.fileName}: names ${host}`)
  }
  return found
}

/** Every chunk holding MapLibre, pmtiles or Protomaps, as `file (packages)`. */
export function retiredEngineIn(chunks, root) {
  const found = []
  for (const c of chunks) {
    if (c.type !== 'chunk') continue
    const names = modulesIn(c, root, RETIRED_MODULES)
    if (names.length) found.push(`${c.fileName} (${names.join(', ')})`)
  }
  return found
}
