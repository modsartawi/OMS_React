import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { FSI, PDI } from '@/core/util/bidi'
import { calculatedModel, type CalculationWords } from './calculations'
import { panelCsv, panelFileBase, panelSheet, panelTable } from './panel-table'

const model = {
  areas: [],
  measures: [{ key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: { en: 'Orders', ar: 'الطلبات' }, description: { en: '', ar: '' }, dimensions: [] }],
  dimensions: [
    { key: 'channel_group', kind: 'category', label: { en: 'Channel', ar: 'القناة' }, values: [{ key: 'app', label: { en: 'App', ar: 'التطبيق' } }] },
    { key: 'store', kind: 'category', label: { en: 'Store', ar: 'الفرع' }, values: [] },
  ],
} as unknown as AnalyticsModel

const definition = { chart: { type: 'bar' }, query: { measures: ['orders'], dimensions: ['channel_group'], filters: [] } } as unknown as AnalyticsViewDefinition

const result = (rows: Record<string, string | number | null>[]): AnalyticsQueryResult => ({
  columns: [
    { key: 'channel_group', role: 'dimension' },
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

describe('the panel table (the table view and every download)', () => {
  it('keeps the answer’s row order — the chart’s — and names members as the chart does', () => {
    const t = panelTable(result([{ channel_group: 'web', orders: 1800 }, { channel_group: 'app', orders: 3100 }]), definition, model, 'en')
    expect(t.columns.map((c) => [c.key, c.label])).toEqual([['channel_group', 'Channel'], ['orders', 'Orders']])
    expect(t.rows).toEqual([{ channel_group: 'web', orders: 1800 }, { channel_group: 'App', orders: 3100 }])
  })

  it('the CSV is the header and rows, numbers raw, with a BOM and CRLF, a comma or quote quoted', () => {
    const t = panelTable(result([{ channel_group: 'a, "b"', orders: 1234.5 }, { channel_group: 'app', orders: null }]), definition, model, 'en')
    expect(panelCsv(t)).toBe('﻿Channel,Orders\r\n"a, ""b""",1234.5\r\nApp,\r\n')
  })

  it('no isolate reaches a file: a header or member carrying FSI…PDI is written bare', () => {
    const named = { ...model, dimensions: [{ ...model.dimensions[0], label: { en: `${FSI}Channel${PDI}`, ar: '' } }, model.dimensions[1]] } as AnalyticsModel
    const t = panelTable(result([{ channel_group: `${FSI}P001${PDI}`, orders: 1 }]), definition, named, 'en')
    expect(panelCsv(t)).toBe('﻿Channel,Orders\r\nP001,1\r\n')
    const sheet = panelSheet(t, 'Orders')
    expect(JSON.stringify(sheet.data)).not.toMatch(/[⁦-⁩]/)
  })

  it('the xlsx sheet keeps numbers numeric (Excel can total them) and members as text', () => {
    const sheet = panelSheet(panelTable(result([{ channel_group: 'app', orders: 3100 }]), definition, model, 'en'), 'Orders by channel')
    expect(sheet.name).toBe('Orders by channel')
    expect(sheet.data[1]).toEqual([{ type: String, value: 'App' }, { type: Number, value: 3100 }])
  })

  it('a sheet name is cut to Excel’s 31 characters and loses the characters Excel refuses', () => {
    expect(panelSheet(panelTable(result([]), definition, model, 'en'), 'Orders / value: by [channel] over the last 30 days').name).toBe('Orders  value by channel over t')
  })

  it('a file name is the view id, made safe', () => {
    expect(panelFileBase('v-bar')).toBe('analytics-v-bar')
    expect(panelFileBase('a/b c')).toBe('analytics-a-b-c')
  })
})

describe('the panel table of a view with named series (825)', () => {
  const named = {
    chart: { type: 'bar' },
    query: { measures: ['orders'], dimensions: ['channel_group'], filters: [] },
    series: [
      { id: 'hs', label: { en: `${FSI}HungerStation${PDI}`, ar: 'هنقرستيشن' }, filters: [] },
      { id: 'qc', label: { en: 'QC', ar: 'التوصيل السريع' }, filters: [] },
    ],
  } as unknown as AnalyticsViewDefinition
  const answer: AnalyticsQueryResult = {
    ...result([]),
    columns: [{ key: 'series', role: 'series' }, ...result([]).columns],
    rows: [
      { series: 'hs', channel_group: 'app', orders: 12 },
      { series: 'qc', channel_group: 'app', orders: 7 },
      { series: 'other', channel_group: 'app', orders: 99 },
    ],
  }

  it('puts a series column first, naming each row by its series label, rows of an unknown series dropped', () => {
    const table = panelTable(answer, named, model, 'ar', { series: 'السلسلة' })
    expect(table.columns.map((c) => [c.key, c.label])).toEqual([
      ['series', 'السلسلة'],
      ['channel_group', 'القناة'],
      ['orders', 'الطلبات'],
    ])
    expect(table.rows).toEqual([
      { series: 'هنقرستيشن', channel_group: 'التطبيق', orders: 12 },
      { series: 'التوصيل السريع', channel_group: 'التطبيق', orders: 7 },
    ])
  })

  it('writes the series column to the CSV and the xlsx with isolates stripped', () => {
    const table = panelTable(answer, named, model, 'en', { series: 'Series' })
    expect(panelCsv(table)).toBe('\uFEFFSeries,Channel,Orders\r\nHungerStation,App,12\r\nQC,App,7\r\n')
    const sheet = panelSheet(table, 'Named')
    expect(sheet.data[0][0]).toMatchObject({ value: 'Series' })
    expect(sheet.data.slice(1).map((r) => r[0])).toEqual([
      { type: String, value: 'HungerStation' },
      { type: String, value: 'QC' },
    ])
    expect(JSON.stringify(sheet)).not.toMatch(/[\u2068\u2069]/)
  })
})

// 861 (spec 3519): a calculated column the server returns is a measure of the table, the CSV and the xlsx.
describe('the panel table: calculated columns', () => {
  const WORDS: CalculationWords = {
    shareOfTotal: ({ measure }) => `Share of ${measure}`,
    ratio: ({ measure, of }) => `${measure} as % of ${of}`,
    cumulativeShare: ({ measure }) => `Running share of ${measure}`,
    change: ({ measure }) => `Change in ${measure}`,
    shareOfTotalWithin: ({ measure, within }) => `Share of ${measure} in each ${within}`,
    cumulativeShareWithin: ({ measure, within }) => `Running share of ${measure} in each ${within}`,
  }
  const withShare = { ...definition, query: { ...definition.query, calculations: [{ key: 'ordersShare', kind: 'shareOfTotal', measure: 'orders' }] } } as AnalyticsViewDefinition
  const shareResult = (rows: Record<string, string | number | null>[]): AnalyticsQueryResult => {
    const r = result(rows)
    return { ...r, columns: [...r.columns, { key: 'ordersShare', role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind: 'shareOfTotal', measure: 'orders' } }] }
  }
  const table = (rows: Record<string, string | number | null>[]) => {
    const r = shareResult(rows)
    return panelTable(r, withShare, calculatedModel(model, withShare, r, 'en', WORDS), 'en')
  }

  it('renders a share of total after the measures, labelled, as a percent, with null as unknown', () => {
    const t = table([{ channel_group: 'app', orders: 3100, ordersShare: 63.2653 }, { channel_group: 'web', orders: 0, ordersShare: null }])
    expect(t.columns.map((c) => [c.key, c.role, c.label, c.unit])).toEqual([
      ['channel_group', 'dimension', 'Channel', undefined],
      ['orders', 'measure', 'Orders', 'count'],
      ['ordersShare', 'measure', 'Share of Orders', 'percent'],
    ])
    expect(t.rows).toEqual([{ channel_group: 'App', orders: 3100, ordersShare: 63.2653 }, { channel_group: 'web', orders: 0, ordersShare: null }])
  })

  it('the CSV and the xlsx carry the calculated column under its label', () => {
    const t = table([{ channel_group: 'app', orders: 3100, ordersShare: 63.2653 }, { channel_group: 'web', orders: 1, ordersShare: null }])
    expect(panelCsv(t)).toBe('﻿Channel,Orders,Share of Orders\r\nApp,3100,63.2653\r\nweb,1,\r\n')
    const sheet = panelSheet(t, 'Orders')
    expect(sheet.data[0]).toEqual(['Channel', 'Orders', 'Share of Orders'].map((value) => ({ value, fontWeight: 'bold' })))
    expect(sheet.data[1]).toEqual([{ type: String, value: 'App' }, { type: Number, value: 3100 }, { type: Number, value: 63.2653 }])
    expect(sheet.data[2][2]).toEqual({ type: String, value: '' })
  })
})
