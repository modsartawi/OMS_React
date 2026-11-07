import { describe, expect, it } from 'vitest'
import type { AnalyticsBoardDefinition, Param } from '@/core/models/analytics'
import { effectiveQuery, panelKey, type ViewPanel } from './effective-query'
import { boardParams, convertV1Board, defaultsOf, v1Of } from './params'
import { readCrossFilter, readParamValues, writeParamValues } from './permalink'
import { V1_BOARDS, V1_MODEL, V1_PERMALINKS, V1_VIEWS } from './v1-boards.fixture'
import V1_KEYS from './v1-permalink-keys.json'

/** v1's implicit rule, second half: some measure of the panel's view breaks down by the dimension. */
const reaches = (p: ViewPanel, dimension: string) =>
  (V1_VIEWS[p.viewId]?.query.measures ?? []).some((m) => V1_MODEL.measures.find((x) => x.key === m)?.dimensions.includes(dimension))

const members = (name: string, dimension: string, values: string[] = []): Param => ({
  name, kind: 'members', label: { en: '', ar: '' }, required: false, dimension, pinned: null, multi: true, default: { kind: 'members', values },
})

describe('convertV1Board (797 item 6)', () => {
  it("makes the saved filters the six defaults, and v1's implicit rule minus optOut the bindings", () => {
    const { params, bindings } = convertV1Board(V1_BOARDS['b-saved'], reaches)
    expect(params.map((p) => [p.name, p.kind, p.dimension ?? null, p.default])).toEqual([
      ['period', 'period', null, { kind: 'period', token: 'this-week' }],
      ['city', 'members', 'city', { kind: 'members', values: [] }],
      ['region', 'members', 'region', { kind: 'members', values: ['central'] }],
      ['store', 'members', 'store', { kind: 'members', values: [] }],
      ['channel', 'members', 'channel_group', { kind: 'members', values: ['app'] }],
      ['country', 'members', 'country', { kind: 'members', values: [] }],
    ])
    expect(params.find((p) => p.name === 'period')?.required).toBe(true)
    expect(bindings).toEqual({
      period: { 'p-till': true, 'p-bar': true },
      city: { 'p-till': 'city', 'p-bar': 'city' },
      region: { 'p-till': 'region' },
      store: { 'p-till': 'store', 'p-deliveries': 'store', 'p-bar': 'store' },
      channel: { 'p-deliveries': 'channel_group', 'p-bar': 'channel_group' },
      country: { 'p-bar': 'country' },
    })
  })

  it('a board with no saved filters opens on the last 30 days and all members; a fully opted-out panel is bound to nothing', () => {
    const { params, bindings } = convertV1Board(V1_BOARDS['b-ops'], reaches)
    expect(params[0].default).toEqual({ kind: 'period', token: 'last-30-days' })
    expect(params.slice(1).every((p) => p.default.kind === 'members' && p.default.values.length === 0)).toBe(true)
    expect(Object.values(bindings).some((b) => 'p-donut' in b)).toBe(false)
    expect(bindings.store).toEqual({ 'p-bar': 'store', 'p-kpi': 'store', 'p-line': 'store' })
    expect(bindings.period).toEqual({ 'p-area': true, 'p-bar': true, 'p-kpi': true, 'p-line': true })
  })

  it('a fixed range survives as a fixed-range default', () => {
    const def: AnalyticsBoardDefinition = { panels: [], filters: { period: { kind: 'fixed', from: '2026-10-01', to: '2026-10-31' } } }
    expect(convertV1Board(def).params[0].default).toEqual({ kind: 'period', from: '2026-10-01', to: '2026-10-31' })
  })

  it('a board that carries params and bindings is used as it is', () => {
    const params = [members('zone', 'region', ['central'])]
    const def: AnalyticsBoardDefinition = { panels: V1_BOARDS['b-ops'].panels, filters: { region: ['western'] }, params, bindings: { zone: { 'p-bar': 'region' } } }
    expect(boardParams(def)).toEqual({ params, bindings: { zone: { 'p-bar': 'region' } } })
  })
})

describe('the board editor seam', () => {
  it('reads a converted board back as the same v1 filters and opt-outs', () => {
    const def = V1_BOARDS['b-saved']
    const { params, bindings } = convertV1Board(def)
    const back = v1Of({ panels: def.panels, params, bindings })
    expect(back.filters).toEqual({ period: { kind: 'relative', token: 'this-week' }, city: [], region: ['central'], store: [], channel: ['app'], country: [] })
    expect(back.panels.map((p) => (p.kind === 'view' ? [p.id, p.optOut] : p.id))).toEqual([
      ['p-till', []],
      ['p-deliveries', ['period', 'crossFilter']],
      ['p-bar', ['region']],
    ])
  })

  it('the v1 fields a v2 board saves: a deleted ready-made parameter reaches no panel, and the order stays the author\u2019s', () => {
    const { params, bindings } = convertV1Board(V1_BOARDS['b-777'])
    const zone = members('zone', 'region')
    const kept = [zone, ...params.filter((p) => p.name !== 'store')]
    const back = v1Of({ panels: V1_BOARDS['b-777'].panels, params: kept, bindings: { ...bindings, zone: { 'p-bar': 'region' } } })
    expect(back.panels.map((p) => (p.kind === 'view' ? [p.id, p.optOut] : p.id))).toEqual(['p-head', ['p-bar', ['store']], ['p-gone', ['store']]])
    expect(kept.map((p) => p.name)).toEqual(['zone', 'period', 'city', 'region', 'channel', 'country'])
  })
})

describe('permalink parity (v1 permalinks decode to the same effective query keys as before 821)', () => {
  const keysOf = (def: AnalyticsBoardDefinition, link: string) => {
    const qs = new URLSearchParams(link)
    const { params, bindings } = boardParams(def)
    const ctx = { params, bindings, values: readParamValues(qs, params), crossFilter: readCrossFilter(qs) }
    const keys: Record<string, string> = {}
    for (const p of def.panels) {
      if (p.kind === 'view' && V1_VIEWS[p.viewId]) keys[p.id] = panelKey(effectiveQuery({ panel: p, view: V1_VIEWS[p.viewId], revision: 3, model: V1_MODEL }, ctx))
    }
    return keys
  }

  for (const [id, def] of Object.entries(V1_BOARDS)) {
    it(`${id}: every v1 permalink`, () => {
      for (const link of V1_PERMALINKS) expect([link, keysOf(def, link)]).toEqual([link, (V1_KEYS as Record<string, Record<string, string>>)[`${id}?${link}`]])
    })
  }

  it('converting with or without the views gives the same keys (the query drops what the measures cannot take)', () => {
    for (const link of V1_PERMALINKS) {
      const qs = new URLSearchParams(link)
      const def = V1_BOARDS['b-saved']
      const run = (c: ReturnType<typeof convertV1Board>) =>
        def.panels.map((p) => p.kind === 'view' && panelKey(effectiveQuery({ panel: p, view: V1_VIEWS[p.viewId], revision: 3, model: V1_MODEL }, { ...c, values: readParamValues(qs, c.params), crossFilter: readCrossFilter(qs) })))
      expect(run(convertV1Board(def, reaches))).toEqual(run(convertV1Board(def)))
    }
  })

  it('writes the six keys exactly as v1 did', () => {
    const { params } = convertV1Board(V1_BOARDS['b-saved'])
    const values = { ...defaultsOf(params), region: { kind: 'members' as const, values: [] }, store: { kind: 'members' as const, values: ['P001', 'P002'] }, period: { kind: 'period' as const, from: '2026-10-01', to: '2026-10-31' } }
    expect(writeParamValues(new URLSearchParams('tv=1&cross=store:P1&crossFrom=p'), params, values).toString()).toBe(
      'tv=1&cross=store%3AP1&crossFrom=p&period=2026-10-01..2026-10-31&region=&store=P001&store=P002&channel=app',
    )
  })

  it('reads a parameter by its own name, beyond the six', () => {
    const zone = members('zone', 'region', ['central'])
    expect(readParamValues(new URLSearchParams('zone=west&zone=east&zone=west'), [zone])).toEqual({ zone: { kind: 'members', values: ['west', 'east'] } })
    expect(readParamValues(new URLSearchParams('zone='), [zone])).toEqual({ zone: { kind: 'members', values: [] } })
    expect(readParamValues(new URLSearchParams(''), [zone])).toEqual({ zone: { kind: 'members', values: ['central'] } })
  })
})

describe('effectiveQuery with bindings', () => {
  const panels = V1_BOARDS['b-ops'].panels.filter((p): p is ViewPanel => p.kind === 'view')
  const zone = members('zone', 'region')
  const params: Param[] = [zone]
  // Bound to the bar and the line only — and on the line it filters city, not region (a per-panel target).
  const bindings = { zone: { 'p-bar': 'region', 'p-line': 'city' } as Record<string, string | true> }
  const keys = (values: string[]) =>
    Object.fromEntries(panels.map((p) => [p.id, panelKey(effectiveQuery({ panel: p, view: V1_VIEWS[p.viewId], revision: 3, model: V1_MODEL }, { params, bindings, values: { zone: { kind: 'members', values } } }))]))

  it('a value change alters the key only for the panels bound to that parameter', () => {
    const before = keys([])
    const after = keys(['central'])
    expect(Object.keys(before).filter((id) => before[id] !== after[id]).sort()).toEqual(['p-bar', 'p-line'])
  })

  it('a members binding filters the dimension it names on that panel', () => {
    const q = (id: string) => effectiveQuery({ panel: panels.find((p) => p.id === id)!, view: V1_VIEWS[panels.find((p) => p.id === id)!.viewId], revision: 3, model: V1_MODEL }, { params, bindings, values: { zone: { kind: 'members', values: ['riyadh'] } } })
    expect(q('p-line').filters).toEqual([{ dimension: 'city', values: ['riyadh'] }])
    expect(q('p-bar').filters).toEqual([{ dimension: 'region', values: ['riyadh'] }])
    expect(q('p-kpi').filters).toEqual([])
  })

  it('an unbound period leaves the view its own; a bound one overrides it with the value', () => {
    const period: Param = { name: 'when', kind: 'period', label: { en: '', ar: '' }, required: true, default: { kind: 'period', token: 'yesterday' } }
    const ask = (id: string) => effectiveQuery({ panel: panels.find((p) => p.id === id)!, view: V1_VIEWS['v-bar'], revision: 3, model: V1_MODEL }, { params: [period], bindings: { when: { 'p-bar': true } }, values: {} })
    expect(ask('p-bar').period).toBe('yesterday')
    expect('period' in ask('p-kpi')).toBe(false)
  })
})
