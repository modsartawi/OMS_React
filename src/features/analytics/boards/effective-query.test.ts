import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition, BoardFilterKey, BoardFilters } from '@/core/models/analytics'
import { effectiveQuery, panelKey, type ViewPanel } from './effective-query'

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

const ask = (p: ReturnType<typeof panel>, measures: string[], filters: BoardFilters) =>
  effectiveQuery({ panel: p, view: view(measures), revision: 3, model: MODEL }, { filters })

describe('effective query', () => {
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
