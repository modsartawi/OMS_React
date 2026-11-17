import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { addCalculation, droppedBy, settleCalculations } from './calculations-edit'
import { comparesToPrevious, withCompare, withLastYear } from './editor'
import { ChartFields } from './EditorFields'
import { comparing, comparingLastYear, withChoice, withComparing, withComparingLastYear } from './panel-edit'
import { chartOffers, type ChartChoice } from './shape-rules'

/**
 * Live walk of BackOffice spec 3630 (oms-react 880/881): a map coloured by a change (M16: better, about the same,
 * worse at 5 %) must be buildable in the designer. The door's shape (`AnalyticsMapChart.Fits`) counts a calculation as
 * one measure column and has no rule on a comparison — a period comparison is not a date dimension — so a map of one
 * measure and one change, compared with the previous period or with the same weeks last year, is accepted.
 */

const label = (en: string, ar: string) => ({ en, ar })
const ALL = ['store', 'city', 'day']
const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [{ key: 'till_sales', area: 'sales', shape: 'additive', unit: 'money', label: label('Till sales', 'مبيعات نقاط البيع'), description: label('', ''), dimensions: ALL }],
  dimensions: [
    { key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] },
    { key: 'city', kind: 'category', label: label('City', 'المدينة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
  chartTypes: ['kpi', 'line', 'area', 'bar', 'donut', 'table', 'heatmap', 'combo', 'map'],
} as unknown as AnalyticsModel

const byStore = (type: 'table' | 'map'): AnalyticsViewDefinition => ({
  chart: { type },
  query: { measures: ['till_sales'], dimensions: ['store'], filters: [], period: 'last-7-days' },
})

/** What the designer page saves for its state: the chosen type's comparisons, then the calculations settled. */
const designerSaves = (def: AnalyticsViewDefinition, choice: ChartChoice, compare: boolean, lastYear: boolean) =>
  settleCalculations({ ...def, query: withLastYear(withCompare(def.query, choice, compare), choice, lastYear) }, MODEL)

describe('a map offers the comparisons the door accepts', () => {
  it('compare with the previous period and with the same weeks last year are offered on a map', () => {
    expect(comparesToPrevious('map')).toBe(true)
    expect(withCompare(byStore('map').query, 'map', true).compareToPrevious).toBe(true)
    expect(withLastYear(byStore('map').query, 'map', true).compareToLastYear).toBe(true)
  })

  it('Map is still offered with a comparison on and a change beside the measure', () => {
    const offers = chartOffers({ measures: ['till_sales'], dimensions: ['store'], calculations: 1 }, MODEL)
    expect(offers.find((o) => o.choice === 'map')?.offered).toBe(true)
  })

  it('the designer shows both comparison switches on a map, with a hint that a change colours the stores', () => {
    const instance = i18next.createInstance()
    instance.init({ lng: 'en', resources: { en: { boards: en }, ar: { boards: ar } }, ns: ['boards'], defaultNS: 'boards', initAsync: false })
    const html = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n: instance },
        createElement(ChartFields, {
          offers: chartOffers({ measures: ['till_sales'], dimensions: ['store'] }, MODEL),
          chosen: 'map',
          onChoose: () => {},
          invalid: false,
          measures: ['till_sales'],
          measureName: (k: string) => k,
          settings: { type: 'map' },
          onSettings: () => {},
          compare: true,
          onCompare: () => {},
          lastYear: false,
          onLastYear: () => {},
        }),
      ),
    )
    expect(html).toContain('data-editor-compare="on"')
    expect(html).toContain('data-editor-compare-last-year="off"')
    expect(html).toContain(en.editor.compareHintMap)
    expect(html).not.toContain(en.editor.compareHintLine)
  })

  it('the map hint is said in both languages', () => {
    expect(en.editor.compareHintMap).toBeTruthy()
    expect(ar.editor.compareHintMap).toBeTruthy()
  })
})

describe('a change survives the map, in either order', () => {
  it('a table compared with a change, switched to Map: the change and the comparison stay', () => {
    const table = addCalculation(withComparing(byStore('table'), true, MODEL), { kind: 'change', measure: 'till_sales' }, MODEL)
    expect(table.query.calculations).toHaveLength(1)
    const map = withChoice(table, 'map', MODEL)
    expect(map.chart.type).toBe('map')
    expect(map.query.compareToPrevious).toBe(true)
    expect(map.query.calculations?.map((c) => c.kind)).toEqual(['change'])
    expect(droppedBy(table, map, MODEL)).toEqual([])
    expect(comparing(map)).toBe(true)
  })

  it('the designer page with compare on and a change: choosing Map drops nothing (the walk’s defect)', () => {
    const withChange: AnalyticsViewDefinition = {
      ...byStore('map'),
      query: { ...byStore('map').query, calculations: [{ key: 'change', kind: 'change', measure: 'till_sales' }] },
    }
    const saved = designerSaves(withChange, 'map', true, false)
    expect(saved.dropped).toEqual([])
    expect(saved.definition.query.compareToPrevious).toBe(true)
    expect(saved.definition.query.calculations?.map((c) => c.key)).toEqual(['change'])
  })

  it('Map first, then compare and a change: the change is kept', () => {
    const map = withChoice(byStore('table'), 'map', MODEL)
    expect(map.chart.type).toBe('map')
    const compared = withComparing(map, true, MODEL)
    expect(compared.query.compareToPrevious).toBe(true)
    const coloured = addCalculation(compared, { kind: 'change', measure: 'till_sales' }, MODEL)
    expect(coloured.query.calculations?.map((c) => c.kind)).toEqual(['change'])
    // A change picked with the comparison off turns it on, on a map as on a table (876).
    const picked = addCalculation(map, { kind: 'change', measure: 'till_sales' }, MODEL)
    expect(picked.query.compareToPrevious).toBe(true)
    expect(picked.query.calculations).toHaveLength(1)
  })

  it('a change from last year on a map keeps last year on', () => {
    const map = withComparingLastYear(withChoice(byStore('table'), 'map', MODEL), true, MODEL)
    expect(comparingLastYear(map)).toBe(true)
    const coloured = addCalculation(map, { kind: 'change', measure: 'till_sales', from: 'lastYear' }, MODEL)
    expect(coloured.query.compareToLastYear).toBe(true)
    expect(coloured.query.calculations?.map((c) => c.from)).toEqual(['lastYear'])
    expect(designerSaves(coloured, 'map', false, true).dropped).toEqual([])
  })
})
