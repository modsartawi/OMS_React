import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { FSI, PDI } from '@/core/util/bidi'
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
