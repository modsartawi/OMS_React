import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { toKpiView, toSeriesView } from './series-view'

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
