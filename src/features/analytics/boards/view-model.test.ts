import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { toBarView } from './view-model'

const label = (en: string, ar: string) => ({ en, ar })

/** A catalogue with one fixed-slot dimension (channel group, values inline) and one open one (store). */
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
      dimensions: ['channel_group', 'store'],
    },
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
  ],
}

const definition = (dimension: string, slots?: AnalyticsViewDefinition['slots']): AnalyticsViewDefinition => ({
  chart: { type: 'bar', orientation: 'vertical' },
  query: { measures: ['orders'], dimensions: [dimension], filters: [] },
  slots,
})

const result = (dimension: string, rows: [string, number][]): AnalyticsQueryResult => ({
  columns: [
    { key: dimension, role: 'dimension' },
    { key: 'orders', role: 'measure', shape: 'additive', unit: 'count' },
  ],
  rows: rows.map(([member, orders]) => ({ [dimension]: member, orders })),
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-07', to: '2026-11-05' },
  previous: [],
  fetchedAt: '2026-11-05T10:00:00',
  dataAsOf: '2026-11-05T09:45:00',
})

const slotsOf = (view: ReturnType<typeof toBarView>) => Object.fromEntries(view.points.map((p) => [p.member, p.slot]))

describe('result → view model', () => {
  it('a channel keeps its fixed slot when other channels are filtered out', () => {
    const all = toBarView(
      result('channel_group', [['app', 50], ['web', 40], ['callcenter', 30], ['aggregator', 20], ['store', 10]]),
      definition('channel_group'),
      MODEL,
      'en',
    )
    expect(slotsOf(all)).toEqual({ app: 0, web: 1, callcenter: 2, aggregator: 3, store: 4 })

    // The rank changes and three channels are gone: the two that remain keep their colours.
    const filtered = toBarView(result('channel_group', [['aggregator', 90], ['web', 5]]), definition('channel_group'), MODEL, 'en')
    expect(slotsOf(filtered)).toEqual({ aggregator: 3, web: 1 })
    expect(filtered.colourBy).toBe('member')
    // The members read in the active language, from the model.
    expect(filtered.points.map((p) => p.label)).toEqual(['Aggregators', 'Web'])
    expect(toBarView(result('channel_group', [['web', 5]]), definition('channel_group'), MODEL, 'ar').points[0].label).toBe('الموقع')
    expect(filtered.measure).toEqual({ key: 'orders', label: 'Orders', unit: 'count', shape: 'additive' })
    expect(filtered.points.map((p) => p.value)).toEqual([90, 5])
  })

  it("a breakdown's saved member→slot map is honoured and a new member takes the next free slot", () => {
    const view = toBarView(
      result('store', [['P003', 70], ['P009', 60], ['P001', 50], ['P002', 40]]),
      definition('store', { store: { P001: 0, P002: 2, P003: 3 } }),
      MODEL,
      'en',
    )
    // P009 was not in the map when the view was saved: it takes slot 1, the first one free.
    expect(slotsOf(view)).toEqual({ P003: 3, P009: 1, P001: 0, P002: 2 })
    expect(view.colourBy).toBe('member')
    // An open dimension's member reads as the value the server sent.
    expect(view.points.map((p) => p.label)).toEqual(['P003', 'P009', 'P001', 'P002'])

    // Six new members against a map holding four: the two free slots go in order, the rest get none.
    const crowded = toBarView(
      result('store', [['P001', 9], ['A', 8], ['B', 7], ['C', 6]]),
      definition('store', { store: { P001: 0, P002: 2, P003: 3 } }),
      MODEL,
      'en',
    )
    expect(slotsOf(crowded)).toEqual({ P001: 0, A: 1, B: 4, C: null })
  })

  it('an open breakdown with no saved map draws in one colour, and an empty answer is empty', () => {
    const view = toBarView(result('store', [['P001', 9], ['P002', 8]]), definition('store'), MODEL, 'en')
    expect(view.colourBy).toBe('single')
    expect(view.empty).toBe(false)
    expect(toBarView(result('store', []), definition('store'), MODEL, 'en').empty).toBe(true)
  })
})
