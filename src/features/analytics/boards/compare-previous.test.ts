import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { droppedBy } from './calculations-edit'
import { comparesToPrevious, withCompare } from './editor'
import { panelCsv, panelSheet, panelTable } from './panel-table'
import { comparing, withChoice } from './panel-edit'
import { drawsAsSeries } from './SeriesPanel'
import { toSeriesView } from './series-view'
import { toTableView } from './view-model-forms'

/**
 * Spec 3519 review item 11 (owner decision): compare with the previous period is offered on a table and a bar too,
 * beside a KPI and a line. The table gains a "previous" column per measure (and so does every download); the bar a
 * previous-period series; and a `change` by category survives on both.
 */

const label = (en: string, ar: string) => ({ en, ar })

const MODEL = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders', 'الطلبات'), description: label('', ''), dimensions: ['region', 'day'] },
  ],
  dimensions: [
    { key: 'region', kind: 'category', label: label('Region', 'المنطقة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
} as unknown as AnalyticsModel

const answer = (rows: AnalyticsRow[], previous: AnalyticsRow[], extra: AnalyticsQueryResult['columns'] = []): AnalyticsQueryResult => ({
  columns: [{ key: 'region', role: 'dimension' }, { key: 'orders', role: 'measure', shape: 'additive', unit: 'count' }, ...extra],
  rows,
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-29', to: '2026-11-04' },
  previous,
  fetchedAt: '',
  dataAsOf: '',
})

const byRegion = (type: 'table' | 'bar', calculations = false): AnalyticsViewDefinition =>
  ({
    chart: { type, ...(type === 'bar' ? { orientation: 'vertical' } : {}) },
    query: {
      measures: ['orders'],
      dimensions: ['region'],
      filters: [],
      compareToPrevious: true,
      ...(calculations ? { calculations: [{ key: 'change_orders', kind: 'change', measure: 'orders' }] } : {}),
    },
  }) as AnalyticsViewDefinition

// The previous rows come back in another order and miss Eastern: matched by member, never by position.
const ROWS = [
  { region: 'Central', orders: 120 },
  { region: 'Western', orders: 90 },
  { region: 'Eastern', orders: 50 },
]
const PREVIOUS = [
  { region: 'Western', orders: 100 },
  { region: 'Central', orders: 100 },
]
const PREVIOUS_HEADER = (m: string) => `${m} · prev`

describe('compare with the previous period: where it is offered', () => {
  it('a KPI, a line, a table and every bar; not an area, a donut, a heat map or a combo', () => {
    for (const c of ['kpi', 'line', 'table', 'bar-vertical', 'bar-horizontal', 'bar-stacked', 'bar-grouped'] as const) expect(comparesToPrevious(c)).toBe(true)
    for (const c of ['area', 'donut', 'heatmap', 'combo'] as const) expect(comparesToPrevious(c)).toBe(false)
    const q = { measures: ['orders'], dimensions: ['region'], filters: [] }
    expect(withCompare(q, 'table', true)).toEqual({ ...q, compareToPrevious: true })
    expect(withCompare(q, 'bar-vertical', true)).toEqual({ ...q, compareToPrevious: true })
  })

  it('a change by category stays on a table and a bar, and goes on a combo', () => {
    const table = byRegion('table', true)
    expect(comparing(table)).toBe(true)
    const bar = withChoice(table, 'bar-vertical', MODEL)
    expect(bar.query.compareToPrevious).toBe(true)
    expect(bar.query.calculations?.map((c) => c.key)).toEqual(['change_orders'])
    expect(droppedBy(table, bar, MODEL)).toEqual([])
    const combo = withChoice(table, 'combo', MODEL)
    expect(combo.chart.type).toBe('combo')
    expect(droppedBy(table, combo, MODEL).map((d) => d.reason)).toEqual(['compare'])
  })
})

describe('a table compared with the previous period', () => {
  it('the table form puts a previous column after each measure, matched by member', () => {
    const view = toTableView(answer(ROWS, PREVIOUS), byRegion('table'), MODEL, 'en', { series: 'Series', previous: PREVIOUS_HEADER })
    expect(view.columns.map((c) => [c.key, c.label])).toEqual([
      ['region', 'Region'],
      ['orders', 'Orders'],
      ['orders:previous', 'Orders · prev'],
    ])
    expect(view.rows.map((r) => [r.region, r.orders, r['orders:previous']])).toEqual([
      ['Central', 120, 100],
      ['Western', 90, 100],
      ['Eastern', 50, null],
    ])
  })

  it('the table view, the CSV and the xlsx carry it', () => {
    const t = panelTable(answer(ROWS, PREVIOUS), byRegion('table'), MODEL, 'en', { series: 'Series', previous: PREVIOUS_HEADER })
    expect(panelCsv(t)).toBe('﻿Region,Orders,Orders · prev\r\nCentral,120,100\r\nWestern,90,100\r\nEastern,50,\r\n')
    expect(panelSheet(t, 'Orders').data[1]).toEqual([{ type: String, value: 'Central' }, { type: Number, value: 120 }, { type: Number, value: 100 }])
  })

  it('a change by category reads beside it, and a calculated column gets no previous column', () => {
    const change = { key: 'change_orders', role: 'measure' as const, shape: 'rate' as const, unit: 'percent' as const, calculation: { kind: 'change' as const, measure: 'orders' } }
    const rows = ROWS.map((r, i) => ({ ...r, change_orders: [20, -10, null][i] }))
    const t = panelTable(answer(rows, PREVIOUS, [change]), byRegion('table', true), MODEL, 'en', { series: 'Series', previous: PREVIOUS_HEADER })
    expect(t.columns.map((c) => c.key)).toEqual(['region', 'orders', 'orders:previous', 'change_orders'])
    expect(t.rows[0]).toEqual({ region: 'Central', orders: 120, 'orders:previous': 100, change_orders: 20 })
  })

  it('without previous rows the table is as it was', () => {
    const t = panelTable(answer(ROWS, []), byRegion('table'), MODEL, 'en', { series: 'Series', previous: PREVIOUS_HEADER })
    expect(t.columns.map((c) => c.key)).toEqual(['region', 'orders'])
  })

  it('a date breakdown pairs each bucket with the previous period’s bucket of the same place', () => {
    const def = { ...byRegion('table'), query: { ...byRegion('table').query, dimensions: ['day'] } }
    const result = { ...answer([], []), columns: [{ key: 'day', role: 'dimension' as const }, { key: 'orders', role: 'measure' as const, shape: 'additive' as const, unit: 'count' as const }] }
    const t = panelTable(
      { ...result, rows: [{ day: '2026-11-03', orders: 30 }, { day: '2026-11-02', orders: 20 }], previous: [{ day: '2026-10-27', orders: 3 }, { day: '2026-10-26', orders: 2 }] },
      def,
      MODEL,
      'en',
      { series: 'Series', previous: PREVIOUS_HEADER },
    )
    expect(t.rows.map((r) => [r.day, r['orders:previous']])).toEqual([
      ['2026-11-03', 3],
      ['2026-11-02', 2],
    ])
  })

  it('the header is said in both languages from the locale', () => {
    expect(en.view.previousColumn).toContain('{{measure}}')
    expect(ar.view.previousColumn).toContain('{{measure}}')
    expect(ar.view.previousColumn).not.toBe(en.view.previousColumn)
  })
})

describe('a bar compared with the previous period', () => {
  it('draws as a series chart, so the previous period can stand beside it', () => {
    expect(drawsAsSeries(byRegion('bar'))).toBe(true)
    const { compareToPrevious: _c, ...plain } = byRegion('bar').query
    void _c
    expect(drawsAsSeries({ ...byRegion('bar'), query: plain })).toBe(false)
  })

  it('adds the previous period as a grouped series, matched by member', () => {
    const view = toSeriesView(answer(ROWS, PREVIOUS), byRegion('bar'), MODEL, 'en')
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.series.map((s) => [s.key, s.previous ?? false])).toEqual([
      ['s0', false],
      ['prev', true],
    ])
    expect(view.stacking).toBe('grouped')
    expect(view.rows.map((r) => [r.x, r.values.s0, r.values.prev])).toEqual([
      ['Central', 120, 100],
      ['Western', 90, 100],
      ['Eastern', 50, null],
    ])
  })

  it('a change by category draws as its own series, the previous period beside the measure', () => {
    const change = { key: 'change_orders', role: 'measure' as const, shape: 'rate' as const, unit: 'percent' as const, calculation: { kind: 'change' as const, measure: 'orders' } }
    const grouped = { ...byRegion('bar', true), chart: { type: 'bar' as const, stack: 'grouped' as const } }
    const view = toSeriesView(answer(ROWS.map((r, i) => ({ ...r, change_orders: [20, -10, null][i] })), PREVIOUS, [change]), grouped, MODEL, 'en')
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.series.map((s) => s.key)).toEqual(['s0', 's1', 'prev'])
    expect(view.stacking).toBe('grouped')
    expect(view.rows[0].values).toEqual({ s0: 120, s1: 20, prev: 100 })
  })

  it('a stacked bar is never stacked onto its previous period', () => {
    const stacked = { ...byRegion('bar'), chart: { type: 'bar' as const, stack: 'stacked' as const } }
    const view = toSeriesView(answer(ROWS, PREVIOUS), stacked, MODEL, 'en')
    if (view.kind !== 'series') throw new Error(view.kind)
    expect(view.stacking).toBe('grouped')
  })
})
