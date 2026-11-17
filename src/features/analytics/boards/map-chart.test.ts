import { describe, expect, it } from 'vitest'
import type { AnalyticsModel } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { chartOffers, choiceOf, designerChoice, type ChartOffer } from './shape-rules'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mapPoints, mapRoles, swapMapMeasures } from './map-chart'
import PanelBody from './PanelBody'
import { PrintMapsContext } from './PrintMapsContext'
import { createPrintMaps, type MapPrintState, type PrintMaps } from './print-maps'
import { addedLayout, layoutReducer, minSizeOf, type LayoutState } from './layout'
import { drillTargets } from './drill'
import { readItem, readReport, readResult } from './wire'
import { readDefinition, readModel } from './wire'
import type { AnalyticsViewDefinition } from '@/core/models/analytics'

/**
 * oms-react 880 (BackOffice spec 3630 M13, M22, M25, M26; door 3638): the map chart in the designer, a view, a board
 * panel and a report block.
 */

const label = (en: string, ar: string) => ({ en, ar })
const ALL = ['store', 'city', 'channel_group', 'day']
const measure = (key: string, shape: 'additive' | 'rate' = 'additive') =>
  ({ key, area: 'sales', shape, unit: 'count', label: label(key, key), description: label('', ''), dimensions: ALL }) as const

const BASE: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [measure('till_sales'), measure('orders'), measure('returns'), measure('return_rate', 'rate')],
  dimensions: [
    { key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] },
    { key: 'city', kind: 'category', label: label('City', 'المدينة'), values: [] },
    { key: 'channel_group', kind: 'category', label: label('Channel', 'القناة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
}
/** The server lists `map` only with `Analytics:MapChart` on (3638). */
const MAP_ON: AnalyticsModel = { ...BASE, chartTypes: ['kpi', 'line', 'area', 'bar', 'donut', 'table', 'heatmap', 'combo', 'map'] }
const MAP_OFF: AnalyticsModel = { ...BASE, chartTypes: ['kpi', 'line', 'area', 'bar', 'donut', 'table', 'heatmap', 'combo'] }

const mapOffer = (model: AnalyticsModel, measures: string[], dimensions: string[], extra: { series?: number; calculations?: number } = {}): ChartOffer | undefined =>
  chartOffers({ measures, dimensions, ...extra }, model).find((o) => o.choice === 'map')

const reasonOf = (o: ChartOffer | undefined) => (o && !o.offered ? o.reason : null)

describe('the designer offers Map when the query fits (M13, M25)', () => {
  it('offers Map for one store breakdown with one or two measures', () => {
    expect(mapOffer(MAP_ON, ['till_sales'], ['store'])?.offered).toBe(true)
    expect(mapOffer(MAP_ON, ['till_sales', 'return_rate'], ['store'])?.offered).toBe(true)
    // A calculation counts as a measure, as the server's shape counts it: one measure and a change fits.
    expect(mapOffer(MAP_ON, ['till_sales'], ['store'], { calculations: 1 })?.offered).toBe(true)
  })

  it('does not list Map at all when the server does not accept it, or names no chart types (a server before 3638)', () => {
    expect(mapOffer(MAP_OFF, ['till_sales'], ['store'])).toBeUndefined()
    expect(mapOffer(BASE, ['till_sales'], ['store'])).toBeUndefined()
    expect(chartOffers({ measures: ['till_sales'], dimensions: ['store'] }, MAP_OFF)).toHaveLength(11)
  })

  it('lists Map last, after the eight types of today', () => {
    const choices = chartOffers({ measures: ['till_sales'], dimensions: ['store'] }, MAP_ON).map((o) => o.choice)
    expect(choices).toHaveLength(12)
    expect(choices[11]).toBe('map')
  })

  it('by city, with a date, with three measures or with named series it is unavailable, each with its own reason', () => {
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales'], ['city']))).toBe('mapStore')
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales'], ['store', 'channel_group']))).toBe('mapStore')
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales'], []))).toBe('mapStore')
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales'], ['store', 'day']))).toBe('mapDate')
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales'], ['day']))).toBe('mapDate')
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales', 'orders', 'returns'], ['store']))).toBe('mapMeasures')
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales', 'orders'], ['store'], { calculations: 1 }))).toBe('mapMeasures')
    expect(reasonOf(mapOffer(MAP_ON, ['till_sales'], ['store'], { series: 2 }))).toBe('mapSeries')
    expect(reasonOf(mapOffer(MAP_ON, [], ['store']))).toBe('noMeasure')
  })

  it('each reason, and the choice itself, has its words in both languages', () => {
    const words = (bundle: typeof en, key: string) => (bundle.editor.why as Record<string, string>)[key]
    for (const reason of ['mapStore', 'mapDate', 'mapMeasures', 'mapSeries']) {
      expect(words(en, reason), `en ${reason}`).toMatch(/\S/)
      expect(words(ar, reason), `ar ${reason}`).toMatch(/[؀-ۿ]/)
    }
    expect((en.editor.choice as Record<string, string>).map).toBe('Map')
    expect((ar.editor.choice as Record<string, string>).map).toMatch(/[؀-ۿ]/)
  })
})

describe("a map reads one area, as the server's shape does (review W7)", () => {
  const TWO_AREAS: AnalyticsModel = {
    ...MAP_ON,
    areas: [...MAP_ON.areas, { key: 'stock', available: true }],
    measures: [...MAP_ON.measures, { ...measure('stock_units'), area: 'stock' }],
  }

  it('measures from two areas are not offered a map, with its own reason', () => {
    expect(reasonOf(mapOffer(TWO_AREAS, ['till_sales', 'stock_units'], ['store']))).toBe('mapArea')
  })

  it('two measures of one area still are', () => {
    expect(mapOffer(TWO_AREAS, ['till_sales', 'orders'], ['store'])?.offered).toBe(true)
    expect(mapOffer(TWO_AREAS, ['stock_units'], ['store'])?.offered).toBe(true)
  })

  it('the reason has its words in both languages', () => {
    expect((en.editor.why as Record<string, string>).mapArea).toMatch(/\S/)
    expect((ar.editor.why as Record<string, string>).mapArea).toMatch(/[\u0600-\u06FF]/)
  })
})

describe('the model says which chart types the door accepts (3638 wire)', () => {
  it('reads chartTypes, keeping the types the web knows, in order; absent stays absent', () => {
    expect(readModel({ chartTypes: ['kpi', 'bar', 'map', 'sankey', 7] }).chartTypes).toEqual(['kpi', 'bar', 'map'])
    expect(readModel({}).chartTypes).toBeUndefined()
  })
})

const mapView = (measures: string[]): AnalyticsViewDefinition => ({
  chart: { type: 'map' },
  query: { measures, dimensions: ['store'], filters: [], period: 'last-30-days' },
})

describe('the author chooses which measure is the size and which the colour', () => {
  it('the first measure is the size, the second the colour', () => {
    expect(mapRoles(mapView(['till_sales', 'return_rate']))).toEqual({ size: 'till_sales', colour: 'return_rate' })
    expect(mapRoles(mapView(['till_sales']))).toEqual({ size: 'till_sales', colour: null })
  })

  it('swapping the two measures swaps size and colour in the saved definition, and nothing else', () => {
    const swapped = swapMapMeasures(mapView(['till_sales', 'return_rate']))
    expect(swapped.query.measures).toEqual(['return_rate', 'till_sales'])
    expect(mapRoles(swapped)).toEqual({ size: 'return_rate', colour: 'till_sales' })
    expect(swapped.query.dimensions).toEqual(['store'])
    expect(swapped.query.period).toBe('last-30-days')
    expect(swapped.chart).toEqual({ type: 'map' })
    // Saved and read back, the order holds.
    expect(readDefinition(JSON.parse(JSON.stringify(swapped))).query.measures).toEqual(['return_rate', 'till_sales'])
  })

  it('one measure has nothing to swap', () => {
    const one = mapView(['till_sales'])
    expect(swapMapMeasures(one)).toEqual(one)
  })
})

/** A map answer as the door returns it (3638): the store, the measure(s), then four `place` columns. */
const MAP_ANSWER = readResult({
  columns: [
    { key: 'store', role: 'dimension' },
    { key: 'till_sales', role: 'measure', shape: 'additive', unit: 'SAR' },
    { key: 'latitude', role: 'place' },
    { key: 'longitude', role: 'place' },
    { key: 'store_name', role: 'place' },
    { key: 'city', role: 'place' },
  ],
  rows: [
    { store: 'S001', till_sales: 1200, latitude: 24.6943, longitude: 46.6853, store_name: 'Olaya', city: 'Riyadh' },
    { store: 'S002', till_sales: 800, latitude: null, longitude: null, store_name: 'Nowhere', city: 'Riyadh' },
    { store: 'S003', till_sales: 450, latitude: 26.2235, longitude: 50.5876, store_name: 'Seef', city: 'Manama' },
    { store: 'S004', till_sales: 300, latitude: 21.5, longitude: null, store_name: 'Half', city: 'Jeddah' },
  ],
  total: 4,
  truncated: false,
  dataAsOf: '2026-11-17T03:00:00',
})

describe('a view of type map hands the map panel its points (M22)', () => {
  it('one point per row that has both coordinates, named by its store', () => {
    expect(mapPoints(MAP_ANSWER)).toEqual([
      { id: 'S001', lat: 24.6943, lon: 46.6853 },
      { id: 'S003', lat: 26.2235, lon: 50.5876 },
    ])
  })

  it('no rows, no points', () => {
    expect(mapPoints(readResult({ rows: [] }))).toEqual([])
  })
})

const body = (definition: AnalyticsViewDefinition) =>
  renderToStaticMarkup(
    createElement(PanelBody, { result: MAP_ANSWER, error: null, busy: false, definition, model: MAP_ON, lang: 'en', table: false, onRetry: () => {} }),
  )

describe('a board panel and a report block of type map draw the map panel', () => {
  it('a board panel whose view is a map draws the map panel', () => {
    const view = readItem({ id: 'v1', kind: 'view', definition: { chart: { type: 'map' }, query: { measures: ['till_sales'], dimensions: ['store'] } } })
    expect(body(view.definition)).toMatch(/data-map-state="drawing"/)
  })

  it('a report block of type map draws the map panel', () => {
    const report = readReport({
      id: 'r1',
      kind: 'report',
      definition: {
        sections: [
          {
            id: 's1',
            blocks: [{ id: 'p1', kind: 'panel', definition: { chart: { type: 'map' }, query: { measures: ['till_sales'], dimensions: ['store'] } } }],
          },
        ],
      },
    })
    const block = report.definition.sections[0].blocks[0]
    expect(block.kind === 'panel' && 'definition' in block ? body(block.definition) : '').toMatch(/data-map-state="drawing"/)
  })

  it('any other chart draws no map panel', () => {
    expect(body({ chart: { type: 'table' }, query: { measures: ['till_sales'], dimensions: ['store'], filters: [] } })).not.toMatch(/data-map-state/)
  })
})

/** 883: a map block on the print page, given the state the page's maps hold for it. */
const printed = (state: MapPrintState) => {
  const maps: PrintMaps = { ...createPrintMaps(), state: () => state }
  return renderToStaticMarkup(
    createElement(
      PrintMapsContext.Provider,
      { value: maps },
      createElement(PanelBody, {
        result: MAP_ANSWER,
        error: null,
        busy: false,
        definition: { chart: { type: 'map' }, query: { measures: ['till_sales'], dimensions: ['store'], filters: [] } },
        model: MAP_ON,
        lang: 'en',
        table: false,
        onRetry: () => {},
      }),
    ),
  )
}

describe('on the print page a map that fell back prints its table and the line (883, M38)', () => {
  it('a map still drawing, or drawn, is the map panel', () => {
    expect(printed('drawing')).toMatch(/data-map-state="drawing"/)
    expect(printed('drawn')).not.toMatch(/data-map-cannot-draw/)
  })

  it('a map that cannot draw, or ran out of its 20 seconds, is the table of the same rows under "The map could not be drawn"', () => {
    const html = printed('fell-back')
    expect(html).not.toMatch(/data-map-state/)
    expect(html).toContain('The map could not be drawn')
    // The table form of the same answer (its rows are AG Grid's, drawn in the browser).
    expect(html).toMatch(/data-chart="table"/)
  })

  it('says the line in both languages', () => {
    expect(en.view.mapCannotDraw).toBe('The map could not be drawn')
    expect(ar.view.mapCannotDraw).toBe('تعذّر رسم الخريطة')
  })
})

describe('a map tile on a board has a minimum size (M25)', () => {
  const MIN = minSizeOf({ kind: 'view', chart: 'map' })
  const mapPanel = { id: 'm', kind: 'view' as const, viewId: 'v1', optOut: [], layout: { x: 0, y: 0, w: 6, h: MIN.h } }
  const state: LayoutState = { panels: [mapPanel], mins: { m: MIN } }
  const at = (s: LayoutState) => s.panels[0].layout

  it('half the board wide, and tall enough for the legend and the map together (7 rows of 5rem = 560 px)', () => {
    expect(MIN).toEqual({ w: 6, h: 7 })
  })

  it('the grid does not let it shrink below that, by drag or by keys', () => {
    expect(at(layoutReducer(state, { type: 'resize', id: 'm', w: 3, h: 2 }))).toEqual({ x: 0, y: 0, w: 6, h: 7 })
    expect(at(layoutReducer(state, { type: 'grow', id: 'm', dw: -1, dh: -1 }))).toEqual({ x: 0, y: 0, w: 6, h: 7 })
    expect(at(layoutReducer(state, { type: 'resize', id: 'm', w: 12, h: 9 }))).toEqual({ x: 0, y: 0, w: 12, h: 9 })
  })

  it('a map added to a board starts at its minimum', () => {
    expect(addedLayout([], MIN)).toEqual({ x: 0, y: 0, w: 6, h: 7 })
  })
})

describe('a map emits no cross-filter and has no drill (M23)', () => {
  it('offers no breakdown to drill into', () => {
    expect(drillTargets(mapView(['till_sales']), MAP_ON, [])).toEqual([])
  })
})

describe('a view saved as a map opens in the designer as a map (M26)', () => {
  const saved = readItem({
    id: 'v9',
    kind: 'view',
    definition: { chart: { type: 'map' }, query: { measures: ['till_sales', 'return_rate'], dimensions: ['store'], period: 'last-30-days' } },
  })
  const opened = (model: AnalyticsModel) => {
    const q = saved.definition.query
    const sel = { measures: q.measures, dimensions: q.dimensions }
    return designerChoice(choiceOf(saved.definition.chart), chartOffers(sel, model), sel, model)
  }

  it('the saved type is read back as map, and the designer opens on it', () => {
    expect(saved.definition.chart.type).toBe('map')
    expect(opened(MAP_ON)).toBe('map')
  })

  it('with the server not accepting map, the designer opens on the type it would pick instead (the server is the authority)', () => {
    expect(opened(MAP_OFF)).toBe('bar-horizontal')
  })
})
