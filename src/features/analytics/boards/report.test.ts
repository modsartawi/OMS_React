import { describe, expect, it } from 'vitest'
import type { AnalyticsReportDefinition, AnalyticsViewDefinition, Param } from '@/core/models/analytics'
import { asBoardPanel, reportBlocks, reportPanels, runValues, wordsAsked } from './report'

const view: AnalyticsViewDefinition = { chart: { type: 'bar' }, query: { measures: ['orders'], dimensions: ['day'], filters: [] } }
const l = (en: string) => ({ en, ar: en })
const def = (sections: AnalyticsReportDefinition['sections']): AnalyticsReportDefinition => ({ params: [], bindings: {}, sections })

describe('a report definition (827)', () => {
  const sample = def([
    { id: 's1', heading: l('Sales'), blocks: [{ id: 'p1', kind: 'panel', title: l(''), definition: view }, { id: 't1', kind: 'text', text: l('Took {p1:total}.') }] },
    { id: 's2', heading: l('More'), blocks: [{ id: 'p2', kind: 'panel', title: l(''), definition: view }, { id: 'sum', kind: 'summary' }] },
  ])

  it('lists its blocks and its panels top to bottom, across sections', () => {
    expect(reportBlocks(sample).map((b) => b.id)).toEqual(['p1', 't1', 'p2', 'sum'])
    expect(reportPanels(sample).map((b) => b.id)).toEqual(['p1', 'p2'])
  })

  it('asks for Words only when a text names a figure or a summary block is there', () => {
    expect(wordsAsked(sample)).toBe(true)
    expect(wordsAsked(def([{ id: 's', heading: l(''), blocks: [{ id: 't', kind: 'text', text: l('No figures here.') }] }]))).toBe(false)
    expect(wordsAsked(def([{ id: 's', heading: l(''), blocks: [{ id: 't', kind: 'text', text: { en: 'none', ar: '{p1:total}' } }] }]))).toBe(true)
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
