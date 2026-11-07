import { describe, expect, it } from 'vitest'
import type { Param } from '@/core/models/analytics'
import { effectiveQuery, panelKey } from './effective-query'
import { notFilteredBy, type ParamValues } from './params'
import { readParamLink, readParamValues, writeParamValues } from './permalink'

// Ticket 823: every parameter kind in the permalink, and the "not filtered by …" set.

const label = { en: '', ar: '' }
const PERIOD: Param = { name: 'period', kind: 'period', label, required: true, default: { kind: 'period', token: 'yesterday' } }
const STORES: Param = { name: 'stores', kind: 'members', label, required: false, dimension: 'store', pinned: null, multi: true, default: { kind: 'members', values: [] } }
const CHANNEL: Param = { name: 'channel-one', kind: 'members', label, required: false, dimension: 'channel_group', pinned: ['app', 'web', 'store'], multi: false, default: { kind: 'members', values: ['app'] } }
const GRAIN: Param = { name: 'grain', kind: 'grain', label, required: true, grains: ['day', 'week'], default: { kind: 'grain', grain: 'day' } }
const CANCEL: Param = { name: 'cancel-above', kind: 'threshold', label, required: false, measure: 'cancellation_rate', default: { kind: 'threshold', op: 'off', value: 5 } }
const TOP: Param = { name: 'top', kind: 'topN', label, required: true, default: { kind: 'topN', n: 10 } }
const FIGURE: Param = { name: 'figure', kind: 'measure', label, required: true, options: ['orders', 'net_value'], default: { kind: 'measure', key: 'orders' } }
const SPLIT: Param = { name: 'split', kind: 'breakdown', label, required: true, options: ['channel_group', 'city'], default: { kind: 'breakdown', key: 'channel_group' } }
const ALL = [PERIOD, STORES, CHANNEL, GRAIN, CANCEL, TOP, FIGURE, SPLIT]

const qs = (s = '') => new URLSearchParams(s)
const roundTrip = (values: ParamValues, declared: Param[] = ALL) => readParamValues(writeParamValues(qs(), declared, values), declared)

describe('permalink: every parameter kind (823)', () => {
  it('every kind survives encode → decode', () => {
    const values: ParamValues = {
      period: { kind: 'period', from: '2026-10-01', to: '2026-10-31' },
      stores: { kind: 'members', values: ['P001', 'P002'] },
      'channel-one': { kind: 'members', values: ['web'] },
      grain: { kind: 'grain', grain: 'week' },
      'cancel-above': { kind: 'threshold', op: 'gt', value: 7.5 },
      top: { kind: 'topN', n: 25 },
      figure: { kind: 'measure', key: 'net_value' },
      split: { kind: 'breakdown', key: 'city' },
    }
    expect(roundTrip(values)).toEqual(values)
  })

  it('writes each kind under its name: repeated members, a threshold as op:value, top N as a number', () => {
    const url = writeParamValues(qs(), ALL, {
      stores: { kind: 'members', values: ['P001', 'P002'] },
      'cancel-above': { kind: 'threshold', op: 'gt', value: 5 },
      top: { kind: 'topN', n: 3 },
      grain: { kind: 'grain', grain: 'week' },
      figure: { kind: 'measure', key: 'net_value' },
      split: { kind: 'breakdown', key: 'city' },
    })
    expect(url.getAll('stores')).toEqual(['P001', 'P002'])
    expect(url.get('cancel-above')).toBe('gt:5')
    expect(url.get('top')).toBe('3')
    expect(url.get('grain')).toBe('week')
    expect(url.get('figure')).toBe('net_value')
    expect(url.get('split')).toBe('city')
  })

  it('a value at its default leaves its key out (the period, as in v1, is always written)', () => {
    const url = writeParamValues(qs('grain=week&top=3'), ALL, {})
    expect(url.toString()).toBe('period=yesterday&channel-one=app')
  })

  it('reads gt:5 as a threshold, and `name=` as cleared', () => {
    expect(readParamValues(qs('cancel-above=gt:5'), ALL)['cancel-above']).toEqual({ kind: 'threshold', op: 'gt', value: 5 })
    expect(readParamValues(qs('cancel-above='), [{ ...CANCEL, default: { kind: 'threshold', op: 'lt', value: 2 } }])['cancel-above']).toMatchObject({ kind: 'threshold', op: 'off' })
    expect(readParamValues(qs('channel-one='), ALL)['channel-one']).toEqual({ kind: 'members', values: [] })
  })

  it('a threshold turned off where its default is on is written `name=`, and reads back off', () => {
    const on: Param = { ...CANCEL, default: { kind: 'threshold', op: 'gte', value: 3 } }
    const url = writeParamValues(qs(), [on], { 'cancel-above': { kind: 'threshold', op: 'off', value: 3 } })
    expect(url.toString()).toBe('cancel-above=')
    expect(readParamValues(url, [on])['cancel-above']).toMatchObject({ op: 'off' })
  })

  it('a required parameter cannot be cleared: `name=` reads its default', () => {
    const required: Param = { ...STORES, required: true, default: { kind: 'members', values: ['P001'] } }
    expect(readParamValues(qs('stores='), [required]).stores).toEqual({ kind: 'members', values: ['P001'] })
  })

  it('a value outside the declared list falls back to the default and is reported', () => {
    const read = readParamLink(qs('channel-one=aggregator&grain=month&figure=till_value&split=store&top=500&cancel-above=gt:abc'), ALL)
    expect(read.values).toMatchObject({
      'channel-one': CHANNEL.default,
      grain: GRAIN.default,
      figure: FIGURE.default,
      split: SPLIT.default,
      top: TOP.default,
      'cancel-above': CANCEL.default,
    })
    expect(read.fellBack).toEqual(['channel-one', 'grain', 'cancel-above', 'top', 'figure', 'split'])
  })

  it('a single-value parameter given one declared member keeps it', () => {
    const read = readParamLink(qs('channel-one=web'), ALL)
    expect(read.values['channel-one']).toEqual({ kind: 'members', values: ['web'] })
    expect(read.fellBack).toEqual([])
  })

  it('a single-value parameter given several members falls back to its default, and says so (story 44)', () => {
    const read = readParamLink(qs('channel-one=web&channel-one=store'), ALL)
    expect(read.values['channel-one']).toEqual({ kind: 'members', values: ['app'] })
    expect(read.fellBack).toEqual(['channel-one'])
  })

  it('a link naming nothing reads every default and reports no fallback', () => {
    const read = readParamLink(qs(), ALL)
    expect(read.fellBack).toEqual([])
    expect(read.values.top).toEqual(TOP.default)
  })

  it('reserved names (tv, refresh, cross, crossFrom) are never read or written as parameters', () => {
    const tv: Param = { ...TOP, name: 'tv' }
    const cross: Param = { ...STORES, name: 'cross' }
    const url = writeParamValues(qs('tv=1&cross=store:P001&crossFrom=p1'), [tv, cross], { tv: { kind: 'topN', n: 7 }, cross: { kind: 'members', values: ['P009'] } })
    expect(url.toString()).toBe('tv=1&cross=store%3AP001&crossFrom=p1')
    expect(readParamValues(qs('tv=1&cross=store:P001'), [tv, cross])).toEqual({ tv: TOP.default, cross: STORES.default })
  })
})

describe('notFilteredBy (823)', () => {
  const notReached = [
    { param: 'stores', reason: 'notInArea' },
    { param: 'grain', reason: 'noTimeAxis' },
    { param: 'top', reason: 'topNShape' },
  ]
  const moved: ParamValues = { stores: { kind: 'members', values: ['P001'] }, top: { kind: 'topN', n: 10 } }

  it('the author sees every parameter that does not reach the panel, in the strip order', () => {
    expect(notFilteredBy(ALL, moved, notReached, 'author').map((p) => p.name)).toEqual(['stores', 'grain', 'top'])
  })

  it('a runner sees only those moved off their defaults', () => {
    expect(notFilteredBy(ALL, moved, notReached, 'runner').map((p) => p.name)).toEqual(['stores'])
  })

  it('members picked in another order are still the default', () => {
    const d: Param = { ...STORES, default: { kind: 'members', values: ['P001', 'P002'] } }
    expect(notFilteredBy([d], { stores: { kind: 'members', values: ['P002', 'P001'] } }, notReached, 'runner')).toEqual([])
  })

  it('a parameter the board does not declare is ignored', () => {
    expect(notFilteredBy(ALL, moved, [{ param: 'ghost', reason: 'notInArea' }], 'author')).toEqual([])
  })
})

describe('effective query: a board that carries its own parameters asks by item (823, spec 819 §C)', () => {
  const MODEL = {
    areas: [],
    measures: [{ key: 'orders', area: 'sales', shape: 'additive' as const, unit: 'count' as const, label, description: label, dimensions: ['store', 'channel_group', 'day'] }],
    dimensions: [],
  }
  const VIEW = { chart: { type: 'bar' as const }, query: { measures: ['orders'], dimensions: ['day'], filters: [], period: 'last-30-days' } }
  const panelOf = (id: string) => ({ id, kind: 'view' as const, viewId: `v-${id}`, layout: { x: 0, y: 0, w: 6, h: 2 }, optOut: [] })
  const BINDINGS = { period: { p1: true, p2: true }, stores: { p1: 'store' }, top: { p2: true } } as const
  const ctx = (values: ParamValues = {}, crossFilter: { source: string; dimension: string; member: string } | null = null) => ({
    params: ALL, bindings: BINDINGS as unknown as Record<string, Record<string, string | true>>, values, crossFilter, item: { id: 'b-1', revision: 4 },
  })
  const ask = (id: string, c: ReturnType<typeof ctx>, drill: { dimension: string; member: string; into: string }[] = []) =>
    effectiveQuery({ panel: panelOf(id), view: VIEW, revision: 2, model: MODEL }, c, drill)

  it('sends the item, its revision, the panel and the values of the parameters bound to that panel', () => {
    expect(ask('p1', ctx({ stores: { kind: 'members', values: ['P002', 'P001'] } }))).toEqual({
      itemId: 'b-1', revision: 4, panelId: 'p1',
      values: { period: { kind: 'period', token: 'yesterday' }, stores: { kind: 'members', values: ['P001', 'P002'] } },
    })
  })

  it('a value change re-keys only the panels the parameter is bound to', () => {
    const before = ctx()
    const after = ctx({ top: { kind: 'topN', n: 3 } })
    expect(panelKey(ask('p1', after))).toBe(panelKey(ask('p1', before)))
    expect(panelKey(ask('p2', after))).not.toBe(panelKey(ask('p2', before)))
    expect(ask('p2', after)).toMatchObject({ values: { top: { kind: 'topN', n: 3 } } })
  })

  it('the cross-filter still reaches the other panels, as before', () => {
    expect(ask('p2', ctx({}, { source: 'p1', dimension: 'store', member: 'P001' }))).toMatchObject({ crossFilter: { dimension: 'store', values: ['P001'] } })
    expect(ask('p1', ctx({}, { source: 'p1', dimension: 'store', member: 'P001' }))).not.toHaveProperty('crossFilter')
  })

  it('a drilled panel asks its drilled definition inline, with the parameters and bindings to apply', () => {
    const drilled = ask('p1', ctx(), [{ dimension: 'day', member: '2026-11-01', into: 'store' }])
    expect(drilled).toMatchObject({ panelId: 'p1', params: ALL, bindings: BINDINGS, values: { period: PERIOD.default, stores: STORES.default } })
    expect(drilled).not.toHaveProperty('itemId')
    expect((drilled as { definition: { query: { dimensions: string[] } } }).definition.query.dimensions[0]).toBe('store')
  })
})
