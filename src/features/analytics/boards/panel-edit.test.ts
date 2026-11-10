import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { blankPanelDefinition, copiedPanel, fitted, panelOffers, sourceChanged, withChoice, withComparing, withDimensions, withMeasures, withSeries, withSettings } from './panel-edit'
import { droppedBy } from './calculations-edit'

const l = (en: string) => ({ en, ar: en })
const model: AnalyticsModel = {
  areas: [
    { key: 'callouts', available: false },
    { key: 'sales', available: true },
  ],
  measures: [
    {
      key: 'callouts',
      area: 'callouts',
      shape: 'additive',
      unit: 'count',
      label: l('Callouts'),
      description: l(''),
      dimensions: ['day'],
    },
    {
      key: 'orders',
      area: 'sales',
      shape: 'additive',
      unit: 'count',
      label: l('Orders'),
      description: l(''),
      dimensions: ['day', 'channel_group', 'city'],
    },
    {
      key: 'rate',
      area: 'sales',
      shape: 'rate',
      unit: 'share',
      label: l('Rate'),
      description: l(''),
      dimensions: ['day', 'channel_group'],
    },
  ],
  dimensions: [
    { key: 'day', kind: 'time', label: l('Day'), values: [] },
    {
      key: 'channel_group',
      kind: 'category',
      label: l('Channel'),
      values: [{ key: 'hs', label: l('HS') }],
    },
    { key: 'city', kind: 'category', label: l('City'), values: [] },
  ],
}
const def = (
  type: AnalyticsViewDefinition['chart']['type'],
  measures: string[],
  dimensions: string[],
  extra: Partial<AnalyticsViewDefinition['query']> = {},
): AnalyticsViewDefinition => ({
  chart: { type },
  query: { measures, dimensions, filters: [], period: 'last-7-days', ...extra },
})

describe('the panel editor’s edits (829)', () => {
  it('a new chart or table is one figure of the first available measure', () => {
    expect(blankPanelDefinition(model)).toEqual({
      chart: { type: 'kpi' },
      query: {
        measures: ['orders'],
        dimensions: [],
        filters: [],
        period: 'last-30-days',
      },
    })
  })

  it('keeps the chosen type while it fits, and re-fits it when it no longer does', () => {
    const line = def('line', ['orders'], ['day'])
    expect(withDimensions(line, ['day', 'channel_group'], model).chart.type).toBe('line')
    // No time axis left: a line no longer fits; the builder's pick takes its place.
    const bars = withDimensions(line, ['channel_group'], model)
    expect(bars.chart.type).not.toBe('line')
    expect(panelOffers(bars, model).find((o) => o.choice === 'line')?.offered).toBe(false)
  })

  it('offers only the fitting types: a type not offered never takes', () => {
    const kpi = def('kpi', ['orders'], [])
    expect(withChoice(kpi, 'line', model)).toBe(kpi)
    expect(withChoice(def('bar', ['orders'], ['day']), 'line', model).chart.type).toBe('line')
  })

  it('new measures drop the breakdowns and filters they no longer allow', () => {
    const d = def('bar', ['orders'], ['city'], {
      filters: [{ dimension: 'city', values: ['riyadh'] }],
    })
    const next = withMeasures(d, ['rate'], model)
    expect(next.query.dimensions).toEqual([])
    expect(next.query.filters).toEqual([])
    expect(next.chart.type).toBe('kpi')
  })

  it('compare and grain stay only where they show', () => {
    const line = def('line', ['orders'], ['day'], {
      compareToPrevious: true,
      grain: 'week',
    })
    expect(fitted(line, model).query).toMatchObject({
      compareToPrevious: true,
      grain: 'week',
    })
    const cats = withDimensions(line, ['channel_group'], model)
    expect(cats.query.compareToPrevious).toBeUndefined()
    expect(cats.query.grain).toBeUndefined()
  })

  it('named series: none leaves no `series`; a donut is re-fitted away when series come', () => {
    const series = [
      {
        id: 's1',
        label: l('HS'),
        filters: [{ dimension: 'channel_group', values: ['hs'] }],
      },
    ]
    const withS = withSeries(def('bar', ['orders'], ['day']), series, model)
    expect(withS.series).toEqual(series)
    expect('series' in withSeries(withS, [], model)).toBe(false)
    const donut = withSeries(def('donut', ['orders'], ['city']), series, model)
    expect(donut.chart.type).not.toBe('donut')
  })
})

describe('copy a saved view (829): provenance', () => {
  const view = {
    id: 'v-825',
    revision: 3,
    title: l('HS against QC'),
    definition: def('bar', ['orders'], ['day']),
  }

  it('copies the definition inline and records the view and the revision copied', () => {
    expect(copiedPanel('p2', view)).toEqual({
      id: 'p2',
      kind: 'panel',
      title: l('HS against QC'),
      definition: view.definition,
      from: { viewId: 'v-825', revision: 3 },
    })
  })

  it('the original changed since the copy: a later revision, or the server says so', () => {
    const block = copiedPanel('p2', view)
    expect(sourceChanged(block, { revision: 3 })).toBe(false)
    expect(sourceChanged(block, { revision: 4 })).toBe(true)
    expect(sourceChanged(block, null)).toBe(false)
    expect(sourceChanged({ ...block, sourceChangedSinceCopy: true }, { revision: 3 })).toBe(true)
    expect(sourceChanged({ id: 'p1', kind: 'panel', title: l(''), definition: view.definition }, { revision: 9 })).toBe(false)
  })
})

describe('panel edits keep calculations to what the query allows (ticket 862)', () => {
  const twoMeasures: AnalyticsViewDefinition = {
    chart: { type: 'bar', orientation: 'vertical' },
    query: {
      measures: ['orders', 'rate'],
      dimensions: ['channel_group'],
      filters: [],
      calculations: [{ key: 'share_orders', kind: 'shareOfTotal', measure: 'orders' }],
    },
  }

  it('removing a measure a calculation uses drops the calculation, and says so', () => {
    const next = withMeasures(twoMeasures, ['rate'], model)
    expect(next.query.calculations).toBeUndefined()
    expect(droppedBy(twoMeasures, next, model).map((d) => [d.calculation.key, d.reason])).toEqual([['share_orders', 'measure']])
  })

  it('counts a calculated column as a rate when it fits the chart', () => {
    const one: AnalyticsViewDefinition = { ...twoMeasures, chart: { type: 'donut' }, query: { ...twoMeasures.query, measures: ['orders'] } }
    expect(panelOffers(one, model).find((o) => o.choice === 'donut')?.offered).toBe(false)
    expect(fitted(one, model).chart.type).not.toBe('donut')
  })

  it('a change goes when the chart no longer compares with the previous period', () => {
    const line: AnalyticsViewDefinition = {
      chart: { type: 'line' },
      query: { measures: ['orders'], dimensions: ['day'], filters: [], compareToPrevious: true, calculations: [{ key: 'change_orders', kind: 'change', measure: 'orders' }] },
    }
    expect(fitted(line, model).query.calculations).toHaveLength(1)
    const table = withChoice(line, 'table', model)
    expect(table.query.calculations).toBeUndefined()
    expect(droppedBy(line, table, model).map((d) => d.reason)).toEqual(['compare'])
    expect(withComparing(line, false, model).query.calculations).toBeUndefined()
  })

  it('a running share keeps the order on its measure when the sort is changed', () => {
    const running: AnalyticsViewDefinition = {
      chart: { type: 'table', sort: { key: 'orders', direction: 'desc' } },
      query: { measures: ['orders'], dimensions: ['city'], filters: [], calculations: [{ key: 'running_orders', kind: 'cumulativeShare', measure: 'orders', until: 80 }] },
    }
    expect(withSettings(running, (c) => ({ ...c, sort: { key: 'orders', direction: 'asc' } }), model).chart.sort).toEqual({ key: 'orders', direction: 'desc' })
  })

  it('leaves a panel without calculations byte-identical', () => {
    const plain: AnalyticsViewDefinition = { chart: { type: 'bar', orientation: 'vertical' }, query: { measures: ['orders'], dimensions: ['channel_group'], filters: [] } }
    expect(JSON.stringify(fitted(plain, model))).toBe(JSON.stringify(plain))
    expect(droppedBy(plain, fitted(plain, model), model)).toEqual([])
  })
})
