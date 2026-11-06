import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition, Param } from '@/core/models/analytics'
import CASES from './bind-cases.json'
import { type Declarations, addParam, bind, bindPanel, blankParam, canBind, changeParam, defaultFits, overview, prefill, removeParam, validate } from './bindings'

const model = CASES.model as unknown as AnalyticsModel
const panels = CASES.panels as unknown as Record<string, AnalyticsViewDefinition>
const params = CASES.params as unknown as Record<string, Param>

describe('canBind over the shared case table (797 §5, 799 §2)', () => {
  for (const [param, panel, target, expected] of CASES.cases as [string, string, string | null, string][]) {
    it(`${param} on ${panel}${target ? ` → ${target}` : ''}: ${expected}`, () => {
      const c = canBind(params[param], panels[panel], model, target ?? undefined)
      const said = c.ok ? (c.target ? `ok:${c.target}` : 'ok') : c.reason
      expect(said).toBe(expected)
    })
  }
})

const on = (...ids: string[]) => ids.map((id) => ({ id, definition: panels[id] }))

describe('prefill (797 §4): a new parameter binds every panel that can take it', () => {
  it('a members parameter binds where its dimension reaches, to that dimension', () => {
    expect(prefill(params.channel, [...on('kpi', 'bar', 'till', 'series'), { id: 'loading', definition: null }], model)).toEqual({ kpi: 'channel_group', bar: 'channel_group' })
  })
  it('the period binds every panel whose view is known', () => {
    expect(prefill(params.period, [...on('kpi', 'till'), { id: 'loading', definition: null }], model)).toEqual({ kpi: true, till: true })
  })
})

describe('validate: every ANALYTICS-411 shape a board declares', () => {
  const named = (name: string, from: Param = params.channel): Param => ({ ...from, name })
  it('a reserved, a non-slug and a duplicate name', () => {
    const list = [named('tv'), named('Bad name'), named('city'), named('city'), named('crossFrom')]
    expect(validate(list, {}, [], model)).toEqual([
      { what: 'name', param: 'tv', why: 'reserved' },
      { what: 'name', param: 'Bad name', why: 'slug' },
      { what: 'name', param: 'city', why: 'duplicate' },
      { what: 'name', param: 'crossFrom', why: 'reserved' },
    ])
  })
  it('a binding that does not fit names the parameter, the panel and why; a pointed one that fits passes', () => {
    const bindings = { channel: { bar: 'channel_group', till: 'channel_group', series: 'city', gone: 'channel_group', loading: 'channel_group' }, grain: { kpi: true as const } }
    expect(validate([params.channel, params.grain], bindings, [...on('bar', 'till', 'series', 'kpi'), { id: 'loading', definition: null }], model)).toEqual([
      { what: 'binding', param: 'channel', panel: 'till', reason: 'notInArea' },
      { what: 'binding', param: 'grain', panel: 'kpi', reason: 'noTimeAxis' },
    ])
  })
  it('a default the parameter itself refuses', () => {
    const bad: Param[] = [
      { ...params.top, default: { kind: 'topN', n: 0 } },
      { ...params.grain, grains: ['day', 'week'], default: { kind: 'grain', grain: 'month' } },
      { ...params.figure, default: { kind: 'measure', key: 'till' } },
      { ...params.channel, pinned: ['hungerstation'], default: { kind: 'members', values: ['jahez'] } },
      { ...params.cancel, required: true },
      { ...params.period, default: { kind: 'topN', n: 3 } },
    ]
    expect(validate(bad, {}, [], model).map((p) => p.what === 'default' && p.param)).toEqual(['top', 'grain', 'figure', 'channel', 'cancel', 'period'])
  })
  it('a board of fitting declarations has no problem', () => {
    const list = [params.period, params.channel, params.top]
    expect(validate(list, { period: { bar: true as const, till: true as const }, channel: { bar: 'channel_group', till: 'store' }, top: { bar: true as const } }, on('bar', 'till'), model)).toEqual([])
  })
})

describe('declaring: a new parameter, a rename, a re-pointed kind, a removal, a new panel', () => {
  const board = on('kpi', 'line', 'bar', 'till')
  const start: Declarations = { params: [params.period], bindings: { period: { kpi: true, line: true, bar: true, till: true } } }

  it('a blank parameter of each kind takes a free name and a default it accepts', () => {
    const taken = ['period', 'members']
    const made = (['period', 'members', 'grain', 'threshold', 'topN', 'measure', 'breakdown'] as const).map((k) => blankParam(k, taken, model))
    expect(made.map((p) => p.name)).toEqual(['period-2', 'members-2', 'grain', 'threshold', 'top', 'figure', 'split'])
    expect(made.every((p) => defaultFits(p))).toBe(true)
    expect(made[1]).toMatchObject({ kind: 'members', dimension: 'channel_group', pinned: null, multi: true, default: { kind: 'members', values: [] } })
    expect(made[3]).toMatchObject({ measure: 'cancel_rate', default: { kind: 'threshold', op: 'off' } })
  })

  it('adding binds it to every panel that can take it', () => {
    const next = addParam(start, params.grain, board, model)
    expect(next.params.map((p) => p.name)).toEqual(['period', 'grain'])
    expect(next.bindings.grain).toEqual({ line: true })
  })

  it('a rename carries its bindings; a new dimension pre-fills again; an unchanged kind keeps the author’s unbinding', () => {
    const added = addParam(start, params.channel, board, model)
    const unbound = bind(added, 'channel', 'bar', null)
    expect(unbound.bindings.channel).toEqual({ kpi: 'channel_group', line: 'channel_group' })
    const renamed = changeParam(unbound, 'channel', { ...params.channel, name: 'chan', label: { en: 'Channel', ar: 'القناة' } }, board, model)
    expect(renamed.bindings).toEqual({ period: start.bindings.period, chan: { kpi: 'channel_group', line: 'channel_group' } })
    const store = changeParam(renamed, 'chan', { ...params.channel, name: 'chan', dimension: 'store' }, board, model)
    expect(store.bindings.chan).toEqual({ kpi: 'store', line: 'store', bar: 'store', till: 'store' })
    const kind = changeParam(store, 'chan', { ...params.grain, name: 'chan' }, board, model)
    expect(kind.bindings.chan).toEqual({ line: true })
  })

  it('removing a parameter, a ready-made one too, drops it and its bindings, and keeps the others in order', () => {
    const two = addParam(start, params.grain, board, model)
    expect(removeParam(two, 'period')).toEqual({ params: [params.grain], bindings: { grain: { line: true } } })
  })

  it('a panel added to the board binds every parameter that can take it', () => {
    const decl = addParam(addParam(start, params.grain, board, model), params.channel, board, model)
    const next = bindPanel(decl, { id: 'rate', definition: panels.rate }, model)
    expect([next.bindings.period.rate, next.bindings.grain.rate, next.bindings.channel.rate]).toEqual([true, undefined, 'channel_group'])
  })

  it('the overview: each parameter against each panel — bound, unbound, can’t and why, or bound but broken', () => {
    const decl: Declarations = { params: [params.channel], bindings: { channel: { kpi: 'channel_group', till: 'channel_group' } } }
    expect(overview(decl, [...on('kpi', 'bar', 'till', 'series'), { id: 'loading', definition: null }], model)).toEqual([
      {
        param: 'channel',
        cells: [
          { panel: 'kpi', state: 'bound', target: 'channel_group' },
          { panel: 'bar', state: 'unbound' },
          { panel: 'till', state: 'broken', reason: 'notInArea' },
          { panel: 'series', state: 'cannot', reason: 'seriesFilters' },
          { panel: 'loading', state: 'unbound' },
        ],
      },
    ])
  })
})
