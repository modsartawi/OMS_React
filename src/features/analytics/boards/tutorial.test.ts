import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsReportBlock, AnalyticsViewDefinition } from '@/core/models/analytics'
import { validateReport } from './report'
import { sampleReport } from './sample-report'
import { TUTORIAL_STEPS, tutorialChecks, type TutorialDraft } from './tutorial'

const label = (en: string) => ({ en, ar: en })
const model: AnalyticsModel = {
  areas: [],
  measures: [
    { key: 'till_value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Value through our tills'), description: label(''), dimensions: ['channel_group', 'delivery_type', 'store', 'day'] },
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders'), description: label(''), dimensions: ['channel_group', 'delivery_type', 'store', 'day'] },
    { key: 'cancellation_rate', area: 'orders', shape: 'rate', unit: 'share', label: label('Cancellation rate'), description: label(''), dimensions: ['channel_group', 'delivery_type', 'store', 'day'] },
  ],
  dimensions: [],
}

/** A blank report, as the designer opens a new one: no title, no section, no parameter. */
const blank: TutorialDraft = { title: { en: '', ar: '' }, definition: { params: [], bindings: {}, sections: [] } }

const HS = { id: 'hs', label: label('HungerStation'), filters: [{ dimension: 'channel_group', values: ['hungerstation'] }] }
const QC = { id: 'qc', label: label('QC'), filters: [{ dimension: 'delivery_type', values: ['QC'] }] }
const panel = (id: string, definition: AnalyticsViewDefinition): AnalyticsReportBlock => ({ id, kind: 'panel', title: label(''), definition })
const view = (type: AnalyticsViewDefinition['chart']['type'], measures: string[], dimensions: string[], series?: AnalyticsViewDefinition['series']): AnalyticsViewDefinition => ({
  chart: { type },
  query: { measures, dimensions, filters: [] },
  ...(series ? { series } : {}),
})
const withBlocks = (blocks: AnalyticsReportBlock[], extra: Partial<TutorialDraft['definition']> = {}): TutorialDraft => ({
  title: { en: '', ar: '' },
  definition: { params: [], bindings: {}, sections: [{ id: 's1', heading: label('Sales'), blocks }], ...extra },
})

describe('the tutorial checks', () => {
  it('are the acceptance case, in order', () => {
    expect(TUTORIAL_STEPS).toEqual(['title', 'section', 'chart', 'series', 'rate', 'figure', 'summary', 'period'])
  })

  it('tick nothing on a blank report', () => {
    const done = tutorialChecks(blank, model)
    for (const step of TUTORIAL_STEPS) expect(done[step], step).toBe(false)
  })

  it('tick every step on the finished report', () => {
    const done = tutorialChecks(sampleReport(), model)
    for (const step of TUTORIAL_STEPS) expect(done[step], step).toBe(true)
  })

  it('take a title in either language', () => {
    expect(tutorialChecks({ ...blank, title: { en: '', ar: 'مبيعات القنوات' } }, model).title).toBe(true)
    expect(tutorialChecks({ ...blank, title: { en: '   ', ar: '' } }, model).title).toBe(false)
  })

  it('want the channel chart as a bar of net sales by channel, with no series', () => {
    expect(tutorialChecks(withBlocks([panel('p1', view('bar', ['till_value'], ['channel_group']))]), model).chart).toBe(true)
    expect(tutorialChecks(withBlocks([panel('p1', view('kpi', ['till_value'], []))]), model).chart).toBe(false)
    expect(tutorialChecks(withBlocks([panel('p1', view('bar', ['till_value'], ['day']))]), model).chart).toBe(false)
    expect(tutorialChecks(withBlocks([panel('p1', view('bar', ['till_value'], ['channel_group'], [HS, QC]))]), model).chart).toBe(false)
  })

  it('want both HungerStation and QC on one panel, and the rate on that panel', () => {
    const one = tutorialChecks(withBlocks([panel('p1', view('bar', ['orders'], ['day'], [HS]))]), model)
    expect(one.series).toBe(false)
    const both = tutorialChecks(withBlocks([panel('p1', view('bar', ['orders'], ['day'], [HS, QC]))]), model)
    expect([both.series, both.rate]).toEqual([true, false])
    const rate = tutorialChecks(withBlocks([panel('p1', view('line', ['cancellation_rate'], ['day'], [HS, QC]))]), model)
    expect([rate.series, rate.rate]).toEqual([true, true])
    // A rate without the two series is not the comparison yet.
    expect(tutorialChecks(withBlocks([panel('p1', view('line', ['cancellation_rate'], ['day']))]), model).rate).toBe(false)
  })

  it('want a text holding a live figure the report can fill', () => {
    const p = panel('p1', view('bar', ['till_value'], ['channel_group']))
    const text = (en: string): AnalyticsReportBlock => ({ id: 't1', kind: 'text', text: { en, ar: '' } })
    expect(tutorialChecks(withBlocks([p, text('Tills took {p1:total}.')]), model).figure).toBe(true)
    expect(tutorialChecks(withBlocks([p, text('Tills took a lot.')]), model).figure).toBe(false)
    expect(tutorialChecks(withBlocks([p, text('Gone: {p9:total}.')]), model).figure).toBe(false)
    expect(tutorialChecks(withBlocks([p, text('Not single: {p1:hs}.')]), model).figure).toBe(false)
  })

  it('want the period to default to yesterday and reach every panel', () => {
    const blocks = [panel('p1', view('bar', ['till_value'], ['channel_group'])), panel('p2', view('bar', ['orders'], ['day']))]
    const period = (token: 'yesterday' | 'last-7-days') => [{ name: 'period', kind: 'period' as const, label: label('Period'), required: true, default: { kind: 'period' as const, token } }]
    expect(tutorialChecks(withBlocks(blocks, { params: period('yesterday'), bindings: { period: { p1: true, p2: true } } }), model).period).toBe(true)
    expect(tutorialChecks(withBlocks(blocks, { params: period('yesterday'), bindings: { period: { p1: true } } }), model).period).toBe(false)
    expect(tutorialChecks(withBlocks(blocks, { params: period('last-7-days'), bindings: { period: { p1: true, p2: true } } }), model).period).toBe(false)
    // No panel yet: nothing to reach, so not done.
    expect(tutorialChecks({ ...blank, definition: { ...blank.definition, params: period('yesterday') } }, model).period).toBe(false)
  })
})

describe('the finished report', () => {
  it('saves: no declaration problem against a model that holds its keys', () => {
    const full: AnalyticsModel = {
      ...model,
      measures: model.measures.map((m) => ({ ...m, dimensions: [...m.dimensions, 'city'] })),
      dimensions: [
        { key: 'day', kind: 'time', label: label('Day'), values: [] },
        { key: 'channel_group', kind: 'category', label: label('Channel'), values: [] },
        { key: 'delivery_type', kind: 'category', label: label('Delivery type'), values: [] },
        { key: 'store', kind: 'category', label: label('Store'), values: [] },
        { key: 'city', kind: 'category', label: label('City'), values: [] },
      ],
    }
    expect(validateReport(sampleReport().definition, full)).toEqual([])
  })
})
