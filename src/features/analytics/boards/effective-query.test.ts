import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsReportBlock, AnalyticsReportDefinition, AnalyticsViewDefinition, BoardFilterKey, BoardFilters } from '@/core/models/analytics'
import { effectiveQuery, panelKey, queryKeyOf, type CrossFilter, type ViewPanel } from './effective-query'
import { convertV1Board, defaultsOf, type ParamValues } from './params'

const label = (en: string) => ({ en, ar: en })
const MODEL: AnalyticsModel = {
  areas: [],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders'), description: label(''), dimensions: ['store', 'region', 'city', 'channel_group', 'country', 'day'] },
    // Till sales have no channel breakdown in this model: a channel filter never reaches them.
    { key: 'till_value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Till'), description: label(''), dimensions: ['store', 'region', 'city', 'day'] },
  ],
  dimensions: [],
}

const view = (measures: string[]): AnalyticsViewDefinition => ({
  chart: { type: 'bar' },
  query: { measures, dimensions: ['day'], filters: [], period: 'last-30-days' },
})
const panel = (id: string, optOut: BoardFilterKey[] = []) =>
  ({ id, kind: 'view', viewId: `v-${id}`, layout: { x: 0, y: 0, w: 6, h: 2 }, optOut }) satisfies ViewPanel

const NONE: BoardFilters = { period: { kind: 'relative', token: 'last-30-days' }, city: [], region: [], store: [], channel: [], country: [] }

/** v1's board of one panel, saving `filters`, as 821's parameters at their defaults (797 item 6). */
const v1 = (p: ViewPanel, filters: BoardFilters, crossFilter: CrossFilter | null = null) => {
  const c = convertV1Board({ panels: [p], filters })
  return { ...c, values: defaultsOf(c.params), crossFilter }
}

const ask = (p: ReturnType<typeof panel>, measures: string[], filters: BoardFilters) =>
  effectiveQuery({ panel: p, view: view(measures), revision: 3, model: MODEL }, v1(p, filters))

describe('effective query', () => {
  it('asks for the previous period when the view compares to it (766 §C compareToPrevious), and only then', () => {
    const comparing: AnalyticsViewDefinition = { ...view(['orders']), query: { ...view(['orders']).query, compareToPrevious: true } }
    expect(effectiveQuery({ panel: panel('k'), view: comparing, revision: 3, model: MODEL }, v1(panel('k'), NONE))).toEqual({
      viewId: 'v-k',
      revision: 3,
      period: 'last-30-days',
      filters: [],
      compareToPrevious: true,
    })
    expect(ask(panel('a'), ['orders'], NONE)).not.toHaveProperty('compareToPrevious')
  })

  it('asks for the saved view by id and revision, with the period as a relative token', () => {
    expect(ask(panel('a'), ['orders'], NONE)).toEqual({ viewId: 'v-a', revision: 3, period: 'last-30-days', filters: [] })
  })

  it('same inputs give the same key, whatever order the members were picked in', () => {
    const one = ask(panel('a'), ['orders'], { ...NONE, store: ['P002', 'P001'], region: ['central'] })
    const two = ask(panel('a'), ['orders'], { ...NONE, region: ['central'], store: ['P001', 'P002', 'P001'] })
    expect(panelKey(one)).toBe(panelKey(two))
    expect(one.filters).toEqual([
      { dimension: 'region', values: ['central'] },
      { dimension: 'store', values: ['P001', 'P002'] },
    ])
  })

  it('a filter change re-keys only the panels it reaches', () => {
    const before = { ...NONE }
    const after = { ...NONE, channel: ['app'] }
    const orders = panel('orders')
    const till = panel('till')
    expect(panelKey(ask(orders, ['orders'], after))).not.toBe(panelKey(ask(orders, ['orders'], before)))
    // The channel filter does not reach a measure the model never breaks down by channel.
    expect(panelKey(ask(till, ['till_value'], after))).toBe(panelKey(ask(till, ['till_value'], before)))
    expect(ask(orders, ['orders'], after).filters).toEqual([{ dimension: 'channel_group', values: ['app'] }])
  })

  it('an opted-out panel keeps its key', () => {
    const fixed = panel('fixed', ['region', 'period'])
    const before = ask(fixed, ['orders'], NONE)
    const after = ask(fixed, ['orders'], { ...NONE, region: ['west'], period: { kind: 'relative', token: 'today' } })
    expect(panelKey(after)).toBe(panelKey(before))
    // Opted out of the period, the panel keeps its view's own: no period is sent.
    expect(after).toEqual({ viewId: 'v-fixed', revision: 3, filters: [] })
  })

  it('a fixed range is sent as from..to', () => {
    const q = ask(panel('a'), ['orders'], { ...NONE, period: { kind: 'fixed', from: '2026-10-01', to: '2026-10-31' } })
    expect(q.period).toBe('2026-10-01..2026-10-31')
  })
})

describe('effective query: the cross-filter (772)', () => {
  const store = { source: 'stores', dimension: 'store', member: 'P001' }
  const askX = (p: ReturnType<typeof panel>, measures: string[], crossFilter: typeof store | null) =>
    effectiveQuery({ panel: p, view: view(measures), revision: 3, model: MODEL }, v1(p, NONE, crossFilter))

  it('reaches every panel but its source and the opted-out', () => {
    expect(askX(panel('orders'), ['orders'], store).crossFilter).toEqual({ dimension: 'store', values: ['P001'] })
    expect(askX(panel('till'), ['till_value'], store).crossFilter).toEqual({ dimension: 'store', values: ['P001'] })
    expect(askX(panel('stores'), ['orders'], store)).toEqual({ viewId: 'v-stores', revision: 3, period: 'last-30-days', filters: [] })
    expect(askX(panel('fixed', ['crossFilter']), ['orders'], store)).toEqual({ viewId: 'v-fixed', revision: 3, period: 'last-30-days', filters: [] })
  })

  it('re-keys only the panels it reaches, and clearing it gives back the old keys', () => {
    const source = panel('stores')
    const other = panel('orders')
    const optedOut = panel('fixed', ['crossFilter'])
    const key = (p: ReturnType<typeof panel>, x: typeof store | null) => panelKey(askX(p, ['orders'], x))
    expect(key(source, store)).toBe(key(source, null))
    expect(key(optedOut, store)).toBe(key(optedOut, null))
    expect(key(other, store)).not.toBe(key(other, null))
    // No cross-filter is the same key as before 772 (no `crossFilter` field at all).
    expect(key(other, null)).toBe(panelKey(ask(other, ['orders'], NONE)))
  })

  it('does not reach a panel whose measures never break down by its dimension', () => {
    const channel = { source: 'channels', dimension: 'channel_group', member: 'app' }
    expect(askX(panel('till'), ['till_value'], channel)).toEqual({ viewId: 'v-till', revision: 3, period: 'last-30-days', filters: [] })
  })
})

describe('effective query: drill by (772)', () => {
  const drillAsk = (steps: { dimension: string; member: string; into: string }[], crossFilter: { source: string; dimension: string; member: string } | null = null) =>
    effectiveQuery({ panel: panel('stores'), view: { chart: { type: 'table' }, query: { measures: ['orders'], dimensions: ['store'], filters: [], period: 'last-30-days' } }, revision: 3, model: MODEL }, v1(panel('stores'), { ...NONE, region: ['central'] }, crossFilter), steps)

  it('asks the drilled definition inline: the point a filter, the breakdown the next dimension', () => {
    expect(drillAsk([{ dimension: 'store', member: 'P001', into: 'city' }])).toEqual({
      definition: {
        chart: { type: 'table' },
        query: { measures: ['orders'], dimensions: ['city'], filters: [{ dimension: 'store', values: ['P001'] }], period: 'last-30-days' },
      },
      period: 'last-30-days',
      filters: [{ dimension: 'region', values: ['central'] }],
    })
  })

  it('a second step keeps the first step’s filter', () => {
    const q = drillAsk([
      { dimension: 'store', member: 'P001', into: 'city' },
      { dimension: 'city', member: 'riyadh', into: 'channel_group' },
    ])
    expect('definition' in q && q.definition.query).toEqual({
      measures: ['orders'],
      dimensions: ['channel_group'],
      filters: [
        { dimension: 'store', values: ['P001'] },
        { dimension: 'city', values: ['riyadh'] },
      ],
      period: 'last-30-days',
    })
  })

  it('no steps is the saved view by id (the breadcrumb’s first crumb)', () => {
    expect(drillAsk([])).toEqual({ viewId: 'v-stores', revision: 3, period: 'last-30-days', filters: [{ dimension: 'region', values: ['central'] }] })
  })
})

describe('effective query: named series (825)', () => {
  it('a members parameter never filters a dimension that the series of the panel filter on (seriesFilters)', () => {
    const p = panel('s')
    const named: AnalyticsViewDefinition = {
      ...view(['orders']),
      series: [{ id: 'hs', label: label('HungerStation'), filters: [{ dimension: 'channel_group', values: ['hungerstation'] }] }],
    }
    const input = effectiveQuery({ panel: p, view: named, revision: 3, model: MODEL }, v1(p, { ...NONE, channel: ['app'], city: ['riyadh'] }))
    expect('filters' in input && input.filters).toEqual([{ dimension: 'city', values: ['riyadh'] }])
  })
})

describe('effective query: an unsaved board or report asks by draft (853, BackOffice 3419)', () => {
  const p = { ...panel('p1'), viewId: '', optOut: ['crossFilter' as const] }
  const params = [{ name: 'period', kind: 'period' as const, label: label('Period'), required: true, default: { kind: 'period' as const, token: 'yesterday' as const } }]
  const bindings = { period: { p1: true as const } }
  const block = (id: string, measures: string[]) => ({ id, kind: 'panel' as const, title: label(''), definition: view(measures) })
  const report = (b: typeof bindings | Record<string, never>, extra: AnalyticsReportBlock[] = []): AnalyticsReportDefinition => ({
    params,
    bindings: b,
    sections: [{ id: 's1', heading: label(''), blocks: [block('p1', ['orders']), ...extra] }],
  })
  const askDraft = (draft: AnalyticsReportDefinition, values: ParamValues = {}) =>
    effectiveQuery({ panel: p, view: view(['orders']), revision: 0, model: MODEL }, { params: draft.params, bindings: draft.bindings, values, draft })

  it('a bound period goes as the draft and the panel’s values — no params, no bindings for the server to drop', () => {
    const draft = report(bindings)
    const q = askDraft(draft, { period: { kind: 'period', token: 'last-7-days' } })
    expect(q).toEqual({ draft, panelId: 'p1', values: { period: { kind: 'period', token: 'last-7-days' } } })
    expect(q).not.toHaveProperty('params')
    expect(q).not.toHaveProperty('bindings')
    expect(q).not.toHaveProperty('definition')
  })

  it('an unbound panel still asks by draft, with no values: it runs at its own period', () => {
    const q = askDraft(report({}), { period: { kind: 'period', token: 'last-7-days' } })
    expect(q).toEqual({ draft: report({}), panelId: 'p1', values: {} })
  })

  it('the draft wins over an item: the draft is not the saved revision', () => {
    const draft = report(bindings)
    const q = effectiveQuery({ panel: p, view: view(['orders']), revision: 3, model: MODEL }, { params, bindings, values: {}, draft, item: { id: 'r-1', revision: 3 } })
    expect(q).not.toHaveProperty('itemId')
    expect(q).toHaveProperty('draft', draft)
  })

  it('drill on an unsaved panel keeps the inline definition form: the drilled panel is not on the draft', () => {
    const draft = report(bindings)
    const q = effectiveQuery({ panel: p, view: view(['orders']), revision: 0, model: MODEL }, { params, bindings, values: {}, draft }, [{ dimension: 'day', member: '2026-11-01', into: 'store' }])
    expect(q).not.toHaveProperty('draft')
    expect(q).toMatchObject({ definition: { query: { dimensions: ['store'], filters: [{ dimension: 'day', values: ['2026-11-01'] }] } }, params, bindings, panelId: 'p1' })
  })

  it('the cache key is the panel’s own share of the draft: an unrelated block leaves it, its binding re-keys it', () => {
    const key = (draft: AnalyticsReportDefinition, values: ParamValues = {}) => panelKey(queryKeyOf(askDraft(draft, values), view(['orders'])))
    const base = key(report(bindings))
    expect(key(report(bindings, [{ id: 't1', kind: 'text', text: label('Hello') }, block('p2', ['till_value'])]))).toBe(base)
    expect(key(report(bindings), { period: { kind: 'period', token: 'last-7-days' } })).not.toBe(base)
    expect(key(report({}))).not.toBe(base)
    expect(queryKeyOf(askDraft(report(bindings)), view(['orders']))).toEqual({ draftPanel: { definition: view(['orders']), params, bindings }, panelId: 'p1', values: { period: { kind: 'period', token: 'yesterday' } } })
    // Never the drilled inline form's key: the two never share a cache entry.
    expect(queryKeyOf(askDraft(report(bindings)), view(['orders']))).not.toHaveProperty('definition')
  })
})
