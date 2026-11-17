import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import boards from '@/locales/en/boards.json'
import boardsAr from '@/locales/ar/boards.json'
import common from '@/locales/en/common.json'
import commonAr from '@/locales/ar/common.json'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { stripIsolates } from '@/core/util/bidi'
import { mapDisplay, mapTableView, notOnMapTableView } from './map-chart'
import ViewChart from './ViewChart'
import { readResult } from './wire'

/**
 * oms-react 882 (BackOffice spec 3630 M21, M24; legend 3639): a store with no coordinates is never dropped silently —
 * the line under the map counts them from the server's `legend.notOnMap` and opens them as a list — and every map
 * can be shown as a table of the same rows.
 */

const label = (en: string, ar: string) => ({ en, ar })
const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    { key: 'till_sales', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Till sales', 'مبيعات نقاط البيع'), description: label('', ''), dimensions: ['store'] },
    { key: 'return_rate', area: 'sales', shape: 'rate', unit: 'percent', label: label('Return rate', 'نسبة المرتجعات'), description: label('', ''), dimensions: ['store'] },
  ],
  dimensions: [{ key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] }],
  chartTypes: ['kpi', 'line', 'area', 'bar', 'donut', 'table', 'heatmap', 'combo', 'map'],
}
const MAP: AnalyticsViewDefinition = {
  chart: { type: 'map', topN: 5 },
  query: { measures: ['till_sales', 'return_rate'], dimensions: ['store'], filters: [], period: 'last-30-days' },
}

/** `count` stores, store i selling 1000 + i; every `gapEvery`-th one (from the first) has no coordinates. */
function answer(count: number, unplaced: (i: number) => boolean, notOnMap: number | undefined) {
  const rows = Array.from({ length: count }, (_, i) => {
    const off = unplaced(i)
    return {
      store: `S${String(i + 1).padStart(3, '0')}`,
      till_sales: 1000 + i,
      return_rate: i / 10,
      latitude: off ? null : 24 + i / 100,
      longitude: off ? null : 46 + i / 100,
      store_name: `Store ${i + 1}`,
      city: i % 2 ? 'Jeddah' : 'Riyadh',
      hollow: false,
      colour_step: 'q1',
    }
  })
  return readResult({
    columns: [
      { key: 'store', role: 'dimension' },
      { key: 'till_sales', role: 'measure', shape: 'additive', unit: 'SAR' },
      { key: 'return_rate', role: 'measure', shape: 'rate', unit: 'percent' },
      { key: 'latitude', role: 'place' },
      { key: 'longitude', role: 'place' },
      { key: 'store_name', role: 'place' },
      { key: 'city', role: 'place' },
      { key: 'hollow', role: 'legend' },
      { key: 'colour_step', role: 'legend' },
    ],
    rows,
    total: rows.length,
    truncated: false,
    dataAsOf: '2026-11-17T03:00:00',
    ...(notOnMap === undefined ? {} : { legend: { size: null, colour: null, notOnMap } }),
  })
}

const WORDS = { storeName: 'Store name', city: 'City' }
// Rows 4, 17 and 30 (indices 3, 16, 29) of 40 have no coordinates.
const THREE_OF_40 = answer(40, (i) => [3, 16, 29].includes(i), 3)

describe('the server counts the stores not on the map (3639 legend.notOnMap)', () => {
  it('the result carries the count the server sent; absent reads as none', () => {
    expect(THREE_OF_40.notOnMap).toBe(3)
    expect(answer(2, () => false, undefined).notOnMap).toBeUndefined()
    expect(readResult({ legend: { notOnMap: 'two' } }).notOnMap).toBeUndefined()
  })
})

describe('with 3 of 40 rows lacking coordinates, the list holds those 3 with their figures (M21)', () => {
  it('the list is the three unplaced stores, figures and names as the map rows carry them', () => {
    const list = notOnMapTableView(THREE_OF_40, MAP, MODEL, 'en', WORDS)
    expect(list.rows.map((r) => r.store).sort()).toEqual(['S004', 'S017', 'S030'])
    const s17 = list.rows.find((r) => r.store === 'S017')!
    expect(s17).toMatchObject({ store_name: 'Store 17', city: 'Riyadh', till_sales: 1016, return_rate: 1.6 })
  })
})

describe('"Show as table" shows every row of the result, the placed and the unplaced (M24)', () => {
  const view = mapTableView(THREE_OF_40, MAP, MODEL, 'en', WORDS)

  it('every one of the 40 rows, sorted as a table chart sorts them: the first measure, largest first, no top N cut', () => {
    expect(view.rows).toHaveLength(40)
    expect(view.rows[0].store).toBe('S040')
    expect(view.rows[39].store).toBe('S001')
    expect(view.cut).toBe(false)
    expect(view.sort).toEqual({ key: 'till_sales', direction: 'desc' })
  })

  it('the store, its name and city, then the two measures; no coordinates and no legend columns', () => {
    expect(view.columns.map((c) => c.key)).toEqual(['store', 'store_name', 'city', 'till_sales', 'return_rate'])
    expect(view.columns.map((c) => c.label)).toEqual(['Store', 'Store name', 'City', 'Till sales', 'Return rate'])
    expect(view.columns.find((c) => c.key === 'till_sales')?.unit).toBe('SAR')
  })
})

describe('what a map body shows, and which line goes under it', () => {
  it('a map with stores off it: the map, the not-on-map line, and a switch to the table', () => {
    expect(mapDisplay({ placed: 37, notOnMap: 3, cannotDraw: false, asTable: false })).toEqual({ shows: 'map', line: 'notOnMap', switchTo: 'table' })
  })

  it('with none lacking there is no line', () => {
    expect(mapDisplay({ placed: 40, notOnMap: 0, cannotDraw: false, asTable: false })).toEqual({ shows: 'map', line: null, switchTo: 'table' })
  })

  it('"Show as table" shows the table and switches back to the map', () => {
    expect(mapDisplay({ placed: 37, notOnMap: 3, cannotDraw: false, asTable: true })).toEqual({ shows: 'table', line: null, switchTo: 'map' })
  })

  it('with every row lacking, the table is in place of the map, with the line, and nothing to switch to', () => {
    expect(mapDisplay({ placed: 0, notOnMap: 40, cannotDraw: false, asTable: false })).toEqual({ shows: 'table', line: 'notOnMap', switchTo: null })
  })

  it('when the map cannot draw, the table with "The map could not be drawn"', () => {
    expect(mapDisplay({ placed: 37, notOnMap: 3, cannotDraw: true, asTable: false })).toEqual({ shows: 'table', line: 'cannotDraw', switchTo: null })
  })
})

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { boards, common }, ar: { boards: boardsAr, common: commonAr } },
  ns: ['boards', 'common'],
  defaultNS: 'boards',
  initAsync: false,
})

const draw = (result: ReturnType<typeof answer>, lang = 'en') =>
  stripIsolates(
    renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n: instance.cloneInstance({ lng: lang }) },
        createElement(ViewChart, { result, busy: false, definition: MAP, model: MODEL, lang }),
      ),
    ),
  )

const lineOf = (html: string) => /<[^>]*data-map-not-on-map[^>]*>([\s\S]*?)<\/button>/.exec(html)?.[1].replace(/<[^>]+>/g, '')

describe('a map view draws the line and the switch (M21, M24)', () => {
  it('3 of 40 off the map: the map, the line saying 3, and "Show as table"', () => {
    const html = draw(THREE_OF_40)
    expect(html).toMatch(/data-map-state="drawing"/)
    expect(lineOf(html)).toBe('3 stores are not on the map')
    expect(html).toMatch(/data-map-switch="table"[^>]*>[\s\S]*?Show as table/)
  })

  it('the count is the server\'s: the panel does not count rows for the line', () => {
    expect(lineOf(draw(answer(5, (i) => i === 0, 2)))).toBe('2 stores are not on the map')
  })

  it('none lacking: no line', () => {
    expect(draw(answer(10, () => false, 0))).not.toMatch(/data-map-not-on-map/)
  })

  it('every row lacking: the table in place of the map, with the line, and no switch', () => {
    const html = draw(answer(4, () => true, 4))
    expect(html).not.toMatch(/data-map-state/)
    expect(html).toMatch(/data-chart="table"/)
    expect(lineOf(html)).toBe('4 stores are not on the map')
    expect(html).not.toMatch(/data-map-switch/)
  })

  it('one store reads in the singular', () => {
    expect(lineOf(draw(answer(5, (i) => i === 0, 1)))).toBe('1 store is not on the map')
  })

  it('the line reads in Arabic with Latin digits', () => {
    const line = lineOf(draw(THREE_OF_40, 'ar'))!
    expect(line).toMatch(/[؀-ۿ]/)
    expect(line).toContain('3')
    expect(line).not.toMatch(/[٠-٩]/)
    expect(draw(THREE_OF_40, 'ar')).toMatch(/data-map-switch="table"[^>]*>[\s\S]*?[؀-ۿ]/)
  })
})

describe('the words of both lines, in both languages', () => {
  it('"The map could not be drawn" in English, and in Arabic', () => {
    expect(boards.view.mapCannotDraw).toBe('The map could not be drawn')
    expect(boardsAr.view.mapCannotDraw).toMatch(/[؀-ۿ]/)
  })

  it('the not-on-map line in both languages, counting with a Latin-digit number', () => {
    const t = (lng: string) => instance.getFixedT(lng, 'boards')
    expect(t('en')('view.mapNotOnMap', { count: 12, n: '12' })).toBe('12 stores are not on the map')
    const ar = t('ar')('view.mapNotOnMap', { count: 12, n: '12' })
    expect(ar).toMatch(/[؀-ۿ]/)
    expect(ar).toContain('12')
    expect(ar).not.toMatch(/[٠-٩]/)
  })
})
