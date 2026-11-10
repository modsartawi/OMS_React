import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { toComboView, toDonutView, toHeatmapView, toTableView } from './view-model-forms'

const label = (en: string, ar: string) => ({ en, ar })

const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders', 'الطلبات'), description: label('', ''), dimensions: ['channel_group', 'store', 'weekday', 'hour'] },
    { key: 'on_time', area: 'sales', shape: 'rate', unit: 'share', label: label('On time', 'في الوقت'), description: label('', ''), dimensions: ['channel_group'] },
    { key: 'p90_minutes', area: 'sales', shape: 'percentile', unit: 'minutes', label: label('P90 minutes', 'الدقائق'), description: label('', ''), dimensions: ['channel_group'] },
  ],
  dimensions: [
    {
      key: 'channel_group',
      kind: 'category',
      label: label('Channel', 'القناة'),
      values: [
        { key: 'app', label: label('App', 'التطبيق') },
        { key: 'web', label: label('Web', 'الموقع') },
        { key: 'callcenter', label: label('Call center', 'مركز الاتصال') },
        { key: 'aggregator', label: label('Aggregators', 'المجمّعات') },
        { key: 'store', label: label('In store', 'في الفرع') },
      ],
    },
    { key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] },
    { key: 'weekday', kind: 'category', label: label('Weekday', 'اليوم'), values: [] },
    { key: 'hour', kind: 'category', label: label('Hour', 'الساعة'), values: [] },
  ],
}

const def = (type: AnalyticsViewDefinition['chart']['type'], measures: string[], dimensions: string[], slots?: AnalyticsViewDefinition['slots']): AnalyticsViewDefinition => ({
  chart: { type },
  query: { measures, dimensions, filters: [] },
  slots,
})

const result = (columns: AnalyticsQueryResult['columns'], rows: AnalyticsQueryResult['rows']): AnalyticsQueryResult => ({
  columns,
  rows,
  total: rows.length,
  truncated: false,
  period: null,
  previous: [],
  fetchedAt: '',
  dataAsOf: '',
})

const oneDim = (dimension: string, measure: string, rows: [string, number][], shape: 'additive' | 'rate' | 'percentile' = 'additive') =>
  result(
    [{ key: dimension, role: 'dimension' }, { key: measure, role: 'measure', shape }],
    rows.map(([m, v]) => ({ [dimension]: m, [measure]: v })),
  )

describe('view model: the donut', () => {
  it('refuses a rate or a percentile measure', () => {
    const rate = toDonutView(oneDim('channel_group', 'on_time', [['app', 0.9], ['web', 0.8]], 'rate'), def('donut', ['on_time'], ['channel_group']), MODEL, 'en')
    expect(rate.kind).toBe('refused')
    const p90 = toDonutView(oneDim('channel_group', 'p90_minutes', [['app', 31]], 'percentile'), def('donut', ['p90_minutes'], ['channel_group']), MODEL, 'en')
    expect(p90.kind).toBe('refused')
    // The model's shape is enough even when the column omits it.
    const bare = toDonutView(result([{ key: 'channel_group', role: 'dimension' }, { key: 'on_time', role: 'measure' }], [{ channel_group: 'app', on_time: 0.9 }]), def('donut', ['on_time'], ['channel_group']), MODEL, 'en')
    expect(bare.kind).toBe('refused')
  })

  it('draws an additive measure, each slice in its entity colour, largest first', () => {
    const view = toDonutView(oneDim('channel_group', 'orders', [['web', 18], ['aggregator', 42], ['app', 31]]), def('donut', ['orders'], ['channel_group']), MODEL, 'en')
    if (view.kind !== 'donut') throw new Error(view.kind)
    expect(view.slices.map((s) => [s.member, s.label, s.value, s.slot])).toEqual([
      ['aggregator', 'Aggregators', 42, 3],
      ['app', 'App', 31, 0],
      ['web', 'Web', 18, 1],
    ])
    expect(view.other).toBeNull()
    expect(view.total).toBe(91)
  })

  it('folds every slice past the sixth — and any slice the palette has no colour for — into "Other"', () => {
    // Nine stores, no saved map: the five largest take the five colour slots; the palette has no sixth
    // hue (766 §E amendment 2), so the sixth largest folds with the rest.
    const rows: [string, number][] = [['S1', 90], ['S2', 80], ['S3', 70], ['S4', 60], ['S5', 50], ['S6', 40], ['S7', 30], ['S8', 20], ['S9', 10]]
    const view = toDonutView(oneDim('store', 'orders', rows), def('donut', ['orders'], ['store']), MODEL, 'en')
    if (view.kind !== 'donut') throw new Error(view.kind)
    expect(view.slices.map((s) => s.member)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
    expect(view.slices.map((s) => s.slot)).toEqual([0, 1, 2, 3, 4])
    expect(view.other).toEqual({ value: 100, count: 4 })
    expect(view.total).toBe(450)

    // A saved map reserving two slots for stores not in today's answer leaves three hues free.
    const saved = toDonutView(oneDim('store', 'orders', rows), def('donut', ['orders'], ['store'], { store: { S2: 0, X: 1, Y: 2 } }), MODEL, 'en')
    if (saved.kind !== 'donut') throw new Error(saved.kind)
    expect(saved.slices.map((s) => [s.member, s.slot])).toEqual([['S1', 3], ['S2', 0], ['S3', 4]])
    expect(saved.other).toEqual({ value: 210, count: 6 })
  })

  it('drops a zero or negative value: a donut slice is a share of a whole', () => {
    const view = toDonutView(oneDim('channel_group', 'orders', [['app', 5], ['web', 0], ['store', -2]]), def('donut', ['orders'], ['channel_group']), MODEL, 'en')
    if (view.kind !== 'donut') throw new Error(view.kind)
    expect(view.slices.map((s) => s.member)).toEqual(['app'])
    expect(view.total).toBe(5)
  })
})

describe('view model: the heatmap', () => {
  const grid = (cells: [string, string, number | null][]) =>
    result(
      [{ key: 'weekday', role: 'dimension' }, { key: 'hour', role: 'dimension' }, { key: 'orders', role: 'measure', shape: 'additive', unit: 'count' }],
      cells.map(([weekday, hour, orders]) => ({ weekday, hour, orders })),
    )

  it("the sequential scale maps min→lightest and max→darkest on one hue", () => {
    const view = toHeatmapView(
      grid([['Sun', '09', 10], ['Sun', '10', 60], ['Mon', '09', 35], ['Mon', '10', 110]]),
      def('heatmap', ['orders'], ['weekday', 'hour']),
      MODEL,
      'en',
    )
    expect(view.xs.map((x) => x.member)).toEqual(['Sun', 'Mon'])
    expect(view.ys.map((y) => y.member)).toEqual(['09', '10'])
    expect(view.min).toBe(10)
    expect(view.max).toBe(110)
    const at = (x: string, y: string) => view.cells.find((c) => c.x === x && c.y === y)!
    // min → the faintest tint of the hue over the card; max → the hue itself; between, in proportion.
    expect(at('Sun', '09').fill).toBe('color-mix(in oklab, var(--chart-1) 12%, var(--card))')
    expect(at('Mon', '10').fill).toBe('color-mix(in oklab, var(--chart-1) 100%, var(--card))')
    expect(at('Sun', '10').fill).toBe('color-mix(in oklab, var(--chart-1) 56%, var(--card))') // 50 of 100 → 12 + 44
    expect(at('Mon', '09').fill).toBe('color-mix(in oklab, var(--chart-1) 34%, var(--card))') // 25 of 100 → 12 + 22
    // One hue: every painted cell mixes the same token, only the amount changes.
    expect(new Set(view.cells.map((c) => c.fill?.replace(/ \d+%/, '')))).toEqual(new Set(['color-mix(in oklab, var(--chart-1), var(--card))']))
  })

  it('a missing or empty cell is unpainted, and labels come from the model', () => {
    const view = toHeatmapView(grid([['Sun', '09', 4], ['Mon', '10', null]]), def('heatmap', ['orders'], ['weekday', 'hour']), MODEL, 'en')
    expect(view.cells.length).toBe(4)
    expect(view.cells.filter((c) => c.fill === null).map((c) => `${c.x}/${c.y}`)).toEqual(['Sun/10', 'Mon/09', 'Mon/10'])
    expect(view.measure.label).toBe('Orders')
    expect([view.x.label, view.y.label]).toEqual(['Weekday', 'Hour'])
  })
})

describe('view model: the table and the combo', () => {
  it('a table sorts (by default the first measure, largest first), keeps the top N and scales each bar to its column', () => {
    const rows = result(
      [{ key: 'store', role: 'dimension' }, { key: 'orders', role: 'measure', unit: 'count' }, { key: 'on_time', role: 'measure', shape: 'rate', unit: 'share' }],
      [
        { store: 'P1', orders: 20, on_time: 0.5 },
        { store: 'P2', orders: 80, on_time: 0.9 },
        { store: 'P3', orders: 40, on_time: 0.7 },
      ],
    )
    const d = def('table', ['orders', 'on_time'], ['store'])
    const view = toTableView(rows, d, MODEL, 'en')
    expect(view.rows.map((r) => r.store)).toEqual(['P2', 'P3', 'P1'])
    expect(view.columns.map((c) => [c.key, c.role, c.label])).toEqual([
      ['store', 'dimension', 'Store'],
      ['orders', 'measure', 'Orders'],
      ['on_time', 'measure', 'On time'],
    ])
    expect(view.columns.find((c) => c.key === 'orders')?.max).toBe(80)

    const top = toTableView(rows, { ...d, chart: { type: 'table', sort: { key: 'on_time', direction: 'asc' }, topN: 2 } }, MODEL, 'en')
    expect(top.rows.map((r) => r.store)).toEqual(['P1', 'P3'])
    expect(top.cut).toBe(true)
    // 772: each row's first-dimension MEMBER (not its label), so a row click cross-filters on the key.
    expect(top.members).toEqual(['P1', 'P3'])
  })

  it('a combo pairs the volume measure (bars) with the rate measure (line) on one category axis', () => {
    const rows = result(
      [{ key: 'channel_group', role: 'dimension' }, { key: 'on_time', role: 'measure', shape: 'rate', unit: 'share' }, { key: 'orders', role: 'measure', unit: 'count' }],
      [
        { channel_group: 'web', orders: 18, on_time: 0.8 },
        { channel_group: 'app', orders: 31, on_time: 0.92 },
      ],
    )
    // The order the measures are named in does not matter: the additive one is the volume.
    const view = toComboView(rows, def('combo', ['on_time', 'orders'], ['channel_group']), MODEL, 'en')
    expect(view.volume.key).toBe('orders')
    expect(view.rate.key).toBe('on_time')
    expect(view.points).toEqual([
      { member: 'web', label: 'Web', volume: 18, rate: 0.8 },
      { member: 'app', label: 'App', volume: 31, rate: 0.92 },
    ])
  })
})

// 861 (spec 3519): a calculated share is a rate measure, so a combo draws it as the line beside the volume bars.
describe('view model: calculated columns in the charts', () => {
  const calcs = [{ key: 'ordersShare', kind: 'shareOfTotal' as const, measure: 'orders' }]
  const withShare = (type: AnalyticsViewDefinition['chart']['type']): AnalyticsViewDefinition => {
    const d = def(type, ['orders'], ['channel_group'])
    return { ...d, query: { ...d.query, calculations: calcs } }
  }
  const rows = result(
    [
      { key: 'channel_group', role: 'dimension' },
      { key: 'orders', role: 'measure', shape: 'additive', unit: 'count' },
      { key: 'ordersShare', role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind: 'shareOfTotal', measure: 'orders' } },
    ],
    [
      { channel_group: 'app', orders: 31, ordersShare: 63.2653 },
      { channel_group: 'web', orders: 18, ordersShare: 36.7347 },
    ],
  )

  it('a combo of an additive bar and a share line draws both', () => {
    const view = toComboView(rows, withShare('combo'), MODEL, 'en')
    expect(view.volume.key).toBe('orders')
    expect(view.rate).toMatchObject({ key: 'ordersShare', unit: 'percent', shape: 'rate' })
    expect(view.points).toEqual([
      { member: 'app', label: 'App', volume: 31, rate: 63.2653 },
      { member: 'web', label: 'Web', volume: 18, rate: 36.7347 },
    ])
  })

  it('the table form shows the calculated column after the measures', () => {
    const view = toTableView(rows, withShare('table'), MODEL, 'en')
    expect(view.columns.map((c) => c.key)).toEqual(['channel_group', 'orders', 'ordersShare'])
  })
})
