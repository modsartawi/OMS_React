import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { calculationLabel, untilNote, type CalculationWords } from './calculations'
import { addCalculation, settleCalculations, withinChoices, withinProblem } from './calculations-edit'

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
  shareOfTotalWithin: (v) => fill(bundle.calculation.label.shareOfTotalWithin, v),
  cumulativeShareWithin: (v) => fill(bundle.calculation.label.cumulativeShareWithin, v),
})

describe('within: the default label (ticket 863)', () => {
  it('reads "Share of {measure} in each {parent}" in English and Arabic', () => {
    const share = { kind: 'shareOfTotal' as const, measure: 'net', within: ['region'] }
    expect(calculationLabel(share, null, MODEL, 'en', wordsOf(en))).toBe('Share of Net value in each Region')
    expect(calculationLabel(share, null, MODEL, 'ar', wordsOf(ar))).toBe('حصة صافي القيمة في كل المنطقة')
  })

  it('names two parents together, and a running share the same way', () => {
    const running = { kind: 'cumulativeShare' as const, measure: 'net', within: ['region', 'city'] }
    expect(calculationLabel(running, null, MODEL, 'en', wordsOf(en))).toBe('Running share of Net value in each Region and City')
    expect(calculationLabel(running, null, MODEL, 'ar', wordsOf(ar))).toBe('الحصة التراكمية لـصافي القيمة في كل المنطقة والمدينة')
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
