import { PLAIN_INK, type MapGrouping, type MapPoint } from '@/core/map/map-drawing'
import { formatTick, formatValue } from '@/core/charts/format'
import type { AnalyticsMapLegend, AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { viewMeasureOf } from './view-model'

/**
 * The map chart's own rules on the web (oms-react 880, BackOffice spec 3630 M13, M22-M26; the door is 3638). Pure: no
 * React, and no map code — the map itself is `@/core/map/LazyMapPanel`, fetched only when a map is on screen (M35).
 */

/** Which measure a map draws as each point's size, and which as its colour (none with one measure). */
export interface MapRoles {
  size: string | null
  colour: string | null
}

/** The first measure is the size, the second the colour (M13): the order the query holds is the choice. */
export function mapRoles(definition: AnalyticsViewDefinition): MapRoles {
  const [size = null, colour = null] = definition.query.measures
  return { size, colour }
}

/** The definition with the size and the colour swapped: its two measures in the other order. One measure is unchanged. */
export function swapMapMeasures(definition: AnalyticsViewDefinition): AnalyticsViewDefinition {
  const measures = definition.query.measures
  if (measures.length !== 2) return definition
  return { ...definition, query: { ...definition.query, measures: [measures[1], measures[0]] } }
}

/** The `place` columns that hold a store's coordinates on a map result (3638 `AnalyticsMapChart.PlaceKeys`). */
export const MAP_LATITUDE = 'latitude'
export const MAP_LONGITUDE = 'longitude'

/** A view is drawn as a map. */
export const drawsAsMap = (definition: AnalyticsViewDefinition): boolean => definition.chart.type === 'map'

const coordinate = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * The map panel's points: one per row that has both coordinates, named by its store (the result's dimension column).
 * A store with no coordinates is still a row of the answer (its table shows it) but is not on the map.
 */
export function mapPoints(result: AnalyticsQueryResult): MapPoint[] {
  const idKey = result.columns.find((c) => c.role === 'dimension')?.key ?? 'store'
  const points: MapPoint[] = []
  for (const row of result.rows) {
    const lat = coordinate(row[MAP_LATITUDE])
    const lon = coordinate(row[MAP_LONGITUDE])
    if (lat === null || lon === null) continue
    points.push({ id: String(row[idKey] ?? ''), lat, lon })
  }
  return points
}

// ── 881: size, colour, groups, card and legend from the server's legend (BackOffice 3639) ───────────────────────────

/** The `place` columns that name a store on its card (3638). */
export const MAP_STORE_NAME = 'store_name'
export const MAP_CITY = 'city'
/** The `legend` columns on each map row (3639): drawn hollow, and the id of the row's colour step. */
export const MAP_HOLLOW = 'hollow'
export const MAP_COLOUR_STEP = 'colour_step'

/**
 * The colours of a change (M16, M17): better, about the same, worse, and none (no earlier figure) — tokens of
 * `src/app/global.css`. Better and worse differ in lightness as well as hue, so they read without colour vision; the
 * legend names each in words. `npm run lint`'s contrast gate holds them.
 */
export const MAP_STEP_INKS = { better: '--map-better', same: '--map-same', worse: '--map-worse', none: '--map-none' } as const

/** The five steps of one colour of any other measure, lightest first (M16). */
export const MAP_SCALE_INKS = ['--map-scale-1', '--map-scale-2', '--map-scale-3', '--map-scale-4', '--map-scale-5'] as const

/**
 * A step's colour. A change's step by its id. A scale's k steps (k <= 5; the server merges equal cuts) are spread over
 * the five shades, the lowest the lightest and the highest the darkest; one step alone is the middle shade. `none`, and
 * an id the legend does not list, is the neutral colour.
 */
export function stepInk(colour: NonNullable<AnalyticsMapLegend['colour']>, id: string): string {
  if (colour.kind === 'change') return MAP_STEP_INKS[id as keyof typeof MAP_STEP_INKS] ?? MAP_STEP_INKS.none
  const ranked = colour.steps.filter((s) => s.id !== 'none')
  const i = ranked.findIndex((s) => s.id === id)
  if (i < 0) return MAP_STEP_INKS.none
  const k = ranked.length
  return MAP_SCALE_INKS[k === 1 ? 2 : Math.round((i * (MAP_SCALE_INKS.length - 1)) / (k - 1))]
}

const figure = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** What a map answer draws: its points, how its groups read, and its legend. */
export interface MapDrawing {
  points: MapPoint[]
  grouping: MapGrouping
}

/**
 * The map panel's points, each sized, coloured and carded from the server's legend (M15-M20, M23). Nothing here compares
 * a value with an edge: the size is the value's place between the legend's smallest and largest, the hollow mark and the
 * colour step are read off the row. A group sums the size figures as sent, and only when the legend says they add up.
 * An answer with no legend (a server before 3639) draws the plain points of 880.
 */
export function mapDrawing(result: AnalyticsQueryResult, model: AnalyticsModel, lang: string): MapDrawing {
  const legend = result.legend
  if (!legend) return { points: mapPoints(result), grouping: { sums: false, formatSum: () => '' } }
  const size = legend.size
  const sizeUnit = viewMeasureOf(size.key, model, result, lang).unit
  const colour = legend.colour
  const colourUnit = colour ? viewMeasureOf(colour.key, model, result, lang).unit : null
  const sizeLabel = saysIn(size.label, lang) || size.key
  const colourLabel = colour ? saysIn(colour.label, lang) || colour.key : ''
  const idKey = result.columns.find((c) => c.role === 'dimension')?.key ?? 'store'
  const shareOf = (v: number | null): number => {
    if (v === null || size.min === null || size.max === null) return 0
    if (size.max <= size.min) return 1
    return Math.min(1, Math.max(0, (v - size.min) / (size.max - size.min)))
  }
  const points: MapPoint[] = []
  for (const row of result.rows) {
    const lat = coordinate(row[MAP_LATITUDE])
    const lon = coordinate(row[MAP_LONGITUDE])
    if (lat === null || lon === null) continue
    const id = String(row[idKey] ?? '')
    const v = figure(row[size.key])
    const hollow = row[MAP_HOLLOW] === true
    points.push({
      id,
      lat,
      lon,
      size: hollow ? 0 : shareOf(v),
      hollow,
      ink: colour ? stepInk(colour, String(row[MAP_COLOUR_STEP] ?? '')) : PLAIN_INK,
      weight: v,
      card: {
        title: textOf(row, MAP_STORE_NAME) || id,
        subtitle: textOf(row, MAP_CITY),
        // As the table formats its cells (`@/core/charts/table-columns`): the column's unit, Latin digits, empty for none.
        figures: [
          { label: sizeLabel, value: formatValue(v, sizeUnit, lang) },
          ...(colour && colourUnit ? [{ label: colourLabel, value: formatValue(figure(row[colour.key]), colourUnit, lang) }] : []),
        ],
      },
    })
  }
  return { points, grouping: { sums: size.additive, formatSum: (n) => formatTick(n, sizeUnit, lang) } }
}

const textOf = (row: AnalyticsRow, key: string): string => (typeof row[key] === 'string' ? (row[key] as string) : '')

/** The legend as drawn (M17, M18): both labels in the screen's language, the size scale's ends, each step in words. */
export interface MapLegendView {
  /** The size measure, its smallest and largest figure as the table writes them, and whether any point is hollow. */
  size: { label: string; min: string; max: string; hollow: boolean }
  /** The colour measure and its steps, in the server's order; null with one measure (one colour, {@link PLAIN_INK}). */
  colour: { label: string; steps: { id: string; words: string; ink: string }[] } | null
}

/** The legend of a map answer; null when the answer carries none. */
export function mapLegendView(result: AnalyticsQueryResult, model: AnalyticsModel, lang: string): MapLegendView | null {
  const legend = result.legend
  if (!legend) return null
  const unit = viewMeasureOf(legend.size.key, model, result, lang).unit
  const colour = legend.colour
  return {
    size: {
      label: saysIn(legend.size.label, lang) || legend.size.key,
      min: formatValue(legend.size.min, unit, lang),
      max: formatValue(legend.size.max, unit, lang),
      hollow: result.rows.some((r) => r[MAP_HOLLOW] === true),
    },
    colour: colour
      ? { label: saysIn(colour.label, lang) || colour.key, steps: colour.steps.map((s) => ({ id: s.id, words: saysIn(s.label, lang), ink: stepInk(colour, s.id) })) }
      : null,
  }
}
