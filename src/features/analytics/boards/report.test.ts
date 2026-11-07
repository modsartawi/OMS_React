import { describe, expect, it } from 'vitest'
import type { AnalyticsLabel, AnalyticsModel, AnalyticsReportDefinition, AnalyticsViewDefinition, Param } from '@/core/models/analytics'
import { asBoardPanel, figureProblems, reportBlocks, reportPanels, runValues, validateReport, wordsAsked } from './report'

const view: AnalyticsViewDefinition = { chart: { type: 'bar' }, query: { measures: ['orders'], dimensions: ['day'], filters: [] } }
const l = (en: string) => ({ en, ar: en })
const def = (sections: AnalyticsReportDefinition['sections']): AnalyticsReportDefinition => ({ params: [], bindings: {}, sections })

describe('a report definition (827)', () => {
  const sample = def([
    { id: 's1', heading: l('Sales'), blocks: [{ id: 'p1', kind: 'panel', title: l(''), definition: view }, { id: 't1', kind: 'text', text: l('Took {{fig:p1:orders}}.') }] },
    { id: 's2', heading: l('More'), blocks: [{ id: 'p2', kind: 'panel', title: l(''), definition: view }, { id: 'sum', kind: 'summary' }] },
  ])

  it('lists its blocks and its panels top to bottom, across sections', () => {
    expect(reportBlocks(sample).map((b) => b.id)).toEqual(['p1', 't1', 'p2', 'sum'])
    expect(reportPanels(sample).map((b) => b.id)).toEqual(['p1', 'p2'])
  })

  it('asks for Words only when a text names a figure or a summary block is there', () => {
    expect(wordsAsked(sample)).toBe(true)
    expect(wordsAsked(def([{ id: 's', heading: l(''), blocks: [{ id: 't', kind: 'text', text: l('No figures here.') }] }]))).toBe(false)
    expect(wordsAsked(def([{ id: 's', heading: l(''), blocks: [{ id: 't', kind: 'text', text: { en: 'none', ar: '{{fig:p1:orders}}' } }] }]))).toBe(true)
    expect(wordsAsked(def([{ id: 's', heading: l(''), blocks: [{ id: 'sum', kind: 'summary' }] }]))).toBe(true)
  })

  it('a panel runs through the board panel frame as a view panel that no cross-filter reaches', () => {
    expect(asBoardPanel({ id: 'p1', kind: 'panel', title: l(''), definition: view })).toEqual({ id: 'p1', kind: 'view', viewId: '', layout: { x: 0, y: 0, w: 12, h: 4 }, optOut: ['crossFilter'] })
  })
})

describe('a run’s values (827)', () => {
  const params: Param[] = [
    { name: 'period', kind: 'period', label: l(''), required: true, default: { kind: 'period', token: 'yesterday' } },
    { name: 'city', kind: 'members', label: l(''), required: false, dimension: 'city', default: { kind: 'members', values: [] } },
  ]
  it('holds every parameter’s value — the default where none is chosen — members sorted once each', () => {
    expect(runValues(params, { city: { kind: 'members', values: ['riyadh', 'jeddah', 'riyadh'] }, stray: { kind: 'topN', n: 3 } })).toEqual({
      period: { kind: 'period', token: 'yesterday' },
      city: { kind: 'members', values: ['jeddah', 'riyadh'] },
    })
  })
})

describe('a report’s save checks (829)', () => {
  const model: AnalyticsModel = {
    areas: [{ key: 'sales', available: true }],
    measures: [
      { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: l('Orders'), description: l(''), dimensions: ['day', 'channel_group'] },
      { key: 'rate', area: 'sales', shape: 'rate', unit: 'share', label: l('Rate'), description: l(''), dimensions: ['day', 'channel_group'] },
    ],
    dimensions: [
      { key: 'day', kind: 'time', label: l('Day'), values: [] },
      { key: 'channel_group', kind: 'category', label: l('Channel'), values: [] },
    ],
  }
  const series = [
    { id: 'hs', label: l('HungerStation'), filters: [{ dimension: 'channel_group', values: ['hs'] }] },
    { id: 'qc', label: l('QC'), filters: [{ dimension: 'channel_group', values: ['qc'] }] },
  ]
  const rateByDay: AnalyticsViewDefinition = { chart: { type: 'line' }, query: { measures: ['rate'], dimensions: ['day'], filters: [] } }
  const report = (text: AnalyticsLabel, extra: AnalyticsReportDefinition['sections'][number]['blocks'] = []) =>
    def([
      {
        id: 's1',
        heading: l(''),
        blocks: [
          { id: 'p1', kind: 'panel', title: l(''), definition: view },
          { id: 'p2', kind: 'panel', title: l(''), definition: { ...rateByDay, series } },
          { id: 'p3', kind: 'panel', title: l(''), definition: rateByDay },
          { id: 't1', kind: 'text', text },
          ...extra,
        ],
      },
    ])

  it('a figure naming a panel’s single value passes: a measure, a series’ measure', () => {
    expect(figureProblems(report(l('{{fig:p1:orders}}, {{fig:p2:rate:hs}} and {{fig:p2:rate:qc}}')), model)).toEqual([])
    expect(validateReport(report(l('{{fig:p1:orders}}')), model)).toEqual([])
  })

  it('refuses a figure naming a missing panel, or a value that is not single — in either language', () => {
    const r = report({ en: 'Gone: {{fig:p9:orders}}. Series have no total: {{fig:p2:rate}}.', ar: 'سلسلة غير موجودة {{fig:p2:rate:nope}}' })
    expect(figureProblems(r, model)).toEqual([
      { what: 'figure', block: 't1', panel: 'p9', figure: 'orders', why: 'missingPanel' },
      { what: 'figure', block: 't1', panel: 'p2', figure: 'rate', why: 'notSingle' },
      { what: 'figure', block: 't1', panel: 'p2', figure: 'rate:nope', why: 'notSingle' },
    ])
    expect(validateReport(r, model).map((p) => p.what)).toEqual(['figure', 'figure', 'figure'])
  })

  it('a figure whose panel was removed is refused at save', () => {
    const r = report(l('{{fig:p1:orders}}'))
    const gone = { ...r, sections: [{ ...r.sections[0], blocks: r.sections[0].blocks.filter((b) => b.id !== 'p1') }] }
    expect(figureProblems(gone, model)).toEqual([{ what: 'figure', block: 't1', panel: 'p1', figure: 'orders', why: 'missingPanel' }])
  })

  it('lists a panel’s series problems with the panel, and a second summary', () => {
    const dup = [series[0], { ...series[1], label: l('HungerStation') }]
    const r = report(l(''), [{ id: 'p4', kind: 'panel', title: l(''), definition: { ...rateByDay, series: dup } }, { id: 'sum', kind: 'summary' }, { id: 'sum2', kind: 'summary' }])
    expect(validateReport(r, model)).toEqual([
      { what: 'series', panel: 'p4', why: 'duplicate', series: 'qc' },
      { what: 'summary', why: 'tooMany' },
    ])
  })
})
