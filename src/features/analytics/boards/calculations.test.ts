import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import type { AnalyticsCalculation } from '@/core/models/analytics-calculations'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { calculatedModel, measureKeysOf, untilNote, type CalculationWords } from './calculations'
import { viewMeasureOf } from './view-model'

// The words as the screen gets them from i18next: the locale's own templates, interpolated.
const fill = (template: string, values: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? '')
const wordsOf = (bundle: typeof en): CalculationWords => ({
  shareOfTotal: (v) => fill(bundle.calculation.label.shareOfTotal, v),
  ratio: (v) => fill(bundle.calculation.label.ratio, v),
  cumulativeShare: (v) => fill(bundle.calculation.label.cumulativeShare, v),
  change: (v) => fill(bundle.calculation.label.change, v),
})
const EN = wordsOf(en)
const AR = wordsOf(ar)

const model = {
  areas: [],
  measures: [
    { key: 'delivery_value', area: 'sales', shape: 'additive', unit: 'SAR', label: { en: 'Delivery value', ar: 'قيمة التوصيل' }, description: { en: '', ar: '' }, dimensions: ['region'] },
    { key: 'total_value', area: 'sales', shape: 'additive', unit: 'SAR', label: { en: 'Total value', ar: 'القيمة الإجمالية' }, description: { en: '', ar: '' }, dimensions: ['region'] },
  ],
  dimensions: [{ key: 'region', kind: 'category', label: { en: 'Region', ar: 'المنطقة' }, values: [] }],
} as unknown as AnalyticsModel

const CALCS: AnalyticsCalculation[] = [
  { key: 'deliveryShare', kind: 'shareOfTotal', measure: 'delivery_value' },
  { key: 'deliveryPct', kind: 'ratio', measure: 'delivery_value', of: 'total_value' },
  { key: 'running', kind: 'cumulativeShare', measure: 'delivery_value', until: 80 },
  { key: 'growth', kind: 'change', measure: 'delivery_value' },
]

const def = (calculations?: AnalyticsCalculation[]): AnalyticsViewDefinition =>
  ({ chart: { type: 'table' }, query: { measures: ['delivery_value', 'total_value'], dimensions: ['region'], filters: [], ...(calculations ? { calculations } : {}) } }) as AnalyticsViewDefinition

const calcColumn = (c: AnalyticsCalculation) => ({ key: c.key, role: 'measure' as const, shape: 'rate' as const, unit: 'percent' as const, calculation: { kind: c.kind, measure: c.measure, ...(c.of ? { of: c.of } : {}) } })

const result = (calcs: AnalyticsCalculation[], extra: Partial<AnalyticsQueryResult> = {}): AnalyticsQueryResult => ({
  columns: [
    { key: 'region', role: 'dimension' },
    { key: 'delivery_value', role: 'measure', shape: 'additive', unit: 'SAR' },
    { key: 'total_value', role: 'measure', shape: 'additive', unit: 'SAR' },
    // The server's column order need not be the query's: the query's order wins.
    ...[...calcs].reverse().map(calcColumn),
  ],
  rows: [],
  total: 0,
  truncated: false,
  period: null,
  previous: [],
  fetchedAt: '',
  dataAsOf: '',
  ...extra,
})

describe('calculated columns are measures', () => {
  it('come after the query’s own measures, in the order of query.calculations', () => {
    expect(measureKeysOf(def(CALCS), result(CALCS))).toEqual(['delivery_value', 'total_value', 'deliveryShare', 'deliveryPct', 'running', 'growth'])
  })

  it('a definition without calculations reads its measures as it always did', () => {
    expect(measureKeysOf(def(), result([]))).toEqual(['delivery_value', 'total_value'])
  })

  it('a calculation the result did not return is not drawn', () => {
    expect(measureKeysOf(def(CALCS), result(CALCS.slice(0, 1)))).toEqual(['delivery_value', 'total_value', 'deliveryShare'])
  })

  it('read as a rate in percent', () => {
    const r = result(CALCS)
    const m = viewMeasureOf('deliveryShare', calculatedModel(model, def(CALCS), r, 'en', EN), r, 'en')
    expect(m).toEqual({ key: 'deliveryShare', label: 'Share of Delivery value', unit: 'percent', shape: 'rate' })
  })
})

describe('a calculated column’s label', () => {
  const labels = (lang: string, words: CalculationWords, calcs = CALCS) => {
    const r = result(calcs)
    const shown = calculatedModel(model, def(calcs), r, lang, words)
    return calcs.map((c) => viewMeasureOf(c.key, shown, r, lang).label)
  }

  it('derives the default per kind in English', () => {
    expect(labels('en', EN)).toEqual(['Share of Delivery value', 'Delivery value as % of Total value', 'Running share of Delivery value', 'Change in Delivery value'])
  })

  it('derives the default per kind in Arabic', () => {
    expect(labels('ar', AR)).toEqual(['حصة قيمة التوصيل', 'قيمة التوصيل كنسبة من القيمة الإجمالية', 'الحصة التراكمية لـقيمة التوصيل', 'التغير في قيمة التوصيل'])
  })

  it('an explicit label wins, in the viewer’s language', () => {
    const named: AnalyticsCalculation[] = [{ ...CALCS[0], label: { en: 'Delivery %', ar: 'نسبة التوصيل' } }]
    expect(labels('en', EN, named)).toEqual(['Delivery %'])
    expect(labels('ar', AR, named)).toEqual(['نسبة التوصيل'])
  })

  it('a measure the model does not hold is named by its key', () => {
    const odd: AnalyticsCalculation[] = [{ key: 'x', kind: 'shareOfTotal', measure: 'gone' }]
    expect(labels('en', EN, odd)).toEqual(['Share of gone'])
  })

  it('leaves the model as it was when the result has no calculated column', () => {
    expect(calculatedModel(model, def(), result([]), 'en', EN)).toBe(model)
  })
})

describe('the 80 % note', () => {
  it('shows when the result says the cut was not reached, naming the until', () => {
    expect(untilNote(def(CALCS), result(CALCS, { untilReached: false }))).toEqual({ until: 80 })
  })

  it('shows none when it was reached, or the result does not say', () => {
    expect(untilNote(def(CALCS), result(CALCS, { untilReached: true }))).toBeNull()
    expect(untilNote(def(CALCS), result(CALCS))).toBeNull()
  })
})
