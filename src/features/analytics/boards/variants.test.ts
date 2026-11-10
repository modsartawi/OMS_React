import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { calculatedModel, type CalculationWords } from './calculations'
import { allowedDimensions } from './editor'
import { viewMeasureOf } from './view-model'
import { withDimensions, withMeasures } from './panel-edit'
import { addCalculation, measuresFor, ofFor, sortKeys } from './calculations-edit'
import { addVariant, droppedVariantsBy, removeVariant, settleVariants, variantFilterDimensions, variantLabel, variantMeasures, variantModel, variantProblem, type VariantWord } from './variants'
import { readDefinition } from './wire'

// Ticket 863 (BackOffice spec 3543 part B, decisions 5–8; owner-kept 3546 defaults): "Add filtered measure".
const label = (en: string, ar: string) => ({ en, ar })
const DIMS = ['region', 'city', 'delivery_type', 'channel', 'day']
const MODEL: AnalyticsModel = {
  areas: [{ key: 'till', available: true }, { key: 'claims', available: true }],
  measures: [
    { key: 'net', area: 'till', shape: 'additive', unit: 'SAR', label: label('Till value', 'قيمة المبيعات'), description: label('', ''), dimensions: DIMS },
    { key: 'orders', area: 'till', shape: 'additive', unit: 'count', label: label('Orders', 'الطلبات'), description: label('', ''), dimensions: DIMS },
    { key: 'claim_value', area: 'claims', shape: 'additive', unit: 'SAR', label: label('Claim value', 'قيمة المطالبات'), description: label('', ''), dimensions: ['region'] },
  ],
  dimensions: [
    { key: 'region', kind: 'category', label: label('Region', 'المنطقة'), values: [] },
    { key: 'city', kind: 'category', label: label('City', 'المدينة'), values: [] },
    {
      key: 'delivery_type',
      kind: 'category',
      label: label('Delivery type', 'نوع التوصيل'),
      values: [
        { key: 'DL', label: label('Delivery', 'توصيل') },
        { key: 'PU', label: label('Pickup', 'استلام') },
      ],
    },
    { key: 'channel', kind: 'category', label: label('Channel', 'القناة'), values: [{ key: 'app', label: label('App', 'التطبيق') }] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
}
const DL = [{ dimension: 'delivery_type', values: ['DL'] }]

const def = (dimensions = ['region', 'city']): AnalyticsViewDefinition => ({
  chart: { type: 'table' },
  query: { measures: ['net'], dimensions, filters: [], period: 'last-30-days' },
})

const fill = (template: string, values: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? '')
const wordOf = (bundle: typeof en): VariantWord => (v) => fill(bundle.variant.label, v)

describe('variants: what "Add filtered measure" offers (decisions 5, 6)', () => {
  it("filters only on the measure's own breakdowns the query does not break down by", () => {
    expect(variantFilterDimensions('net', ['region', 'city'], MODEL).map((d) => d.key)).toEqual(['delivery_type', 'channel'])
    expect(variantFilterDimensions('claim_value', [], MODEL).map((d) => d.key)).toEqual(['region'])
  })

  it("offers the measures of the query's own area", () => {
    expect(variantMeasures(def(), MODEL)).toEqual(['net', 'orders'])
  })

  it('refuses a filter on a broken-down dimension, a variant with no filter, a half label, and a fifth', () => {
    expect(variantProblem({ measure: 'net', filters: DL }, def(), MODEL)).toBeNull()
    expect(variantProblem({ measure: 'net', filters: [{ dimension: 'region', values: ['R1'] }] }, def(), MODEL)).toBe('brokenDown')
    expect(variantProblem({ measure: 'net', filters: [] }, def(), MODEL)).toBe('noFilter')
    expect(variantProblem({ measure: 'net', filters: [{ dimension: 'channel', values: [] }] }, def(), MODEL)).toBe('noFilter')
    expect(variantProblem({ measure: 'net', filters: DL, label: { en: 'Delivery value', ar: '' } }, def(), MODEL)).toBe('oneLanguage')
    let d = def()
    for (let i = 0; i < 4; i++) d = addVariant(d, { measure: 'net', filters: DL }, MODEL)
    expect(variantProblem({ measure: 'net', filters: DL }, d, MODEL)).toBe('full')
  })
})

describe('variants: the saved definition (decision 5, owner-kept 3546 defaults)', () => {
  it('carries the variant AND lists its key in the measures, and reads back from the wire unchanged', () => {
    const d = addVariant(def(), { measure: 'net', filters: DL, label: { en: ' Delivery value ', ar: 'قيمة التوصيل' } }, MODEL)
    expect(d.query.variants).toEqual([{ key: 'net_DL', measure: 'net', filters: DL, label: { en: 'Delivery value', ar: 'قيمة التوصيل' } }])
    expect(d.query.measures).toEqual(['net', 'net_DL'])
    expect(readDefinition(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  it('keys each one uniquely, by the 3519 key rule, never as a measure, dimension, calculation or other variant', () => {
    let d = addVariant(def(), { measure: 'net', filters: DL }, MODEL)
    d = addVariant(d, { measure: 'net', filters: DL }, MODEL)
    d = addVariant(d, { measure: 'orders', filters: [{ dimension: 'channel', values: ['app'] }] }, MODEL)
    expect(d.query.variants!.map((v) => v.key)).toEqual(['net_DL', 'net_DL_2', 'orders_app'])
    for (const v of d.query.variants!) expect(v.key).toMatch(/^[a-z][A-Za-z0-9_]{0,39}$/)
  })

  it('a saved definition carries a share within and a variant together', () => {
    let d = addVariant(def(), { measure: 'net', filters: DL }, MODEL)
    const model = variantModel(MODEL, d.query.variants!, 'en', wordOf(en))
    d = addCalculation(d, { kind: 'shareOfTotal', measure: 'net_DL', within: ['region'] }, model)
    d = addCalculation(d, { kind: 'ratio', measure: 'net_DL', of: 'net' }, model)
    const wire = JSON.parse(JSON.stringify(d))
    expect(wire.query).toMatchObject({
      measures: ['net', 'net_DL'],
      variants: [{ key: 'net_DL', measure: 'net', filters: DL }],
      calculations: [
        { key: 'share_net_DL', kind: 'shareOfTotal', measure: 'net_DL', within: ['region'] },
        { key: 'ratio_net_DL_net', kind: 'ratio', measure: 'net_DL', of: 'net' },
      ],
    })
    expect(readDefinition(wire)).toEqual(d)
  })
})

describe('variants: every measure picker sees them (decisions 5, 7)', () => {
  const d = addVariant(def(), { measure: 'net', filters: DL }, MODEL)
  const model = variantModel(MODEL, d.query.variants!, 'en', wordOf(en))

  it("keeps its measure's shape and unit, so a variant ÷ its measure is a same-unit ratio", () => {
    expect(measuresFor('shareOfTotal', d.query.measures, model)).toEqual(['net', 'net_DL'])
    expect(ofFor('net_DL', d.query.measures, model)).toEqual(['net'])
  })

  it('is a sort key, and the breakdown picker no longer offers its filtered dimension', () => {
    expect(sortKeys(d)).toEqual(['net', 'net_DL'])
    expect(allowedDimensions(d.query.measures, model).map((x) => x.key)).toEqual(['region', 'city', 'channel', 'day'])
  })
})

describe('variants: the default label (ticket 863)', () => {
  it('reads "{measure} ({filter values})" in English and Arabic', () => {
    const v = { measure: 'net', filters: DL }
    expect(variantLabel(v, MODEL, 'en', wordOf(en))).toBe('Till value (Delivery)')
    expect(variantLabel(v, MODEL, 'ar', wordOf(ar))).toBe('قيمة المبيعات (توصيل)')
  })

  it('names several values as either, and an open dimension value by its code', () => {
    const v = {
      measure: 'net',
      filters: [
        { dimension: 'delivery_type', values: ['DL', 'PU'] },
        { dimension: 'city', values: ['RUH'] },
      ],
    }
    expect(variantLabel(v, MODEL, 'en', wordOf(en))).toBe('Till value (Delivery or Pickup, RUH)')
  })

  it('takes its own label, both languages, over the default', () => {
    expect(variantLabel({ measure: 'net', filters: DL, label: { en: 'Delivery value', ar: 'قيمة التوصيل' } }, MODEL, 'ar', wordOf(ar))).toBe('قيمة التوصيل')
  })
})

describe('variants: a change under them', () => {
  it('takes a variant out with its key, and the calculations that read it, when it is removed', () => {
    let d = addVariant(def(), { measure: 'net', filters: DL }, MODEL)
    d = addCalculation(d, { kind: 'shareOfTotal', measure: 'net_DL' }, variantModel(MODEL, d.query.variants!, 'en', wordOf(en)))
    const out = removeVariant(d, 'net_DL', MODEL)
    expect(out.query.measures).toEqual(['net'])
    expect('variants' in out.query).toBe(false)
    expect('calculations' in out.query).toBe(false)
  })

  it('drops a variant whose key left the measures, or whose filter is now broken down, and says which', () => {
    const d = addVariant(def(), { measure: 'net', filters: DL }, MODEL)
    const unticked = settleVariants({ ...d, query: { ...d.query, measures: ['net'] } }, MODEL)
    expect('variants' in unticked.definition.query).toBe(false)
    expect(unticked.dropped).toEqual([])
    const broken = settleVariants({ ...d, query: { ...d.query, dimensions: ['region', 'delivery_type'] } }, MODEL)
    expect(broken.dropped.map((x) => [x.variant.key, x.reason])).toEqual([['net_DL', 'brokenDown']])
    expect(broken.definition.query.measures).toEqual(['net'])
  })

  it('leaves a definition without variants exactly as it was', () => {
    const d = def()
    expect(settleVariants(d, MODEL).definition).toBe(d)
  })
})

describe('variants: a panel draws and names their columns', () => {
  const words = { ratio: (v: { measure: string; of: string }) => `${v.measure} as % of ${v.of}` } as unknown as CalculationWords
  const d = addCalculation(addVariant(def(['region']), { measure: 'net', filters: DL }, MODEL), { kind: 'ratio', measure: 'net_DL', of: 'net' }, variantModel(MODEL, [{ key: 'net_DL', measure: 'net', filters: DL }], 'en', wordOf(en)))
  const result = {
    columns: [
      { key: 'region', role: 'dimension' as const },
      { key: 'net', role: 'measure' as const, shape: 'additive' as const, unit: 'SAR' as const },
      { key: 'net_DL', role: 'measure' as const, shape: 'additive' as const, unit: 'SAR' as const, variant: { measure: 'net', filters: DL } },
      { key: 'ratio_net_DL_net', role: 'measure' as const, shape: 'rate' as const, unit: 'percent' as const, calculation: { kind: 'ratio' as const, measure: 'net_DL', of: 'net' } },
    ],
    rows: [],
    total: 0,
    truncated: false,
    period: null,
    previous: [],
    fetchedAt: '',
    dataAsOf: '',
  }

  it("names a variant column by its default label, in its measure's unit, and a ratio over it by that name", () => {
    const shown = calculatedModel(MODEL, d, result, 'ar', words, wordOf(ar))
    expect(viewMeasureOf('net_DL', shown, result, 'ar')).toEqual({ key: 'net_DL', label: 'قيمة المبيعات (توصيل)', unit: 'SAR', shape: 'additive' })
    const inEnglish = calculatedModel(MODEL, d, result, 'en', words, wordOf(en))
    expect(viewMeasureOf('ratio_net_DL_net', inEnglish, result, 'en').label).toBe('Till value (Delivery) as % of Till value')
  })

  it("names a variant column the definition does not hold from the column's own origin", () => {
    const bare = { ...d, query: { ...d.query, variants: undefined } }
    const shown = calculatedModel(MODEL, bare, result, 'en', words, wordOf(en))
    expect(viewMeasureOf('net_DL', shown, result, 'en').label).toBe('Till value (Delivery)')
  })
})

describe('variants: a report panel edit settles them (panel-edit)', () => {
  const d = addVariant(def(['region']), { measure: 'net', filters: DL }, MODEL)
  const model = variantModel(MODEL, d.query.variants!, 'en', wordOf(en))

  it('takes the variant out when its key is unticked', () => {
    expect('variants' in withMeasures(d, ['net'], model).query).toBe(false)
  })

  it('takes the variant and its key out when the query breaks down by its filter', () => {
    const next = withDimensions(d, ['region', 'delivery_type'], model)
    expect(next.query.measures).toEqual(['net'])
    expect('variants' in next.query).toBe(false)
  })
})

describe('variants: the note names what an edit took out', () => {
  it('names a variant whose filter became a breakdown, and not one the author unticked', () => {
    const d = addVariant(def(['region']), { measure: 'net', filters: DL }, MODEL)
    const model = variantModel(MODEL, d.query.variants!, 'en', wordOf(en))
    expect(droppedVariantsBy(d, withDimensions(d, ['region', 'delivery_type'], model), MODEL).map((x) => [x.variant.key, x.reason])).toEqual([['net_DL', 'brokenDown']])
    expect(droppedVariantsBy(d, withMeasures(d, ['net'], model), MODEL)).toEqual([])
  })
})
