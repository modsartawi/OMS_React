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
