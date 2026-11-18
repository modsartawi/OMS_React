import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import boards from '@/locales/en/boards.json'
import boardsAr from '@/locales/ar/boards.json'
import common from '@/locales/en/common.json'
import commonAr from '@/locales/ar/common.json'
import type { AnalyticsModel } from '@/core/models/analytics'
import { PERMISSIONS_KEY, type PermissionsAnswer } from '@/core/permissions'
import type { CopilotAnswerTable, CopilotTableColumn } from '@/core/models/copilot'
import { ANALYTICS_MODEL_KEY } from './api'
import { readFileSync } from 'node:fs'
import CopilotTableEmbed from './CopilotTableEmbed'
import { copilotTableParts } from './copilot-table'
import { mapDisplay, mapDrawing, mapLegendView } from './map-chart'
import { PrintMapsContext } from './PrintMapsContext'
import type { PrintMaps } from './print-maps'

// oms-react 884 (BackOffice spec 3630 M42, ticket 3641): a copilot answer's table that carries a map part is drawn as
// the map a board draws, above the table of the same rows. Wire shape: 3641 — `map: { legend }` on the table, then
// `place` and `legend` columns after the table's own, every cell a string.

const col = (key: string, role: CopilotTableColumn['role'], en: string, ar: string, unit: string | null = null): CopilotTableColumn => ({
  key,
  role,
  label: { en, ar },
  unit,
  shape: role === 'measure' ? 'additive' : null,
  dateBasis: null,
  calculation: null,
  variant: null,
})

const NOTES = { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null }

const mapped: CopilotAnswerTable = {
  step: 0,
  columns: [
    col('store', 'dimension', 'Store', 'المتجر'),
    col('till_sales', 'measure', 'Till sales', 'مبيعات نقاط البيع', 'SAR'),
    col('change', 'measure', 'Change in Till sales', 'التغير في مبيعات نقاط البيع', 'percent'),
    col('latitude', 'place', 'latitude', 'latitude'),
    col('longitude', 'place', 'longitude', 'longitude'),
    col('store_name', 'place', 'Store name', 'اسم المتجر'),
    col('city', 'place', 'City', 'المدينة'),
    col('hollow', 'legend', 'hollow', 'hollow'),
    col('colour_step', 'legend', 'colour_step', 'colour_step'),
  ],
  rows: [
    { values: ['S001', '1200', '7.5', '24.6943', '46.6853', 'Olaya', 'Riyadh', 'false', 'better'], isTotal: null },
    { values: ['S002', '0', '-9', '24.7136', '46.6753', 'Malaz', 'Riyadh', 'true', 'worse'], isTotal: null },
    { values: ['S003', '800', null, null, null, 'Corniche', 'Jeddah', 'false', 'none'], isTotal: null },
  ],
  total: 3,
  truncated: false,
  periodFrom: '2026-10-30',
  periodTo: '2026-11-05',
  previous: null,
  previousFrom: null,
  previousTo: null,
  dataAsOf: '2026-11-11T08:00:00',
  notes: { ...NOTES },
  query: { measures: ['till_sales'], dimensions: ['store'], filters: [], period: 'last-7-days', calculations: [{ key: 'change', kind: 'change', measure: 'till_sales' }] },
  map: {
    legend: {
      size: { key: 'till_sales', label: { en: 'Till sales', ar: 'مبيعات نقاط البيع' }, min: 800, max: 1200, additive: true },
      colour: {
        key: 'change',
        label: { en: 'Change in Till sales', ar: 'التغير في مبيعات نقاط البيع' },
        kind: 'change',
        steps: [
          { id: 'worse', from: null, to: -5, label: { en: 'Worse: down 5 % or more', ar: 'أسوأ' } },
          { id: 'same', from: -5, to: 5, label: { en: 'About the same: less than 5 % either way', ar: 'نفسه تقريبا' } },
          { id: 'better', from: 5, to: null, label: { en: 'Better: up 5 % or more', ar: 'أفضل' } },
          { id: 'none', from: null, to: null, label: { en: 'No earlier figure', ar: 'لا يوجد رقم سابق' } },
        ],
      },
      notOnMap: 1,
    },
  },
}

/** The same rows as a server before 3641 (or with `Copilot:Charts:Map` off) sends them: no map part, no place columns. */
const unmapped: CopilotAnswerTable = (() => {
  const { map: _map, ...rest } = mapped
  return { ...rest, columns: mapped.columns.slice(0, 3), rows: mapped.rows.map((r) => ({ ...r, values: r.values.slice(0, 3) })) }
})()

/** The one permissions answer (oms 914), seeded under its key as the gate's cached read would be. */
const answerOf = (...screens: string[]): PermissionsAnswer => ({
  screens,
  extras: { fileServerReady: false, notificationCenterOn: false, nphiesContractVersion: '', canManageRoles: false, canManageUsers: false },
  version: 'test',
})
const AUTHOR = answerOf('Analytics:03', 'Analytics:02')
const EMPTY_MODEL: AnalyticsModel = { areas: [], measures: [], dimensions: [] }

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { boards, common }, ar: { boards: boardsAr, common: commonAr } },
  ns: ['boards', 'common'],
  defaultNS: 'boards',
  initAsync: false,
})

/** Every map fallen back: the same `fellBack` branch the map panel's own cannot-draw takes (static markup runs no effect). */
const FELL_BACK = {
  join: () => () => {},
  subscribe: () => () => {},
  state: () => 'fell-back',
  drawn: () => {},
  cannotDraw: () => {},
  settled: () => true,
} as unknown as PrintMaps

function draw(table: CopilotAnswerTable, { lang = 'en', fellBack = false }: { lang?: string; fellBack?: boolean } = {}): string {
  const client = new QueryClient()
  client.setQueryData(PERMISSIONS_KEY, AUTHOR)
  client.setQueryData(ANALYTICS_MODEL_KEY, EMPTY_MODEL)
  const embed = createElement(MemoryRouter, null, createElement(CopilotTableEmbed, { table, index: 0 }))
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        I18nextProvider,
        { i18n: instance.cloneInstance({ lng: lang }) },
        fellBack ? createElement(PrintMapsContext.Provider, { value: FELL_BACK }, embed) : embed,
      ),
    ),
  )
}

const MAP = 'data-map-body="map"'
const TABLE = 'data-chart="table"'

describe('the copilot panel draws a map above its table (oms-react 884)', () => {
  it('anAnswerWithAMapPart_drawsTheMapPanelAboveItsTable_withItsLegendAndNotOnMapLine', () => {
    for (const lang of ['en', 'ar']) {
      const html = draw(mapped, { lang })
      expect(html).toContain(MAP)
      expect(html).toContain('data-map-state="drawing"')
      expect(html).toContain('data-map-legend')
      expect(html).toContain('data-map-not-on-map="1"')
      expect(html).toContain('data-map-switch="table"')
      expect(html.indexOf(MAP)).toBeLessThan(html.lastIndexOf(TABLE))
      // The map fits the panel's width, and the reader can open it larger.
      expect(html).toContain('data-copilot-map-larger')
    }
    expect(draw(mapped)).toContain('Better: up 5 % or more')
    expect(draw(mapped, { lang: 'ar' })).toContain('أفضل')
  })

  it('theMapsPoints_areTheResultsPlacedRows_sizedAndColouredFromTheLegend', () => {
    const parts = copilotTableParts(mapped, EMPTY_MODEL)
    expect(parts.map?.chart.type).toBe('map')
    const { points, grouping } = mapDrawing(parts.result, parts.model, 'en')
    expect(points.map((p) => [p.id, p.lat, p.lon, p.hollow, p.ink])).toEqual([
      ['S001', 24.6943, 46.6853, false, '--map-better'],
      ['S002', 24.7136, 46.6753, true, '--map-worse'],
    ])
    expect(points[0].size).toBe(1)
    expect(points[0].card?.title).toBe('Olaya')
    expect(points[0].card?.subtitle).toBe('Riyadh')
    expect(grouping.sums).toBe(true)
    expect(parts.result.notOnMap).toBe(1)
    expect(mapLegendView(parts.result, parts.model, 'ar')?.colour?.steps.map((s) => s.words)).toEqual(['أسوأ', 'نفسه تقريبا', 'أفضل', 'لا يوجد رقم سابق'])
  })

  it('theTableUnderTheMap_holdsTheSameRows_withoutTheMapsOwnColumns', () => {
    const label = (html: string) => /aria-label="([^"]*), table"/.exec(html.slice(html.indexOf('data-copilot-table=')))?.[1]
    expect(label(draw(mapped))).toBe(label(draw(unmapped)))
    expect(label(draw(mapped))).toBeTruthy()
  })

  it('anAnswerWithoutAMapPart_isDrawnAsToday_withNoMap', () => {
    const html = draw(unmapped)
    expect(html).not.toContain('data-map-')
    expect(html).not.toContain('data-copilot-map')
    expect(copilotTableParts(unmapped, EMPTY_MODEL).map).toBeUndefined()
  })

  it('whenTheMapCannotDraw_theTableAloneIsShown_withTheLine', () => {
    for (const lang of ['en', 'ar']) {
      const html = draw(mapped, { lang, fellBack: true })
      expect(html).not.toContain('data-map-state')
      expect(html).not.toContain('data-map-table')
      expect(html).toContain('data-map-cannot-draw')
      expect(html).toContain(TABLE)
    }
    expect(draw(mapped, { fellBack: true })).toContain('The map could not be drawn')
  })

  it('underAnAnswer_aMapWithNoPlacedRowOrNoDrawing_leavesTheTableToTheAnswer', () => {
    expect(mapDisplay({ placed: 2, notOnMap: 0, cannotDraw: true, asTable: false, tableBelow: true })).toEqual({ shows: 'none', line: 'cannotDraw', switchTo: null })
    expect(mapDisplay({ placed: 0, notOnMap: 3, cannotDraw: false, asTable: false, tableBelow: true })).toEqual({ shows: 'none', line: 'notOnMap', switchTo: null })
    // "Show as table" stays the board's: the map's own table, with each store's name and city.
    expect(mapDisplay({ placed: 2, notOnMap: 0, cannotDraw: false, asTable: true, tableBelow: true })).toEqual({ shows: 'table', line: null, switchTo: 'map' })
  })
})

describe('the larger map can be closed from its title bar (884 shots)', () => {
  it('theLargerMapDialog_isGivenACloseLabel_inEnglishAndArabic', () => {
    // The dialog is opened by state, so its markup is not in a static render: read the call instead.
    const source = readFileSync(new URL('./CopilotTableEmbed.tsx', import.meta.url), 'utf8')
    expect(source).toMatch(/<Modal [^\n]*closeLabel=\{t\('copilotTable\.mapLargerClose'\)\}/)
    expect(boards.copilotTable.mapLargerClose).toBe('Close the larger map')
    expect(boardsAr.copilotTable.mapLargerClose).toBe('إغلاق الخريطة الأكبر')
  })
})
