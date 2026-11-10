import { describe, expect, it } from 'vitest'
import type { AnalyticsModel } from '@/core/models/analytics'
import type { AnalyticsViewDefinition } from '@/core/models/analytics'
import { addCalculation, calculationKinds, labelOverride, measuresFor, ofFor, settleCalculations, sortKeys, updateCalculation } from './calculations-edit'

const label = (en: string, ar: string) => ({ en, ar })
const DIMS = ['region', 'city', 'day']
const m = (key: string, shape: 'additive' | 'rate' | 'percentile', unit: 'SAR' | 'count' | 'minutes' | 'share', en: string) => ({
  key,
  area: 'delivery',
  shape,
  unit,
  label: label(en, `ع ${en}`),
  description: label('', ''),
  dimensions: DIMS,
})
const MODEL: AnalyticsModel = {
  areas: [{ key: 'delivery', available: true }],
  measures: [
    m('delivery_value', 'additive', 'SAR', 'Delivery value'),
    m('total_value', 'additive', 'SAR', 'Total value'),
    m('orders', 'additive', 'count', 'Orders'),
    m('avg_minutes', 'rate', 'minutes', 'Average minutes'),
  ],
  dimensions: [
    { key: 'region', kind: 'category', label: label('Region', 'المنطقة'), values: [] },
    { key: 'city', kind: 'category', label: label('City', 'المدينة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
}
const ALL = ['delivery_value', 'total_value', 'orders', 'avg_minutes']

describe('calculations: what the builder offers (spec 3519 decisions 7–10)', () => {
  it('limits share and running share to additive measures, and change takes any measure', () => {
    expect(measuresFor('shareOfTotal', ALL, MODEL)).toEqual(['delivery_value', 'total_value', 'orders'])
    expect(measuresFor('cumulativeShare', ALL, MODEL)).toEqual(['delivery_value', 'total_value', 'orders'])
    expect(measuresFor('ratio', ALL, MODEL)).toEqual(['delivery_value', 'total_value'])
    expect(measuresFor('change', ALL, MODEL)).toEqual(ALL)
  })

  it("offers a ratio's `of` only among the other additive measures in the same unit", () => {
    expect(ofFor('delivery_value', ALL, MODEL)).toEqual(['total_value'])
    expect(ofFor('orders', ALL, MODEL)).toEqual([])
  })

  it('keeps change disabled until compare with the previous period is on', () => {
    const off = calculationKinds({ measures: ALL, dimensions: ['region'], series: 0, compare: false, calculations: [] }, MODEL)
    expect(off.find((k) => k.kind === 'change')).toEqual({ kind: 'change', offered: false, reason: 'needsCompare' })
    const on = calculationKinds({ measures: ALL, dimensions: ['region'], series: 0, compare: true, calculations: [] }, MODEL)
    expect(on.find((k) => k.kind === 'change')).toEqual({ kind: 'change', offered: true })
  })

  it('offers no ratio without a same-unit additive pair, and nothing past four', () => {
    const one = calculationKinds({ measures: ['orders'], dimensions: ['region'], series: 0, compare: false, calculations: [] }, MODEL)
    expect(one.find((k) => k.kind === 'ratio')).toEqual({ kind: 'ratio', offered: false, reason: 'noPair' })
    const rateOnly = calculationKinds({ measures: ['avg_minutes'], dimensions: ['region'], series: 0, compare: false, calculations: [] }, MODEL)
    expect(rateOnly.find((k) => k.kind === 'shareOfTotal')).toEqual({ kind: 'shareOfTotal', offered: false, reason: 'noAdditive' })
    const four = Array.from({ length: 4 }, (_, i) => ({ key: `s${i}`, kind: 'shareOfTotal' as const, measure: 'orders' }))
    const full = calculationKinds({ measures: ALL, dimensions: ['region'], series: 0, compare: true, calculations: four }, MODEL)
    expect(full.every((k) => !k.offered && k.reason === 'full')).toBe(true)
  })
})

const def = (over: Partial<AnalyticsViewDefinition['query']> = {}, chart: AnalyticsViewDefinition['chart'] = { type: 'table' }): AnalyticsViewDefinition => ({
  chart,
  query: { measures: ['delivery_value', 'total_value'], dimensions: ['region'], filters: [], period: 'last-30-days', ...over },
})

describe('calculations: the running share and the order (decisions 7, 10)', () => {
  it('sets the order to its measure descending', () => {
    const next = addCalculation(def({}, { type: 'table', sort: { key: 'total_value', direction: 'asc' } }), { kind: 'cumulativeShare', measure: 'delivery_value', until: 80 }, MODEL)
    expect(next.chart.sort).toEqual({ key: 'delivery_value', direction: 'desc' })
  })

  it('is hidden with a date breakdown or named series', () => {
    const sel = { measures: ['delivery_value'], series: 0, compare: false, calculations: [] }
    expect(calculationKinds({ ...sel, dimensions: ['day'] }, MODEL).find((k) => k.kind === 'cumulativeShare')).toEqual({
      kind: 'cumulativeShare',
      offered: false,
      reason: 'runningDate',
    })
    expect(calculationKinds({ ...sel, dimensions: ['region'], series: 2 }, MODEL).find((k) => k.kind === 'cumulativeShare')).toEqual({
      kind: 'cumulativeShare',
      offered: false,
      reason: 'runningSeries',
    })
  })

  it('offers sorting by a calculated column, but not alongside a running share', () => {
    const share = addCalculation(def(), { kind: 'shareOfTotal', measure: 'delivery_value' }, MODEL)
    expect(sortKeys(share)).toEqual(['delivery_value', 'total_value', share.query.calculations![0].key])
    const running = addCalculation(share, { kind: 'cumulativeShare', measure: 'total_value' }, MODEL)
    expect(sortKeys(running)).toEqual(['total_value'])
  })

  it('drops a sort by a calculated column when a running share is added', () => {
    const share = addCalculation(def(), { kind: 'shareOfTotal', measure: 'delivery_value' }, MODEL)
    const sorted = { ...share, chart: { ...share.chart, sort: { key: share.query.calculations![0].key, direction: 'desc' as const } } }
    expect(addCalculation(sorted, { kind: 'cumulativeShare', measure: 'delivery_value' }, MODEL).chart.sort).toEqual({ key: 'delivery_value', direction: 'desc' })
  })
})

describe('calculations: the saved definition carries them as the wire expects (decision 1)', () => {
  it('keys each by kind and measure, and keeps only the fields its kind takes', () => {
    let d = def()
    d = addCalculation(d, { kind: 'shareOfTotal', measure: 'delivery_value', of: 'total_value', until: 50 }, MODEL)
    d = addCalculation(d, { kind: 'ratio', measure: 'delivery_value', of: 'total_value' }, MODEL)
    d = addCalculation(d, { kind: 'cumulativeShare', measure: 'delivery_value', until: 80, label: { en: 'Top 80 %', ar: 'أعلى 80 %' } }, MODEL)
    d = addCalculation({ ...d, query: { ...d.query, compareToPrevious: true } }, { kind: 'change', measure: 'total_value' }, MODEL)
    expect(d.query.calculations).toEqual([
      { key: 'share_delivery_value', kind: 'shareOfTotal', measure: 'delivery_value' },
      { key: 'ratio_delivery_value_total_value', kind: 'ratio', measure: 'delivery_value', of: 'total_value' },
      { key: 'running_delivery_value', kind: 'cumulativeShare', measure: 'delivery_value', until: 80, label: { en: 'Top 80 %', ar: 'أعلى 80 %' } },
      { key: 'change_total_value', kind: 'change', measure: 'total_value' },
    ])
    // The wire's own shape: JSON as the save sends it.
    expect(JSON.parse(JSON.stringify(d.query.calculations))[1]).toEqual({ key: 'ratio_delivery_value_total_value', kind: 'ratio', measure: 'delivery_value', of: 'total_value' })
  })

  it('never reuses a key, a measure key or a dimension key, and keeps each key within 40 characters', () => {
    const twice = addCalculation(addCalculation(def(), { kind: 'shareOfTotal', measure: 'delivery_value' }, MODEL), { kind: 'shareOfTotal', measure: 'delivery_value' }, MODEL)
    expect(twice.query.calculations!.map((c) => c.key)).toEqual(['share_delivery_value', 'share_delivery_value_2'])
    const long = 'a_very_long_measure_key_that_goes_on_and_on'
    const model = { ...MODEL, measures: [...MODEL.measures, { ...MODEL.measures[0], key: long }] }
    const k = addCalculation(def({ measures: [long] }), { kind: 'shareOfTotal', measure: long }, model).query.calculations![0].key
    expect(k).toMatch(/^[a-z][A-Za-z0-9_]{0,39}$/)
  })

  it('clamps until to 1–100', () => {
    expect(addCalculation(def(), { kind: 'cumulativeShare', measure: 'delivery_value', until: 140 }, MODEL).query.calculations![0].until).toBe(100)
    expect(addCalculation(def(), { kind: 'cumulativeShare', measure: 'delivery_value', until: 0 }, MODEL).query.calculations![0].until).toBe(1)
  })

  it('leaves a definition without calculations exactly as it was', () => {
    const d = def()
    expect(settleCalculations(d, MODEL).definition).toBe(d)
  })
})

describe('calculations: the label override is both languages or neither (decision 1)', () => {
  it('takes both, takes neither as the derived default, and refuses one alone', () => {
    expect(labelOverride({ en: ' Delivery % ', ar: 'نسبة التوصيل' })).toEqual({ ok: true, label: { en: 'Delivery %', ar: 'نسبة التوصيل' } })
    expect(labelOverride({ en: '', ar: '  ' })).toEqual({ ok: true, label: undefined })
    expect(labelOverride({ en: 'Delivery %', ar: '' })).toEqual({ ok: false, reason: 'oneLanguage' })
    expect(labelOverride({ en: '', ar: 'نسبة' })).toEqual({ ok: false, reason: 'oneLanguage' })
  })

  it('removes a label set back to neither', () => {
    const d = addCalculation(def(), { kind: 'shareOfTotal', measure: 'delivery_value', label: { en: 'S', ar: 'ح' } }, MODEL)
    const next = updateCalculation(d, 'share_delivery_value', { kind: 'shareOfTotal', measure: 'delivery_value' }, MODEL)
    expect(next.query.calculations).toEqual([{ key: 'share_delivery_value', kind: 'shareOfTotal', measure: 'delivery_value' }])
  })
})

describe('calculations: a change under them drops them with a note', () => {
  it('drops the calculations that used a removed measure, and says which', () => {
    let d = addCalculation(def(), { kind: 'shareOfTotal', measure: 'delivery_value' }, MODEL)
    d = addCalculation(d, { kind: 'ratio', measure: 'delivery_value', of: 'total_value' }, MODEL)
    d = addCalculation(d, { kind: 'shareOfTotal', measure: 'total_value' }, MODEL)
    const { definition, dropped } = settleCalculations({ ...d, query: { ...d.query, measures: ['delivery_value'] } }, MODEL)
    expect(definition.query.calculations).toEqual([{ key: 'share_delivery_value', kind: 'shareOfTotal', measure: 'delivery_value' }])
    expect(dropped.map((x) => [x.calculation.key, x.reason])).toEqual([
      ['ratio_delivery_value_total_value', 'measure'],
      ['share_total_value', 'measure'],
    ])
  })

  it('drops a change when compare goes off, and a running share when a date breakdown arrives', () => {
    let d = addCalculation(def({ compareToPrevious: true }), { kind: 'change', measure: 'total_value' }, MODEL)
    d = addCalculation(d, { kind: 'cumulativeShare', measure: 'delivery_value' }, MODEL)
    const { compareToPrevious: _c, ...off } = d.query
    void _c
    expect(settleCalculations({ ...d, query: off }, MODEL).dropped.map((x) => x.reason)).toEqual(['compare'])
    const dated = settleCalculations({ ...d, query: { ...d.query, dimensions: ['day'] } }, MODEL)
    expect(dated.dropped.map((x) => x.reason)).toEqual(['runningDate'])
  })

  it('drops the last calculation and leaves no `calculations` field, and no sort on its key', () => {
    const d = addCalculation(def(), { kind: 'shareOfTotal', measure: 'total_value' }, MODEL)
    const sorted = { ...d, chart: { ...d.chart, sort: { key: 'share_total_value', direction: 'desc' as const } } }
    const { definition } = settleCalculations({ ...sorted, query: { ...sorted.query, measures: ['delivery_value'] } }, MODEL)
    expect('calculations' in definition.query).toBe(false)
    expect(definition.chart.sort).toBeNull()
  })
})
