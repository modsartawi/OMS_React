import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsSeries, AnalyticsViewDefinition } from '@/core/models/analytics'
import { mergeSeries, seriesBindReason, seriesProblems, seriesRows } from './series'

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
      dimensions: ['day', 'city', 'channel_group', 'delivery_type'],
    },
  ],
  dimensions: [
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
    { key: 'city', kind: 'category', label: label('City', 'المدينة'), values: [] },
    { key: 'store', kind: 'category', label: label('Store', 'الفرع'), values: [] },
    { key: 'channel_group', kind: 'category', label: label('Channel', 'القناة'), values: [] },
    { key: 'delivery_type', kind: 'category', label: label('Delivery type', 'نوع التوصيل'), values: [] },
  ],
}

const HS: AnalyticsSeries = { id: 'hs', label: label('HungerStation', 'هنقرستيشن'), filters: [{ dimension: 'channel_group', values: ['hungerstation'] }] }
const QC: AnalyticsSeries = { id: 'qc', label: label('QC', 'التوصيل السريع'), filters: [{ dimension: 'delivery_type', values: ['QC'] }] }

const view = (series: AnalyticsSeries[], dimensions = ['day']): AnalyticsViewDefinition => ({
  chart: { type: 'line' },
  query: { measures: ['orders'], dimensions, filters: [] },
  series,
})

const answer = (rows: AnalyticsRow[]): AnalyticsQueryResult => ({
  columns: [
    { key: 'series', role: 'series' },
    { key: 'day', role: 'dimension' },
    { key: 'orders', role: 'measure', shape: 'additive', unit: 'count' },
  ],
  rows,
  total: rows.length,
  truncated: false,
  period: null,
  previous: [],
  fetchedAt: '',
  dataAsOf: '',
})

describe('mergeSeries: per-series rows on a shared axis', () => {
  it('merges each series onto the axis points, the series in the definition order with slots 0..n', () => {
    // The answer lists QC first; the definition's order (HS, QC) is the slot order.
    const merged = mergeSeries(
      answer([
        { series: 'qc', day: '2026-11-01', orders: 7 },
        { series: 'hs', day: '2026-11-02', orders: 20 },
        { series: 'hs', day: '2026-11-01', orders: 12 },
        { series: 'qc', day: '2026-11-02', orders: 9 },
      ]),
      view([HS, QC]),
      'en',
    )
    expect(merged.series).toEqual([
      { id: 'hs', label: 'HungerStation', slot: 0 },
      { id: 'qc', label: 'QC', slot: 1 },
    ])
    expect(merged.points.map((p) => p.at)).toEqual([{ day: '2026-11-01' }, { day: '2026-11-02' }])
    expect(merged.points.map((p) => [p.values.hs?.orders, p.values.qc?.orders])).toEqual([
      [12, 7],
      [20, 9],
    ])
  })

  it('holds no total across series: only each series id is a key, never a sum', () => {
    const merged = mergeSeries(
      answer([
        { series: 'hs', day: '2026-11-01', orders: 12 },
        { series: 'qc', day: '2026-11-01', orders: 7 },
      ]),
      view([HS, QC]),
      'en',
    )
    expect(Object.keys(merged.points[0].values)).toEqual(['hs', 'qc'])
    expect(merged.series.map((s) => s.id)).not.toContain('total')
  })

  it('leaves a gap where a series has no row, and drops rows of a series the view does not hold', () => {
    const merged = mergeSeries(
      answer([
        { series: 'hs', day: '2026-11-01', orders: 12 },
        { series: 'gone', day: '2026-11-01', orders: 99 },
        { series: 'qc', day: '2026-11-02', orders: 9 },
      ]),
      view([HS, QC]),
      'en',
    )
    expect(merged.points).toHaveLength(2)
    expect(merged.points[0].values.qc).toBeUndefined()
    expect(merged.points[1].values.hs).toBeUndefined()
    expect(JSON.stringify(merged)).not.toContain('99')
  })

  it('names the series in Arabic, falling back to English, then the id', () => {
    const blank: AnalyticsSeries = { id: 's3', label: label('', ''), filters: [] }
    const merged = mergeSeries(answer([]), view([HS, { ...QC, label: label('QC', '') }, blank]), 'ar')
    expect(merged.series.map((s) => s.label)).toEqual(['هنقرستيشن', 'QC', 's3'])
  })

  it('reads the series column by its role, whatever its key', () => {
    const a = answer([{ sid: 'qc', day: '2026-11-01', orders: 3 }])
    a.columns[0] = { key: 'sid', role: 'series' }
    expect(mergeSeries(a, view([HS, QC]), 'en').points[0].values.qc?.orders).toBe(3)
  })

  it('seriesRows gives one series its own rows (a KPI per series, a previous period per series)', () => {
    const rows = [
      { series: 'hs', orders: 12 },
      { series: 'qc', orders: 7 },
    ]
    expect(seriesRows(rows, answer([]).columns, 'qc')).toEqual([{ series: 'qc', orders: 7 }])
  })
})

describe('series binding and save checks (ANALYTICS-411 shapes)', () => {
  it('a members parameter cannot bind to a dimension a series filters on in that panel: seriesFilters', () => {
    expect(seriesBindReason('channel_group', view([HS, QC]))).toBe('seriesFilters')
    expect(seriesBindReason('delivery_type', view([HS, QC]))).toBe('seriesFilters')
    expect(seriesBindReason('city', view([HS, QC]))).toBeNull()
    expect(seriesBindReason('channel_group', view([]))).toBeNull()
  })

  it('refuses more than 4 series, a duplicate label and a foreign dimension', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: label(id, id), filters: [] }))
    expect(seriesProblems(view(five), MODEL)).toEqual([{ why: 'tooMany' }])
    const dup = { ...QC, id: 'qc2', label: label(' hungerstation ', 'x') }
    expect(seriesProblems(view([HS, dup]), MODEL)).toEqual([{ why: 'duplicate', series: 'qc2' }])
    const foreign = { ...QC, filters: [{ dimension: 'store', values: ['P001'] }] }
    expect(seriesProblems(view([HS, foreign]), MODEL)).toEqual([{ why: 'foreignDimension', series: 'qc', dimension: 'store' }])
    expect(seriesProblems(view([HS, QC]), MODEL)).toEqual([])
  })
})
