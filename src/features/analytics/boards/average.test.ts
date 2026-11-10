import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { calculatedModel, calculationLabel, type CalculationWords } from './calculations'
import { addCalculation, calculationKinds, measuresFor, ofFor, settleCalculations, takesWithin } from './calculations-edit'
import { viewMeasureOf } from './view-model'

// Ticket 864 (BackOffice spec 3543 part C, decisions 9, 10, 16; server 3550): `average` = measure ÷ of, any units.
const fill = (template: string, values: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? '')
const wordsOf = (bundle: typeof en): CalculationWords => ({
  shareOfTotal: (v) => fill(bundle.calculation.label.shareOfTotal, v),
  ratio: (v) => fill(bundle.calculation.label.ratio, v),
  cumulativeShare: (v) => fill(bundle.calculation.label.cumulativeShare, v),
  change: (v) => fill(bundle.calculation.label.change, v),
  average: (v) => fill(bundle.calculation.label.average, v),
  shareOfTotalWithin: (v) => fill(bundle.calculation.label.shareOfTotalWithin, v),
  cumulativeShareWithin: (v) => fill(bundle.calculation.label.cumulativeShareWithin, v),
})

const m = (key: string, area: string, unit: string, shape = 'additive', en = key, ar = key) => ({ key, area, shape, unit, label: { en, ar }, description: { en: '', ar: '' }, dimensions: ['region'] })
const model = {
  areas: [{ key: 'till', available: true }, { key: 'delivery', available: true }],
  measures: [
    m('net_till_value_sar', 'till', 'SAR', 'additive', 'Net till value', 'صافي قيمة الصندوق'),
    m('till_sales', 'till', 'count', 'additive', 'Till sales', 'مبيعات الصندوق'),
    m('deliveries', 'delivery', 'count', 'additive', 'Deliveries', 'التوصيلات'),
    m('return_rate', 'till', 'share', 'rate'),
  ],
  dimensions: [{ key: 'region', kind: 'category', label: { en: 'Region', ar: 'المنطقة' }, values: [] }],
} as unknown as AnalyticsModel

const def = (measures: string[], extra: Partial<AnalyticsViewDefinition['query']> = {}): AnalyticsViewDefinition =>
  ({ chart: { type: 'table' }, query: { measures, dimensions: ['region'], filters: [], ...extra } }) as AnalyticsViewDefinition
const sel = (measures: string[]) => ({ measures, dimensions: ['region'], series: 0, compare: false, calculations: [] })

describe('average in the kind picker (decision 9: both additive, units may differ)', () => {
  it('is offered over two additive measures of different units, where a ratio is not', () => {
    const offers = calculationKinds(sel(['net_till_value_sar', 'till_sales']), model)
    expect(offers.find((o) => o.kind === 'average')).toEqual({ kind: 'average', offered: true })
    expect(offers.find((o) => o.kind === 'ratio')).toEqual({ kind: 'ratio', offered: false, reason: 'noPair' })
  })
  it('its `of` is any other selected additive measure, whatever its unit or area; never a rate', () => {
    expect(ofFor('net_till_value_sar', ['net_till_value_sar', 'till_sales', 'deliveries', 'return_rate'], model, 'average')).toEqual(['till_sales', 'deliveries'])
    expect(ofFor('net_till_value_sar', ['net_till_value_sar', 'till_sales', 'deliveries'], model)).toEqual([])
    expect(measuresFor('average', ['return_rate', 'till_sales'], model)).toEqual([])
  })
  it('is not offered with one additive measure, and the reason names two measures, not one unit', () => {
    expect(calculationKinds(sel(['till_sales', 'return_rate']), model).find((o) => o.kind === 'average')).toEqual({ kind: 'average', offered: false, reason: 'noTwo' })
  })
  it('never takes within', () => {
    expect(takesWithin('average')).toBe(false)
  })
  it('is saved with its `of`, keyed avg_<measure>_<of>, and kept when settled', () => {
    const d = addCalculation(def(['deliveries', 'till_sales']), { kind: 'average', measure: 'deliveries', of: 'till_sales', within: ['region'] }, model)
    expect(d.query.calculations).toEqual([{ key: 'avg_deliveries_till_sales', kind: 'average', measure: 'deliveries', of: 'till_sales' }])
    expect(settleCalculations(d, model).dropped).toEqual([])
  })
  it('is dropped (reason measure) when its `of` leaves the query', () => {
    const d = addCalculation(def(['deliveries', 'till_sales']), { kind: 'average', measure: 'deliveries', of: 'till_sales' }, model)
    const after = settleCalculations({ ...d, query: { ...d.query, measures: ['deliveries'] } }, model)
    expect(after.dropped.map((x) => x.reason)).toEqual(['measure'])
  })
})

describe('an average column (decision 9: "{measure} per {of}", in the measure\'s own unit)', () => {
  const calc = { kind: 'average' as const, measure: 'net_till_value_sar', of: 'till_sales' }
  it('reads "{measure} per {of}" in EN and AR', () => {
    expect(calculationLabel(calc, null, model, 'en', wordsOf(en))).toBe('Net till value per Till sales')
    expect(calculationLabel(calc, null, model, 'ar', wordsOf(ar))).toBe('صافي قيمة الصندوق بالقسمة على مبيعات الصندوق') // not لكل: كل before a definite noun reads "all"
  })
  it('is shaped and formatted by its column\'s unit (SAR), never as a percent', () => {
    const result = {
      columns: [
        { key: 'region', role: 'dimension' },
        { key: 'basket', role: 'measure', shape: 'rate', unit: 'SAR', calculation: calc },
        { key: 'share', role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind: 'shareOfTotal', measure: 'till_sales' } },
      ],
      rows: [],
    } as unknown as AnalyticsQueryResult
    const d = def(['net_till_value_sar', 'till_sales'], { calculations: [{ key: 'basket', ...calc }, { key: 'share', kind: 'shareOfTotal', measure: 'till_sales' }] })
    const shown = calculatedModel(model, d, result, 'en', wordsOf(en))
    expect(viewMeasureOf('basket', shown, result, 'en')).toMatchObject({ unit: 'SAR', shape: 'rate', label: 'Net till value per Till sales' })
    expect(shown.measures.find((x) => x.key === 'basket')?.unit).toBe('SAR')
    expect(shown.measures.find((x) => x.key === 'share')?.unit).toBe('percent')
  })
})
