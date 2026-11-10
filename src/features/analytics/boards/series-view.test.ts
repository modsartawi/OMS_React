import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { toKpiView, toKpiViews, toSeriesView, unitPanes, type SeriesView } from './series-view'

const label = (en: string, ar: string) => ({ en, ar })

const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    {
      key: 'orders',
      area: 'sales',
      shape: 'additive',
      unit: 'count',
      label: label('Orders', 'الطلبات'),
      description: label('Orders placed', 'الطلبات المقدمة'),
      dimensions: ['store', 'day', 'channel_group'],
    },
    {
      key: 'on_time_share',
      area: 'sales',
      shape: 'rate',
      unit: 'share',
      label: label('On-time share', 'نسبة الالتزام بالوقت'),
      description: label('Deliveries on time', 'التوصيلات في الوقت'),
      dimensions: ['store', 'day', 'channel_group'],
    },
  ],
  dimensions: [
    { key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
    {
      key: 'channel_group',
      kind: 'category',
      label: label('Channel', 'القناة'),
      values: [
        { key: 'app', label: label('App', 'التطبيق') },
        { key: 'web', label: label('Web', 'الموقع') },
      ],
    },
  ],
}

const answer = (rows: AnalyticsRow[], previous: AnalyticsRow[] = []): AnalyticsQueryResult => ({
  columns: [],
  rows,
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-07', to: '2026-11-05' },
  previous,
  fetchedAt: '2026-11-05T10:00:00',
  dataAsOf: '2026-11-05T09:45:00',
})

const kpi = (measure = 'orders', dimensions: string[] = []): AnalyticsViewDefinition => ({
  chart: { type: 'kpi' },
  query: { measures: [measure], dimensions, filters: [], compareToPrevious: true },
})

describe('view model: KPI and compare-previous', () => {
  it('compare-previous gives the delta and direction, and a zero previous gives no %', () => {
    const up = toKpiView(answer([{ orders: 1200 }], [{ orders: 1000 }]), kpi(), MODEL, 'en')
    expect(up.value).toBe(1200)
    expect(up.previous).toBe(1000)
    expect(up.delta).toEqual({ abs: 200, pct: 0.2, direction: 'up' })

    const down = toKpiView(answer([{ orders: 750 }], [{ orders: 1000 }]), kpi(), MODEL, 'en')
    expect(down.delta).toEqual({ abs: -250, pct: -0.25, direction: 'down' })

    const flat = toKpiView(answer([{ orders: 1000 }], [{ orders: 1000 }]), kpi(), MODEL, 'en')
    expect(flat.delta).toEqual({ abs: 0, pct: 0, direction: 'flat' })

    // From nothing to 40: it went up, but by no percentage anyone can state.
    const fromZero = toKpiView(answer([{ orders: 40 }], [{ orders: 0 }]), kpi(), MODEL, 'en')
    expect(fromZero.delta).toEqual({ abs: 40, pct: null, direction: 'up' })

    // No previous rows (not asked, or none came back): no delta at all.
    expect(toKpiView(answer([{ orders: 40 }]), kpi(), MODEL, 'en').delta).toBeNull()
  })

  it('a KPI over days sums an additive headline and draws its sparkline in day order', () => {
    const view = toKpiView(
      answer(
        [
          { day: '2026-11-03', orders: 30 },
          { day: '2026-11-01', orders: 10 },
          { day: '2026-11-02', orders: 20 },
        ],
        [{ day: '2026-10-31', orders: 50 }],
      ),
      kpi('orders', ['day']),
      MODEL,
      'en',
    )
    expect(view.value).toBe(60)
    expect(view.spark.map((p) => p.value)).toEqual([10, 20, 30])
    expect(view.delta).toEqual({ abs: 10, pct: 0.2, direction: 'up' })
  })

  it('a rate KPI over days is never summed: its headline is not invented from the points', () => {
    const view = toKpiView(
      answer([
        { day: '2026-11-01', on_time_share: 0.9 },
        { day: '2026-11-02', on_time_share: 0.8 },
      ]),
      kpi('on_time_share', ['day']),
      MODEL,
      'en',
    )
    expect(view.value).toBeNull()
    expect(view.spark.map((p) => p.value)).toEqual([0.9, 0.8])
    // One row is the server's own figure for the window: that is the headline.
    expect(toKpiView(answer([{ on_time_share: 0.87 }]), kpi('on_time_share'), MODEL, 'en').value).toBe(0.87)
  })
})

const storeLine = (slots?: AnalyticsViewDefinition['slots']): AnalyticsViewDefinition => ({
  chart: { type: 'line' },
  query: { measures: ['orders'], dimensions: ['day', 'store'], filters: [] },
  slots,
})

/** Six stores over two days. Totals: S1 100, S2 90, S3 80, S4 70, S5 60, S6 5. */
const SIX_STORES: AnalyticsRow[] = [
  ['S1', 60, 40],
  ['S2', 50, 40],
  ['S3', 40, 40],
  ['S4', 35, 35],
  ['S5', 30, 30],
  ['S6', 2, 3],
].flatMap(([store, d1, d2]) => [
  { day: '2026-11-02', store, orders: d2 },
  { day: '2026-11-01', store, orders: d1 },
])

describe('view model: the top 5 plus Other, and stacking', () => {
  it('six members fold to five plus Other, and a rate measure is never stacked', () => {
    const view = toSeriesView(answer(SIX_STORES), storeLine({ store: { S5: 0 } }), MODEL, 'en')
    if (view.kind !== 'series') throw new Error(view.kind)
    // The five biggest are named, in rank order, and the sixth folds into Other — last, in ink grey (no slot).
    expect(view.series.map((s) => [s.member, s.slot, s.other])).toEqual([
      ['S1', 1, false],
      ['S2', 2, false],
      ['S3', 3, false],
      ['S4', 4, false],
      ['S5', 0, false], // its saved slot, kept
      ['', null, true],
    ])
    expect(view.x.isTime).toBe(true)
    expect(view.rows.map((r) => r.x)).toEqual(['2026-11-01', '2026-11-02'])
    const other = view.series[5].key
    expect(view.rows.map((r) => r.values[other])).toEqual([2, 3])
    expect(view.rows.map((r) => r.values[view.series[0].key])).toEqual([60, 40])
    expect(view.folded).toBe(1)
    expect(view.notShown).toBe(0)

    // A rate never stacks: the stacked area and the stacked bar are refused; the grouped bar is fine.
    const rate = (chart: AnalyticsViewDefinition['chart']): AnalyticsViewDefinition => ({
      chart,
      query: { measures: ['on_time_share'], dimensions: ['day', 'channel_group'], filters: [] },
    })
    const rows = [{ day: '2026-11-01', channel_group: 'app', on_time_share: 0.9 }]
    expect(toSeriesView(answer(rows), rate({ type: 'area' }), MODEL, 'en')).toEqual({ kind: 'refused', reason: 'rateStacked', measure: 'On-time share' })
    expect(toSeriesView(answer(rows), rate({ type: 'bar', stack: 'stacked' }), MODEL, 'en').kind).toBe('refused')
    expect(toSeriesView(answer(rows), rate({ type: 'bar', stack: 'grouped' }), MODEL, 'en').kind).toBe('series')
  })

  it('five members or fewer fold nothing, and a fixed dimension keeps its catalogue slots', () => {
    const view = toSeriesView(
      answer([
        { day: '2026-11-01', channel_group: 'web', orders: 9 },
        { day: '2026-11-01', channel_group: 'app', orders: 1 },
      ]),
      { chart: { type: 'area' }, query: { measures: ['orders'], dimensions: ['day', 'channel_group'], filters: [] } },
      MODEL,
      'en',
    )
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.stacking).toBe('stacked')
    expect(view.series.map((s) => [s.label, s.slot])).toEqual([
      ['Web', 1],
      ['App', 0],
    ])
    expect(view.folded).toBe(0)
  })

  it('a rate breakdown past five drops the rest rather than summing an Other it cannot compute', () => {
    const rows = SIX_STORES.map((r) => ({ day: r.day, store: r.store, on_time_share: (r.orders as number) / 100 }))
    const view = toSeriesView(
      answer(rows),
      { chart: { type: 'line' }, query: { measures: ['on_time_share'], dimensions: ['day', 'store'], filters: [] } },
      MODEL,
      'en',
    )
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.series).toHaveLength(5)
    expect(view.series.some((s) => s.other)).toBe(false)
    expect(view.folded).toBe(1)
    // …and says so on screen: one member is not shown at all (no "Other" holds it).
    expect(view.notShown).toBe(1)
  })

  it('two measures over time are two series, one per measure, in fixed measure slots', () => {
    const view = toSeriesView(
      answer([
        { day: '2026-11-01', orders: 10, on_time_share: 0.9 },
        { day: '2026-11-02', orders: 12, on_time_share: 0.8 },
      ]),
      { chart: { type: 'line' }, query: { measures: ['orders', 'on_time_share'], dimensions: ['day'], filters: [] } },
      MODEL,
      'en',
    )
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.series.map((s) => [s.label, s.slot, s.unit])).toEqual([
      ['Orders', 0, 'count'],
      ['On-time share', 1, 'share'],
    ])
  })

  it('a horizontal single-measure bar keeps each member in its own slot', () => {
    const view = toSeriesView(
      answer([
        { channel_group: 'web', orders: 9 },
        { channel_group: 'app', orders: 4 },
      ]),
      { chart: { type: 'bar', orientation: 'horizontal' }, query: { measures: ['orders'], dimensions: ['channel_group'], filters: [] } },
      MODEL,
      'en',
    )
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.orientation).toBe('horizontal')
    expect(view.series).toHaveLength(1)
    expect(view.rows.map((r) => [r.label, r.slot])).toEqual([
      ['Web', 1],
      ['App', 0],
    ])
  })
})

describe('a line over time compared with the previous period (766 story 23)', () => {
  it('adds the previous period as its own series, day by day in order, after the current one', () => {
    const days = ['2026-11-03', '2026-11-04', '2026-11-05']
    const prev = ['2026-10-31', '2026-11-01', '2026-11-02']
    const view = toSeriesView(
      answer(
        days.map((day, i) => ({ day, orders: [10, 20, 30][i] })),
        // Sent out of order: matched to the current days by position after sorting.
        [{ day: prev[2], orders: 3 }, { day: prev[0], orders: 1 }, { day: prev[1], orders: 2 }],
      ),
      { chart: { type: 'line' }, query: { measures: ['orders'], dimensions: ['day'], filters: [], compareToPrevious: true } },
      MODEL,
      'en',
    )
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.series.map((s) => [s.key, s.previous ?? false])).toEqual([
      ['s0', false],
      ['prev', true],
    ])
    expect(view.rows.map((r) => [r.values.s0, r.values.prev])).toEqual([
      [10, 1],
      [20, 2],
      [30, 3],
    ])
  })
  it('a line with no previous rows, or a breakdown, has no previous series', () => {
    const plain = toSeriesView(answer([{ day: '2026-11-05', orders: 1 }]), { chart: { type: 'line' }, query: { measures: ['orders'], dimensions: ['day'], filters: [], compareToPrevious: true } }, MODEL, 'en')
    if (plain.kind !== 'series') throw new Error(plain.kind)
    expect(plain.series.some((s) => s.previous)).toBe(false)
  })
})

describe('view model: named series (825)', () => {
  const HS = { id: 'hs', label: label('HungerStation', 'هنقرستيشن'), filters: [{ dimension: 'channel_group', values: ['app'] }] }
  const QC = { id: 'qc', label: label('QC', 'التوصيل السريع'), filters: [{ dimension: 'store', values: ['P001'] }] }
  const named = (type: 'bar' | 'line' | 'area' | 'kpi', measure = 'orders', dimensions = ['day'], stack?: 'stacked'): AnalyticsViewDefinition => ({
    chart: { type, ...(stack ? { stack } : {}) },
    query: { measures: [measure], dimensions, filters: [] },
    series: [HS, QC],
  })
  const seriesAnswer = (rows: AnalyticsRow[], previous: AnalyticsRow[] = []): AnalyticsQueryResult => ({
    ...answer(rows, previous),
    columns: [{ key: 'series', role: 'series' }],
  })

  it('draws one series per named series in slot order, on the shared axis, never a total', () => {
    const view = toSeriesView(
      seriesAnswer([
        { series: 'qc', day: '2026-11-02', orders: 9 },
        { series: 'hs', day: '2026-11-01', orders: 12 },
        { series: 'qc', day: '2026-11-01', orders: 7 },
      ]),
      named('line'),
      MODEL,
      'en',
    )
    if (view.kind !== 'series') throw new Error('refused')
    expect(view.series.map((s) => [s.label, s.slot, s.other])).toEqual([
      ['HungerStation', 0, false],
      ['QC', 1, false],
    ])
    expect(view.rows.map((r) => [r.x, r.values])).toEqual([
      ['2026-11-01', { s0: 12, s1: 7 }],
      ['2026-11-02', { s0: null, s1: 9 }],
    ])
    expect(view.stacking).toBe('none')
  })

  it('never stacks named series: a bar is grouped and an area overlaps, even when the definition asks to stack', () => {
    const rows = [
      { series: 'hs', channel_group: 'app', day: '2026-11-01', orders: 12 },
      { series: 'qc', channel_group: 'app', day: '2026-11-01', orders: 7 },
    ]
    const bar = toSeriesView(seriesAnswer(rows), named('bar', 'orders', ['channel_group'], 'stacked'), MODEL, 'en')
    const area = toSeriesView(seriesAnswer(rows), named('area', 'on_time_share'), MODEL, 'en')
    expect(bar.kind === 'series' && [bar.stacking, bar.colourBy]).toEqual(['grouped', 'single'])
    // A rate over named series is not refused: it is never stacked.
    expect(area.kind === 'series' && area.stacking).toBe('none')
  })

  it('a KPI shows one figure per series, each from its own rows (a rate is never averaged across series)', () => {
    const tiles = toKpiViews(
      seriesAnswer(
        [
          { series: 'hs', on_time_share: 0.8 },
          { series: 'qc', on_time_share: 0.6 },
        ],
        [
          { series: 'hs', on_time_share: 0.5 },
          { series: 'qc', on_time_share: 0.6 },
        ],
      ),
      named('kpi', 'on_time_share', []),
      MODEL,
      'ar',
    )
    expect(tiles.map((k) => [k.series.label, k.series.slot, k.value, k.previous, k.delta?.direction])).toEqual([
      ['هنقرستيشن', 0, 0.8, 0.5, 'up'],
      ['التوصيل السريع', 1, 0.6, 0.6, 'flat'],
    ])
  })
})

// Spec 3543 review (owner): an average in SAR and a percent are both shape rate, so a series chart once drew both on
// the first measure's axis. Each unit gets its own pane and its own value axis (the combo's two panes, 766 §E amendment
// 1: never two y-axes on one chart).
describe('unitPanes: one value axis per unit', () => {
  const twoUnits = (): AnalyticsQueryResult => ({
    ...answer([
      { day: '2026-11-01', orders: 10, avg_basket: 85.5, share: 40 },
      { day: '2026-11-02', orders: 12, avg_basket: 90.25, share: 60 },
    ]),
    columns: [
      { key: 'day', role: 'dimension' },
      { key: 'orders', role: 'measure', shape: 'additive', unit: 'count' },
      { key: 'avg_basket', role: 'measure', shape: 'rate', unit: 'SAR' },
      { key: 'share', role: 'measure', shape: 'rate', unit: 'percent' },
    ],
  }) as AnalyticsQueryResult
  const line = (measures: string[]): AnalyticsViewDefinition => ({ chart: { type: 'line' }, query: { measures, dimensions: ['day'], filters: [] } })

  it('splits SAR and percent into panes, each with its unit, its own series and only their values', () => {
    const view = toSeriesView(twoUnits(), line(['avg_basket', 'share']), MODEL, 'en') as SeriesView
    const panes = unitPanes(view)
    expect(panes.map((p) => [p.unit, p.series.map((s) => s.member), p.rows.map((r) => r.values)])).toEqual([
      ['SAR', ['avg_basket'], [{ s0: 85.5 }, { s0: 90.25 }]],
      ['percent', ['share'], [{ s1: 40 }, { s1: 60 }]],
    ])
    expect(panes[1].series[0].slot).toBe(1) // a measure keeps its colour slot in its own pane
    // Local walk 2026-11-10: one series per pane draws no legend, so each pane names its measures.
    expect(panes.map((p) => p.labels)).toEqual([['avg_basket'], ['share']]) // the test model has no labels for them
  })

  it('keeps one pane when every series shares a unit', () => {
    const view = toSeriesView(twoUnits(), line(['orders']), MODEL, 'en') as SeriesView
    expect(unitPanes(view)).toEqual([view])
  })
})
