import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { calculationLabel, eachParent, figureMeasureName, untilNote, type CalculationWords } from './calculations'
import { addCalculation, settleCalculations, withinChoices, withinProblem } from './calculations-edit'
import { toTableView } from './view-model-forms'

// Ticket 863 (BackOffice spec 3543 part A, decisions 1–4): a share or a running share within a parent.
const label = (en: string, ar: string) => ({ en, ar })
const DIMS = ['region', 'city', 'channel', 'day']
const MODEL: AnalyticsModel = {
  areas: [{ key: 'till', available: true }],
  measures: [
    { key: 'net', area: 'till', shape: 'additive', unit: 'SAR', label: label('Net value', 'صافي القيمة'), description: label('', ''), dimensions: DIMS },
    { key: 'avg_basket', area: 'till', shape: 'rate', unit: 'SAR', label: label('Average basket', 'متوسط السلة'), description: label('', ''), dimensions: DIMS },
  ],
  dimensions: [
    { key: 'region', kind: 'category', label: label('Region', 'المنطقة'), values: [] },
    { key: 'city', kind: 'category', label: label('City', 'المدينة'), values: [] },
    { key: 'channel', kind: 'category', label: label('Channel', 'القناة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
}

const def = (dimensions: string[]): AnalyticsViewDefinition => ({
  chart: { type: 'table' },
  query: { measures: ['net'], dimensions, filters: [], period: 'last-30-days' },
})

describe('within: what the share pickers offer (spec 3543 decision 1)', () => {
  it("offers the query's own category breakdowns, and nothing with one breakdown", () => {
    expect(withinChoices(['region', 'city'], MODEL)).toEqual(['region', 'city'])
    expect(withinChoices(['region'], MODEL)).toEqual([])
    // The date is already each share's partition: naming it changes nothing, so it is not offered.
    expect(withinChoices(['day', 'region', 'channel'], MODEL)).toEqual(['region', 'channel'])
    expect(withinChoices(['day', 'region'], MODEL)).toEqual([])
  })

  it('refuses a pick that names every category breakdown (every row would be 100 %) or one the query lacks', () => {
    expect(withinProblem(['region'], ['region', 'city'], MODEL)).toBeNull()
    expect(withinProblem(['region', 'city'], ['region', 'city'], MODEL)).toBe('all')
    expect(withinProblem(['region', 'city'], ['day', 'region', 'city'], MODEL)).toBe('all')
    expect(withinProblem(['store'], ['region', 'city'], MODEL)).toBe('notInQuery')
  })
})

describe('within: the saved definition (decisions 1, 3)', () => {
  it('carries within on a share and a running share, and never on another kind', () => {
    let d = addCalculation(def(['region', 'city']), { kind: 'shareOfTotal', measure: 'net', within: ['region'] }, MODEL)
    d = addCalculation(d, { kind: 'cumulativeShare', measure: 'net', within: ['region'], until: 80 }, MODEL)
    d = addCalculation({ ...d, query: { ...d.query, compareToPrevious: true } }, { kind: 'change', measure: 'net', within: ['region'] }, MODEL)
    expect(JSON.parse(JSON.stringify(d.query.calculations))).toEqual([
      { key: 'share_net', kind: 'shareOfTotal', measure: 'net', within: ['region'] },
      { key: 'running_net', kind: 'cumulativeShare', measure: 'net', until: 80, within: ['region'] },
      { key: 'change_net', kind: 'change', measure: 'net' },
    ])
  })

  it('leaves an empty within out: a share of the whole result, as in 3519', () => {
    const d = addCalculation(def(['region', 'city']), { kind: 'shareOfTotal', measure: 'net', within: [] }, MODEL)
    expect(d.query.calculations).toEqual([{ key: 'share_net', kind: 'shareOfTotal', measure: 'net' }])
  })

  it('drops a share within with a note when its parent breakdown leaves the query, or it would name them all', () => {
    const d = addCalculation(def(['region', 'city']), { kind: 'shareOfTotal', measure: 'net', within: ['region'] }, MODEL)
    const gone = settleCalculations({ ...d, query: { ...d.query, dimensions: ['city'] } }, MODEL)
    expect(gone.dropped.map((x) => [x.calculation.key, x.reason])).toEqual([['share_net', 'within']])
    expect('calculations' in gone.definition.query).toBe(false)
    const kept = settleCalculations({ ...d, query: { ...d.query, dimensions: ['region', 'city', 'channel'] } }, MODEL)
    expect(kept.dropped).toEqual([])
  })
})

// The words as the screen gets them from i18next: the locale's own templates, interpolated.
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

describe('within: the default label (ticket 863)', () => {
  it('reads "Share of {measure} in each {parent}" in English and Arabic', () => {
    const share = { kind: 'shareOfTotal' as const, measure: 'net', within: ['region'] }
    expect(calculationLabel(share, null, MODEL, 'en', wordsOf(en))).toBe('Share of Net value in each Region')
    expect(calculationLabel(share, null, MODEL, 'ar', wordsOf(ar))).toBe('حصة صافي القيمة في كل منطقة') // كل + an indefinite noun: each region, not the whole region
  })

  it('names two parents together, and a running share the same way', () => {
    const running = { kind: 'cumulativeShare' as const, measure: 'net', within: ['region', 'city'] }
    expect(calculationLabel(running, null, MODEL, 'en', wordsOf(en))).toBe('Running share of Net value in each Region and City')
    expect(calculationLabel(running, null, MODEL, 'ar', wordsOf(ar))).toBe('الحصة التراكمية من صافي القيمة في كل منطقة ومدينة')
  })

  it('keeps the 3519 label without within, and an own label over the default', () => {
    expect(calculationLabel({ kind: 'shareOfTotal', measure: 'net' }, null, MODEL, 'en', wordsOf(en))).toBe('Share of Net value')
    expect(calculationLabel({ kind: 'shareOfTotal', measure: 'net', within: ['region'] }, { en: 'Regional mix', ar: 'مزيج المناطق' }, MODEL, 'ar', wordsOf(ar))).toBe('مزيج المناطق')
  })
})

describe('within: the 80 % note per parent (decision 3)', () => {
  const running = { ...def(['region', 'channel']), query: { ...def(['region', 'channel']).query, calculations: [{ key: 'r', kind: 'cumulativeShare' as const, measure: 'net', until: 80, within: ['region'] }] } }
  const result = (untilReached: unknown) => ({ columns: [], rows: [], total: 0, truncated: false, period: null, previous: [], fetchedAt: '', dataAsOf: '', untilReached }) as never

  it('names each parent whose rows ran out before the threshold', () => {
    const note = untilNote(running, result([{ parent: { region: 'R1' }, reached: true }, { parent: { region: 'R2' }, reached: false }, { parent: { region: 'R3' }, reached: false }]))
    expect(note).toEqual({ until: 80, parents: [{ region: 'R2' }, { region: 'R3' }] })
  })

  it('says nothing when every parent reached it, and keeps the 3519 note for a plain false', () => {
    expect(untilNote(running, result([{ parent: { region: 'R1' }, reached: true }]))).toBeNull()
    expect(untilNote(running, result(false))).toEqual({ until: 80 })
  })
})

describe('figureMeasureName: a live figure is named like its column (862 walk 2026-11-10)', () => {
  // The report's "Insert a live figure" listed a variant and a ratio by their keys.
  const definition: AnalyticsViewDefinition = {
    chart: { type: 'table' },
    query: {
      measures: ['net', 'net_DL'],
      dimensions: ['city'],
      filters: [],
      variants: [{ key: 'net_DL', measure: 'net', filters: [{ dimension: 'channel', values: ['DL'] }], label: { en: 'Delivery value', ar: 'قيمة التوصيل' } }],
      calculations: [{ key: 'ratio_net_DL', kind: 'ratio', measure: 'net_DL', of: 'net' }],
    },
  }
  const variantWord = (v: { measure: string; values: string }) => `${v.measure} (${v.values})`
  it('a model measure by its label, a variant by its label, a calculation by its derived label', () => {
    expect(figureMeasureName(definition, 'net', MODEL, 'en', wordsOf(en), variantWord)).toBe('Net value')
    expect(figureMeasureName(definition, 'net_DL', MODEL, 'en', wordsOf(en), variantWord)).toBe('Delivery value')
    expect(figureMeasureName(definition, 'ratio_net_DL', MODEL, 'en', wordsOf(en), variantWord)).toBe('Delivery value as % of Net value')
    expect(figureMeasureName(definition, 'ratio_net_DL', MODEL, 'ar', wordsOf(ar), variantWord)).toBe('قيمة التوصيل كنسبة من صافي القيمة')
  })
  it('a key nothing names reads as itself', () => {
    expect(figureMeasureName(definition, 'gone', MODEL, 'en', wordsOf(en), variantWord)).toBe('gone')
  })
})

describe('eachParent: the parents after "each" (local walk 2026-11-10)', () => {
  it('in Arabic each parent drops its article, so كل reads "each", never "the whole"', () => {
    expect(eachParent(['المدينة'], 'ar')).toBe('مدينة')
    expect(eachParent(['المنطقة', 'المدينة'], 'ar')).toBe('منطقة ومدينة')
    expect(eachParent(['نوع التوصيل'], 'ar')).toBe('نوع التوصيل')
  })
  it('in English the labels are listed as they are', () => {
    expect(eachParent(['Region', 'City'], 'en')).toBe('Region and City')
  })
})

describe('within: the top N in each parent on a saved table (decision 3)', () => {
  it("draws the server's per-parent rows as they come: never re-sorted or cut to the top N across parents", () => {
    // The server kept the top 2 of each region, grouped by region; a global sort and a top 2 would keep Riyadh only.
    const definition: AnalyticsViewDefinition = {
      chart: { type: 'table', sort: { key: 'net', direction: 'desc' }, topN: 2 },
      query: {
        measures: ['net'],
        dimensions: ['region', 'city'],
        filters: [],
        calculations: [{ key: 'running', kind: 'cumulativeShare', measure: 'net', within: ['region'] }],
      },
    }
    const rows = [
      { region: 'Jeddah', city: 'J1', net: 60, running: 30 },
      { region: 'Jeddah', city: 'J2', net: 50, running: 55 },
      { region: 'Riyadh', city: 'R1', net: 500, running: 50 },
      { region: 'Riyadh', city: 'R2', net: 300, running: 80 },
    ]
    const result = {
      columns: [
        { key: 'region', role: 'dimension' },
        { key: 'city', role: 'dimension' },
        { key: 'net', role: 'measure', shape: 'additive', unit: 'SAR' },
        { key: 'running', role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind: 'cumulativeShare', measure: 'net', within: ['region'] } },
      ],
      rows,
      total: rows.length,
      truncated: false,
      period: { from: '2026-11-01', to: '2026-11-05' },
      previous: [],
      fetchedAt: '2026-11-05T10:00:00',
    } as unknown as Parameters<typeof toTableView>[0]

    const view = toTableView(result, definition, MODEL, 'en')

    expect(view.rows.map((r) => r.city)).toEqual(['J1', 'J2', 'R1', 'R2'])
    expect(view.cut).toBe(false)
    // Local walk 2026-11-10: the grid applied the sort itself and interleaved the regions; it is handed none.
    expect(view.sort).toBeNull()
  })
})
