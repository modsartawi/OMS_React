import { describe, expect, it } from 'vitest'
// The OMS words, initialised as the OMS entry does (`app/main.tsx`): `@/core/api` no longer imports the init itself.
import '@/core/i18n'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AnalyticsModel } from '@/core/models/analytics'
import { pointRadius, POINT_RADIUS } from '@/core/map/map-drawing'
import { mapDrawing, mapLegendView, MAP_SCALE_INKS, MAP_STEP_INKS } from './map-chart'
import MapLegend from './MapLegend'
import { readResult } from './wire'
import { tableColumnDefs } from '@/core/charts/table-columns'

/**
 * oms-react 881 (BackOffice spec 3630 M15-M20, M23; legend 3639): each point is sized and coloured from the server's
 * legend, a group's sum is offered only for a size that adds up, the card's figures read as the table's, and the legend
 * names both measures in the screen's language. The panel compares no value with an edge: the steps come on the rows.
 */

/** `Intl` writes a no-break space between the currency code and the figure, as the table does. */
const NBSP = String.fromCharCode(0xa0)
const label = (en: string, ar: string) => ({ en, ar })
const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    { key: 'till_sales', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Till sales', 'مبيعات نقاط البيع'), description: label('', ''), dimensions: ['store'] },
    { key: 'return_rate', area: 'sales', shape: 'rate', unit: 'share', label: label('Return rate', 'نسبة المرتجعات'), description: label('', ''), dimensions: ['store'] },
  ],
  dimensions: [{ key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] }],
}

const place = [
  { key: 'latitude', role: 'place' },
  { key: 'longitude', role: 'place' },
  { key: 'store_name', role: 'place' },
  { key: 'city', role: 'place' },
]

/** A two-figure map with a change colour, as 3639 sends it: the rows carry `hollow` and `colour_step`. */
const CHANGE_MAP = readResult({
  columns: [
    { key: 'store', role: 'dimension' },
    { key: 'till_sales', role: 'measure', shape: 'additive', unit: 'SAR' },
    { key: 'change', role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind: 'change', measure: 'till_sales' } },
    ...place,
    { key: 'hollow', role: 'legend' },
    { key: 'colour_step', role: 'legend' },
  ],
  rows: [
    { store: 'S001', till_sales: 1200.5, change: 12.5, latitude: 24.6943, longitude: 46.6853, store_name: 'Olaya', city: 'Riyadh', hollow: false, colour_step: 'better' },
    { store: 'S002', till_sales: 300.25, change: -12.5, latitude: 24.6961, longitude: 46.6871, store_name: 'Malaz', city: 'Riyadh', hollow: false, colour_step: 'worse' },
    { store: 'S003', till_sales: 750.375, change: 1, latitude: 21.543, longitude: 39.172, store_name: 'Tahlia', city: 'Jeddah', hollow: false, colour_step: 'same' },
    { store: 'S004', till_sales: 0, change: null, latitude: 26.4207, longitude: 50.0888, store_name: 'Corniche', city: 'Dammam', hollow: true, colour_step: 'none' },
    { store: 'S005', till_sales: 500, change: 3, latitude: null, longitude: null, store_name: 'Nowhere', city: '', hollow: false, colour_step: 'same' },
  ],
  legend: {
    size: { key: 'till_sales', label: label('Till sales', 'مبيعات نقاط البيع'), min: 300.25, max: 1200.5, additive: true },
    colour: {
      key: 'change',
      label: label('Change in Till sales', 'التغير في مبيعات نقاط البيع'),
      kind: 'change',
      steps: [
        { id: 'worse', from: null, to: -5, label: label('Worse: down 5 % or more', 'أسوأ: انخفاض 5 % أو أكثر') },
        { id: 'same', from: -5, to: 5, label: label('About the same: less than 5 % either way', 'تقريبًا كما هو') },
        { id: 'better', from: 5, to: null, label: label('Better: up 5 % or more', 'أفضل: ارتفاع 5 % أو أكثر') },
        { id: 'none', from: null, to: null, label: label('No earlier figure', 'لا يوجد رقم سابق') },
      ],
    },
    notOnMap: 1,
  },
})

/** A one-figure map of a rate: one colour, and a group shows its count only. */
const RATE_MAP = readResult({
  columns: [{ key: 'store', role: 'dimension' }, { key: 'return_rate', role: 'measure', shape: 'rate', unit: 'share' }, ...place, { key: 'hollow', role: 'legend' }],
  rows: [
    { store: 'S001', return_rate: 0.02, latitude: 24.6943, longitude: 46.6853, store_name: 'Olaya', city: 'Riyadh', hollow: false },
    { store: 'S002', return_rate: 0.04, latitude: 24.6961, longitude: 46.6871, store_name: 'Malaz', city: 'Riyadh', hollow: false },
  ],
  legend: { size: { key: 'return_rate', label: label('Return rate', 'نسبة المرتجعات'), min: 0.02, max: 0.04, additive: false }, colour: null, notOnMap: 0 },
})

/** A scale colour of four steps (the server merged a fifth away). */
const scaleMap = (steps: string[]) =>
  readResult({
    columns: [{ key: 'store', role: 'dimension' }, { key: 'till_sales', role: 'measure', unit: 'SAR' }, { key: 'return_rate', role: 'measure', unit: 'share' }, ...place],
    rows: steps.map((step, i) => ({ store: `S00${i}`, till_sales: 100 * (i + 1), return_rate: i / 100, latitude: 24 + i, longitude: 46, store_name: `N${i}`, city: 'C', hollow: false, colour_step: step })),
    legend: {
      size: { key: 'till_sales', label: label('Till sales', 'مبيعات'), min: 100, max: 100 * steps.length, additive: true },
      colour: {
        key: 'return_rate',
        label: label('Return rate', 'نسبة المرتجعات'),
        kind: 'scale',
        steps: ['q1', 'q2', 'q3', 'q4'].map((id) => ({ id, from: 0, to: 1, label: label(id, id) })),
      },
      notOnMap: 0,
    },
  })

const byId = (result: typeof CHANGE_MAP, lang = 'en') => new Map(mapDrawing(result, MODEL, lang).points.map((p) => [p.id, p]))

describe('the wire carries the legend and the per-row marks (3639)', () => {
  it('reads the legend of a map answer', () => {
    expect(CHANGE_MAP.legend?.size).toEqual({ key: 'till_sales', label: label('Till sales', 'مبيعات نقاط البيع'), min: 300.25, max: 1200.5, additive: true })
    expect(CHANGE_MAP.legend?.colour?.kind).toBe('change')
    expect(CHANGE_MAP.legend?.colour?.steps.map((s) => s.id)).toEqual(['worse', 'same', 'better', 'none'])
  })

  it('an answer with no legend has none', () => {
    expect(readResult({ rows: [] }).legend).toBeUndefined()
  })
})

describe("each point's size follows its value between the legend's smallest and largest (M15)", () => {
  it('the smallest value is share 0, the largest share 1, and one between in proportion', () => {
    const p = byId(CHANGE_MAP)
    expect(p.get('S002')?.size).toBe(0)
    expect(p.get('S001')?.size).toBe(1)
    // 750.375 is half-way from 300.25 to 1200.5.
    expect(p.get('S003')?.size).toBeCloseTo(0.5, 12)
  })

  it('so the drawn areas run from the smallest point to the largest', () => {
    const p = byId(CHANGE_MAP)
    expect(pointRadius(p.get('S002')!.size!)).toBe(POINT_RADIUS.min)
    expect(pointRadius(p.get('S001')!.size!)).toBe(POINT_RADIUS.max)
  })

  it('a row the server marks hollow is drawn hollow, at the smallest size', () => {
    const p = byId(CHANGE_MAP)
    expect(p.get('S004')?.hollow).toBe(true)
    expect(p.get('S004')?.size).toBe(0)
    expect(p.get('S001')?.hollow).toBe(false)
  })

  it('a row with no coordinates is not a point', () => {
    expect(byId(CHANGE_MAP).has('S005')).toBe(false)
  })
})

describe('each point takes the colour of the step on its row (M16, M18)', () => {
  it('a change: better, about the same and worse each take their own colour, and no earlier figure the neutral one', () => {
    const p = byId(CHANGE_MAP)
    expect(p.get('S001')?.ink).toBe(MAP_STEP_INKS.better)
    expect(p.get('S002')?.ink).toBe(MAP_STEP_INKS.worse)
    expect(p.get('S003')?.ink).toBe(MAP_STEP_INKS.same)
    expect(p.get('S004')?.ink).toBe(MAP_STEP_INKS.none)
  })

  it('the step is read from the row, never from the value: a row whose value says "better" but whose step says "same" is "same"', () => {
    const lying = readResult({ ...rawOf(CHANGE_MAP), rows: [{ ...CHANGE_MAP.rows[0], change: 99, colour_step: 'same' }] })
    expect(byId(lying).get('S001')?.ink).toBe(MAP_STEP_INKS.same)
  })

  it('a scale: each step of k is one shade of one colour, lightest first, spread over the five', () => {
    const p = byId(scaleMap(['q1', 'q2', 'q3', 'q4']))
    expect([...p.values()].map((x) => x.ink)).toEqual([MAP_SCALE_INKS[0], MAP_SCALE_INKS[1], MAP_SCALE_INKS[3], MAP_SCALE_INKS[4]])
  })

  it('with one measure every point has one colour', () => {
    const inks = new Set([...byId(RATE_MAP).values()].map((x) => x.ink))
    expect(inks.size).toBe(1)
  })

  it('better and worse are two different colours, and neither is the "about the same" one', () => {
    expect(new Set([MAP_STEP_INKS.better, MAP_STEP_INKS.same, MAP_STEP_INKS.worse]).size).toBe(3)
  })
})

describe('a group adds the size only when the legend says it adds up (M19, M20)', () => {
  it('an additive size: the group carries each row’s figure as sent, and sums', () => {
    const d = mapDrawing(CHANGE_MAP, MODEL, 'en')
    expect(d.grouping.sums).toBe(true)
    const p = byId(CHANGE_MAP)
    expect(p.get('S001')?.weight).toBe(1200.5)
    expect(p.get('S004')?.weight).toBe(0)
  })

  it('a rate: the group shows its count only', () => {
    expect(mapDrawing(RATE_MAP, MODEL, 'en').grouping.sums).toBe(false)
  })

  it("the group's sum is written in Latin digits, in either language", () => {
    expect(mapDrawing(CHANGE_MAP, MODEL, 'en').grouping.formatSum(1460.75)).toBe('1.5K')
    expect(mapDrawing(CHANGE_MAP, MODEL, 'ar').grouping.formatSum(1460.75)).toMatch(/^1\.5\s/)
  })
})

describe("the card shows name, city and both figures in the table's format (M23)", () => {
  it('in English', () => {
    expect(byId(CHANGE_MAP).get('S002')?.card).toEqual({
      title: 'Malaz',
      subtitle: 'Riyadh',
      figures: [
        { label: 'Till sales', value: `SAR${NBSP}300.25` },
        { label: 'Change in Till sales', value: '-12.5%' },
      ],
    })
  })

  it('each figure is exactly what the table’s cell shows for the same value and unit', () => {
    const cells = tableColumnDefs(
      [
        { key: 'till_sales', role: 'measure', label: '', unit: 'SAR' },
        { key: 'change', role: 'measure', label: '', unit: 'percent' },
      ],
      null,
      'ar',
    )
    const cell = (i: number, value: number) => (cells[i].valueFormatter as (p: { value: unknown }) => string)({ value })
    expect(byId(CHANGE_MAP, 'ar').get('S002')?.card?.figures.map((f) => f.value)).toEqual([cell(0, 300.25), cell(1, -12.5)])
  })

  it('in Arabic: the server’s Arabic labels, and the figures still in Latin digits', () => {
    const card = byId(CHANGE_MAP, 'ar').get('S001')!.card!
    expect(card.figures.map((f) => f.label)).toEqual(['مبيعات نقاط البيع', 'التغير في مبيعات نقاط البيع'])
    expect(card.figures[0].value).toContain('1,200.50')
    expect(card.figures.map((f) => f.value).join('')).not.toMatch(/[٠-٩۰-۹]/)
  })

  it('an empty figure reads empty, as the table leaves its cell', () => {
    expect(byId(CHANGE_MAP).get('S004')?.card?.figures[1]).toEqual({ label: 'Change in Till sales', value: '' })
  })

  it('a one-figure map has one figure on its card', () => {
    expect(byId(RATE_MAP).get('S001')?.card?.figures).toEqual([{ label: 'Return rate', value: '2.0%' }])
  })
})

describe('the legend names both measures in the screen language, the size scale and each step in words (M17, M18)', () => {
  it('in English', () => {
    const v = mapLegendView(CHANGE_MAP, MODEL, 'en')!
    expect(v.size).toEqual({ label: 'Till sales', min: `SAR${NBSP}300.25`, max: `SAR${NBSP}1,200.50`, hollow: true })
    expect(v.colour?.label).toBe('Change in Till sales')
    expect(v.colour?.steps).toEqual([
      { id: 'worse', words: 'Worse: down 5 % or more', ink: MAP_STEP_INKS.worse },
      { id: 'same', words: 'About the same: less than 5 % either way', ink: MAP_STEP_INKS.same },
      { id: 'better', words: 'Better: up 5 % or more', ink: MAP_STEP_INKS.better },
      { id: 'none', words: 'No earlier figure', ink: MAP_STEP_INKS.none },
    ])
  })

  it('in Arabic', () => {
    const v = mapLegendView(CHANGE_MAP, MODEL, 'ar')!
    expect(v.size.label).toBe('مبيعات نقاط البيع')
    expect(v.colour?.label).toBe('التغير في مبيعات نقاط البيع')
    expect(v.colour?.steps[2].words).toBe('أفضل: ارتفاع 5 % أو أكثر')
    expect(v.size.max).toContain('1,200.50')
  })

  it('one measure: no colour steps; no hollow row, no hollow note', () => {
    const v = mapLegendView(RATE_MAP, MODEL, 'en')!
    expect(v.colour).toBeNull()
    expect(v.size).toEqual({ label: 'Return rate', min: '2.0%', max: '4.0%', hollow: false })
  })

  it('the legend draws both labels, the scale ends and every step’s words', () => {
    const html = renderToStaticMarkup(createElement(MapLegend, { view: mapLegendView(CHANGE_MAP, MODEL, 'en')! }))
    for (const words of ['Till sales', `SAR${NBSP}300.25`, `SAR${NBSP}1,200.50`, 'Change in Till sales', 'Worse: down 5 % or more', 'Better: up 5 % or more', 'No earlier figure'])
      expect(html).toContain(words)
  })

  it('no legend on the answer, no legend drawn', () => {
    expect(mapLegendView(readResult({ rows: [] }), MODEL, 'en')).toBeNull()
  })
})

/** The raw wire of a read result, to read it again with a change. */
function rawOf(r: typeof CHANGE_MAP) {
  return { columns: r.columns, rows: r.rows, legend: r.legend }
}

describe('the legend reads only the stores drawn on the map (review W11)', () => {
  const raw = rawOf(CHANGE_MAP)

  it('a hollow store with no place on the map does not put the hollow note in the legend', () => {
    const rows = raw.rows.map((r) => (r.hollow === true ? { ...r, latitude: null, longitude: null } : r))
    expect(mapLegendView(readResult({ ...raw, rows }), MODEL, 'en')!.size.hollow).toBe(false)
  })

  it('a hollow store on the map still does', () => {
    expect(mapLegendView(CHANGE_MAP, MODEL, 'en')!.size.hollow).toBe(true)
  })

  it('every store hollow (no smallest or largest figure): the size scale is not drawn, only the hollow note', () => {
    const rows = raw.rows.map((r) => ({ ...r, hollow: true }))
    const legend = { ...raw.legend!, size: { ...raw.legend!.size, min: null, max: null } }
    const view = mapLegendView(readResult({ ...raw, rows, legend }), MODEL, 'en')!
    const html = renderToStaticMarkup(createElement(MapLegend, { view }))
    expect(html).not.toContain('data-map-legend-scale')
    expect(html).toContain('data-map-legend-hollow')
    expect(html).toContain('Till sales')
  })

  it('a legend with a smallest and a largest figure draws its scale', () => {
    const html = renderToStaticMarkup(createElement(MapLegend, { view: mapLegendView(CHANGE_MAP, MODEL, 'en')! }))
    expect(html).toContain('data-map-legend-scale')
  })
})
