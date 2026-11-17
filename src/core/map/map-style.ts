import { layers, namedFlavor } from '@protomaps/basemaps'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

/**
 * The map's one style (spec 3630 M33): the quiet grey base, so the points carry the colour. Light only.
 *
 * Every file it names is on our own site (M29), at the paths of BackOffice 3634:
 * - the base map, one PMTiles file read by byte range, at {@link BASEMAP_PATH};
 * - the glyphs (Noto Sans, SIL OFL 1.1) and the grayscale sprites, vendored under `public/map/` from
 *   `protomaps/basemaps-assets` at commit 028c18f7.
 *
 * The layers are `@protomaps/basemaps`' own (pinned exactly), written for the Protomaps tile layout the base-map file
 * carries.
 */

/** The one fixed path the base-map file is deployed at, beside the web app (BackOffice 3634, M30). */
export const BASEMAP_PATH = '/basemap/ksa-bh.pmtiles'

/** The base map's source id in the style. */
export const BASEMAP_SOURCE = 'protomaps'

export const GLYPHS_PATH = '/map/fonts/{fontstack}/{range}.pbf'
export const SPRITE_PATH = '/map/sprites/grayscale'

/** MapLibre's Arabic text-shaping add-on (`@mapbox/mapbox-gl-rtl-text` 0.3.0, BSD-2), vendored under `public/map/`. */
export const RTL_TEXT_PLUGIN_PATH = '/map/rtl-text/mapbox-gl-rtl-text-0.3.0.js'

const ITALIC = 'Noto Sans Italic'
const REGULAR = 'Noto Sans Regular'

/**
 * The basemaps water labels are set in Noto Sans Italic, and its glyph files carry no Arabic letters (BackOffice
 * 3634: its `1536-1791` range is empty). Under Arabic the sea and lake names are Arabic, so they are set in Regular.
 */
function withoutItalic(layer: LayerSpecification): LayerSpecification {
  const text = JSON.stringify(layer)
  if (!text.includes(ITALIC)) return layer
  return JSON.parse(text.split(ITALIC).join(REGULAR)) as LayerSpecification
}

export function mapStyle(lang: 'en' | 'ar', origin: string): StyleSpecification {
  const base = layers(BASEMAP_SOURCE, namedFlavor('grayscale'), { lang }) as LayerSpecification[]
  return {
    version: 8,
    glyphs: origin + GLYPHS_PATH,
    sprite: origin + SPRITE_PATH,
    sources: {
      [BASEMAP_SOURCE]: { type: 'vector', url: `pmtiles://${origin}${BASEMAP_PATH}` },
    },
    layers: lang === 'ar' ? base.map(withoutItalic) : base,
  }
}

// The MapLibre engine's own reads (879; moved here from `./map-panel` by 908, which put Google behind the port). Removed
// with MapLibre by 911.

export type MapLang = 'en' | 'ar'

/**
 * Whether an engine error means the base-map file cannot be read (review W5): an error on the base map's own source that
 * is not about one tile — the file or its header not read. One tile failing leaves the rest of the map drawn.
 */
export function isBasemapUnreadable(e: { sourceId?: string; tile?: unknown; error?: unknown }): boolean {
  return e.sourceId === BASEMAP_SOURCE && e.tile == null
}

/** The text-shaping add-on's state, as MapLibre reports it (`unavailable`, `deferred`, `requested`, `loading`, `loaded`, `error`). */
export type RtlTextStatus = string

/**
 * Whether the map is painted (879; review W6): the base map's tiles and the points are in, and on an Arabic screen its
 * letters are shaped — the add-on has loaded (or failed to: unshaped labels are not an undrawn map). Until then the print
 * page would print Arabic labels unjoined. On an English screen the add-on is not waited for.
 */
export function isPainted(p: { tilesLoaded: boolean; basemapLoaded: boolean; pointsLoaded: boolean; lang: MapLang; rtl: RtlTextStatus }): boolean {
  if (!p.tilesLoaded || !p.basemapLoaded || !p.pointsLoaded) return false
  return p.lang !== 'ar' || p.rtl === 'loaded' || p.rtl === 'error'
}
