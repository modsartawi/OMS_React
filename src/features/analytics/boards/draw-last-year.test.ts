import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import enCommon from '@/locales/en/common.json'
import arCommon from '@/locales/ar/common.json'
import { lastYearNotes, lastYearRange, type LastYearNoteWords } from './last-year'
import { panelCsv, panelSheet, panelTable, type TableWords } from './panel-table'
import { drawsAsSeries } from './SeriesPanel'
import { toKpiView, toKpiViews, toSeriesView, type SeriesWords } from './series-view'
import { drawnResult } from './unsplit'
import { toTableView } from './view-model-forms'
import { readResult } from './wire'

/**
 * Ticket 877 (BackOffice spec 3587 B9, B11, B12; tickets 3604, 3606): a result that carries last year's rows is drawn
 * with them wherever the previous period's rows are drawn — a table's column, a bar's and a line's series, a KPI's
 * figure — told apart by its label and its dates. A figure whose area does not hold last year is never drawn as zero:
 * it has no last-year figure, and a note says the day its data starts.
 *
 * The wire is the server's: `lastYear` (rows), `lastYearPeriod` ({from, to}) and `lastYearNotHeld`
 * ([{area, dataFrom, measures}]), each absent when last year was not asked.
 */

const label = (en: string, ar: string) => ({ en, ar })

const MODEL = {
  areas: [{ key: 'sales', available: true }, { key: 'loyalty', available: true }],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders', 'الطلبات'), description: label('', ''), dimensions: ['region', 'day'] },
    { key: 'points', area: 'loyalty', shape: 'additive', unit: 'count', label: label('Points', 'النقاط'), description: label('', ''), dimensions: ['region', 'day'] },
  ],
  dimensions: [
    { key: 'region', kind: 'category', label: label('Region', 'المنطقة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
} as unknown as AnalyticsModel

const ORDERS = { key: 'orders', role: 'measure' as const, shape: 'additive' as const, unit: 'count' as const }
const POINTS = { key: 'points', role: 'measure' as const, shape: 'additive' as const, unit: 'count' as const }
const LAST_YEAR_PERIOD = { from: '2025-10-30', to: '2025-11-05' }

/** An answer; `lastYear` undefined is a result that was not asked for last year (the fields are off the wire). */
const answer = (
  rows: AnalyticsRow[],
  over: { previous?: AnalyticsRow[]; lastYear?: AnalyticsRow[]; columns?: AnalyticsQueryResult['columns']; notHeld?: AnalyticsQueryResult['lastYearNotHeld'] } = {},
): AnalyticsQueryResult => ({
  columns: over.columns ?? [{ key: 'region', role: 'dimension' }, ORDERS],
  rows,
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-29', to: '2026-11-04' },
  previous: over.previous ?? [],
  ...(over.lastYear ? { lastYear: over.lastYear, lastYearPeriod: LAST_YEAR_PERIOD } : {}),
  ...(over.notHeld ? { lastYearNotHeld: over.notHeld } : {}),
  fetchedAt: '',
  dataAsOf: '',
})

const byRegion = (type: 'table' | 'bar' | 'line' | 'kpi', over: Partial<AnalyticsViewDefinition['query']> = {}): AnalyticsViewDefinition =>
  ({
    chart: { type, ...(type === 'bar' ? { orientation: 'vertical' } : {}) },
    query: { measures: ['orders'], dimensions: ['region'], filters: [], compareToLastYear: true, ...over },
  }) as AnalyticsViewDefinition

// Last year's rows come back in another order and miss Eastern: matched by member, never by position.
const ROWS = [
  { region: 'Central', orders: 120 },
  { region: 'Western', orders: 90 },
  { region: 'Eastern', orders: 50 },
]
const PREVIOUS = [
  { region: 'Western', orders: 100 },
  { region: 'Central', orders: 100 },
]
const LAST_YEAR = [
  { region: 'Western', orders: 70 },
  { region: 'Central', orders: 80 },
]

const WORDS: TableWords = {
  series: 'Series',
  previous: (m) => `${m} · prev`,
  lastYear: (m, range) => `${m} · last year ${range}`,
}

const SERIES_WORDS: SeriesWords = { lastYear: (range) => `Last year (${range})` }

const seriesOf = (result: AnalyticsQueryResult, definition: AnalyticsViewDefinition) => {
  const view = toSeriesView(result, definition, MODEL, 'en', SERIES_WORDS)
  if (view.kind !== 'series') throw new Error(view.kind)
  return view
}

describe('877: a table with last year’s rows shows a last-year column', () => {
  it('the table form puts it after the measure, matched by member, headed by last year’s dates', () => {
    const view = toTableView(answer(ROWS, { lastYear: LAST_YEAR }), byRegion('table'), MODEL, 'en', WORDS)
    expect(view.columns.map((c) => [c.key, c.label])).toEqual([
      ['region', 'Region'],
      ['orders', 'Orders'],
      ['orders:lastYear', 'Orders · last year Oct 30, 2025 – Nov 5, 2025'],
    ])
    expect(view.rows.map((r) => [r.region, r.orders, r['orders:lastYear']])).toEqual([
      ['Central', 120, 80],
      ['Western', 90, 70],
      ['Eastern', 50, null],
    ])
  })

  it('the table view of a panel does the same, and a calculated column gets no last-year column', () => {
    const change = { key: 'change_ly_orders', role: 'measure' as const, shape: 'rate' as const, unit: 'percent' as const, calculation: { kind: 'change' as const, measure: 'orders', from: 'lastYear' as const } }
    const rows = ROWS.map((r, i) => ({ ...r, change_ly_orders: [50, 28.6, null][i] }))
    const def = byRegion('table', { calculations: [{ key: 'change_ly_orders', kind: 'change', measure: 'orders', from: 'lastYear' }] })
    const t = panelTable(answer(rows, { lastYear: LAST_YEAR, columns: [{ key: 'region', role: 'dimension' }, ORDERS, change] }), def, MODEL, 'en', WORDS)
    expect(t.columns.map((c) => c.key)).toEqual(['region', 'orders', 'orders:lastYear', 'change_ly_orders'])
    // The change is the server's own figure, shown as sent: 50, never recomputed from 120 and 80.
    expect(t.rows[0]).toEqual({ region: 'Central', orders: 120, 'orders:lastYear': 80, change_ly_orders: 50 })
  })

  it('a date breakdown pairs each bucket with last year’s bucket of the same place', () => {
    const def = byRegion('table', { dimensions: ['day'] })
    const result = answer(
      [{ day: '2026-11-03', orders: 30 }, { day: '2026-11-02', orders: 20 }],
      { lastYear: [{ day: '2025-11-03', orders: 2 }, { day: '2025-11-04', orders: 3 }], columns: [{ key: 'day', role: 'dimension' }, ORDERS] },
    )
    expect(panelTable(result, def, MODEL, 'en', WORDS).rows.map((r) => [r.day, r['orders:lastYear']])).toEqual([
      ['2026-11-03', 3],
      ['2026-11-02', 2],
    ])
  })
})

describe('877: a bar chart with last year’s rows draws a last-year series, labelled with its dates', () => {
  it('draws as a series chart, so last year can stand beside it', () => {
    expect(drawsAsSeries(byRegion('bar'))).toBe(true)
    expect(drawsAsSeries(byRegion('bar', { compareToLastYear: undefined }))).toBe(false)
  })

  it('adds last year as a grouped series, matched by member, named with last year’s dates', () => {
    const view = seriesOf(answer(ROWS, { lastYear: LAST_YEAR }), byRegion('bar'))
    expect(view.series.map((s) => [s.key, s.lastYear ?? false, s.label])).toEqual([
      ['s0', false, 'Orders'],
      ['ly', true, 'Last year (Oct 30, 2025 – Nov 5, 2025)'],
    ])
    expect(view.stacking).toBe('grouped')
    expect(view.rows.map((r) => [r.x, r.values.s0, r.values.ly])).toEqual([
      ['Central', 120, 80],
      ['Western', 90, 70],
      ['Eastern', 50, null],
    ])
  })

  it('a stacked bar is never stacked onto last year', () => {
    const stacked = { ...byRegion('bar'), chart: { type: 'bar' as const, stack: 'stacked' as const } }
    expect(seriesOf(answer(ROWS, { lastYear: LAST_YEAR }), stacked).stacking).toBe('grouped')
  })

  it('a line over time draws last year beside it, each day under the day of the same place', () => {
    const def = byRegion('line', { dimensions: ['day'] })
    const result = answer(
      [{ day: '2026-11-03', orders: 30 }, { day: '2026-11-02', orders: 20 }],
      { lastYear: [{ day: '2025-11-04', orders: 3 }, { day: '2025-11-03', orders: 2 }], columns: [{ key: 'day', role: 'dimension' }, ORDERS] },
    )
    const view = seriesOf(result, def)
    expect(view.series.map((s) => [s.key, s.lastYear ?? false, s.label])).toEqual([
      ['s0', false, 'Orders'],
      ['ly', true, 'Last year (Oct 30, 2025 – Nov 5, 2025)'],
    ])
    expect(view.rows.map((r) => [r.x, r.values.s0, r.values.ly])).toEqual([
      ['2026-11-02', 20, 2],
      ['2026-11-03', 30, 3],
    ])
  })
})

describe('877: with both comparisons, both are drawn and labelled apart', () => {
  const both = (type: 'table' | 'bar' | 'line' | 'kpi', over: Partial<AnalyticsViewDefinition['query']> = {}) => byRegion(type, { compareToPrevious: true, ...over })

  it('a table shows the previous column, then the last-year column, each under its own heading', () => {
    const t = panelTable(answer(ROWS, { previous: PREVIOUS, lastYear: LAST_YEAR }), both('table'), MODEL, 'en', WORDS)
    expect(t.columns.map((c) => [c.key, c.label])).toEqual([
      ['region', 'Region'],
      ['orders', 'Orders'],
      ['orders:previous', 'Orders · prev'],
      ['orders:lastYear', 'Orders · last year Oct 30, 2025 – Nov 5, 2025'],
    ])
    expect(t.rows).toEqual([
      { region: 'Central', orders: 120, 'orders:previous': 100, 'orders:lastYear': 80 },
      { region: 'Western', orders: 90, 'orders:previous': 100, 'orders:lastYear': 70 },
      { region: 'Eastern', orders: 50, 'orders:previous': null, 'orders:lastYear': null },
    ])
    expect(toTableView(answer(ROWS, { previous: PREVIOUS, lastYear: LAST_YEAR }), both('table'), MODEL, 'en', WORDS).columns.map((c) => c.key)).toEqual(t.columns.map((c) => c.key))
  })

  it('a bar draws the measure, the previous period and last year side by side, never stacked', () => {
    const view = seriesOf(answer(ROWS, { previous: PREVIOUS, lastYear: LAST_YEAR }), both('bar'))
    expect(view.series.map((s) => [s.key, s.previous ?? false, s.lastYear ?? false])).toEqual([
      ['s0', false, false],
      ['prev', true, false],
      ['ly', false, true],
    ])
    expect(view.stacking).toBe('grouped')
    expect(view.rows[0].values).toEqual({ s0: 120, prev: 100, ly: 80 })
    expect(view.rows[2].values).toEqual({ s0: 50, prev: null, ly: null })
  })

  it('a line draws both beside it, each by position', () => {
    const result = answer(
      [{ day: '2026-11-02', orders: 20 }, { day: '2026-11-03', orders: 30 }],
      {
        previous: [{ day: '2026-10-26', orders: 18 }, { day: '2026-10-27', orders: 27 }],
        lastYear: [{ day: '2025-11-03', orders: 2 }, { day: '2025-11-04', orders: 3 }],
        columns: [{ key: 'day', role: 'dimension' }, ORDERS],
      },
    )
    const view = seriesOf(result, both('line', { dimensions: ['day'] }))
    expect(view.series.map((s) => s.key)).toEqual(['s0', 'prev', 'ly'])
    expect(view.rows.map((r) => r.values)).toEqual([
      { s0: 20, prev: 18, ly: 2 },
      { s0: 30, prev: 27, ly: 3 },
    ])
  })

  it('a KPI states last year’s figure with its dates beside the previous period’s; its change stays the previous period’s', () => {
    const kpi = toKpiView(answer([{ orders: 1200 }], { previous: [{ orders: 1000 }], lastYear: [{ orders: 900 }], columns: [ORDERS] }), both('kpi', { dimensions: [] }), MODEL, 'en')
    expect(kpi.value).toBe(1200)
    expect(kpi.previous).toBe(1000)
    expect(kpi.delta).toEqual({ abs: 200, pct: 0.2, direction: 'up' })
    expect(kpi.lastYear).toEqual({ value: 900, range: 'Oct 30, 2025 – Nov 5, 2025' })
  })

  it('a KPI with last year alone states the figure and computes no change against it', () => {
    const kpi = toKpiView(answer([{ orders: 1200 }], { lastYear: [{ orders: 900 }], columns: [ORDERS] }), byRegion('kpi', { dimensions: [] }), MODEL, 'en')
    expect(kpi.lastYear).toEqual({ value: 900, range: 'Oct 30, 2025 – Nov 5, 2025' })
    expect(kpi.previous).toBeNull()
    expect(kpi.delta).toBeNull()
  })

  it('a KPI over named series states each series’ own last year', () => {
    const def = { ...byRegion('kpi', { dimensions: [] }), series: [{ id: 'a', label: label('A', 'أ'), filters: [] }, { id: 'b', label: label('B', 'ب'), filters: [] }] } as AnalyticsViewDefinition
    const columns = [{ key: 'series', role: 'series' as const }, ORDERS] as AnalyticsQueryResult['columns']
    const tiles = toKpiViews(
      answer([{ series: 'a', orders: 10 }, { series: 'b', orders: 20 }], { lastYear: [{ series: 'b', orders: 7 }, { series: 'a', orders: 4 }], columns }),
      def,
      MODEL,
      'en',
    )
    expect(tiles.map((k) => [k.series.id, k.value, k.lastYear?.value])).toEqual([
      ['a', 10, 4],
      ['b', 20, 7],
    ])
  })
})

describe('877: a "not held" area shows the note with its first day and no zero', () => {
  // Orders (the sales area) holds last year; Points (the loyalty area) starts on 1 January 2026, so it does not.
  const NOT_HELD = [{ area: 'loyalty', dataFrom: '2026-01-01', measures: ['points'] }]
  const TWO = [{ key: 'region', role: 'dimension' as const }, ORDERS, POINTS]
  const rows = [
    { region: 'Central', orders: 120, points: 900 },
    { region: 'Western', orders: 90, points: 400 },
  ]
  // As the server sends it: the not-held figure is empty on last year's rows.
  const lastYear = [
    { region: 'Central', orders: 80, points: null },
    { region: 'Western', orders: 70, points: null },
  ]
  const twoMeasures = (type: 'table' | 'bar' | 'kpi', measures = ['orders', 'points']) => byRegion(type, { measures })
  const NOTE_WORDS: LastYearNoteWords = {
    notHeld: ({ measures, day }) => `no last year for ${measures}; data starts ${day}`,
    notHeldNoDay: ({ measures }) => `no last year for ${measures}`,
  }
  const isolated = (s: string) => `⁨${s}⁩`

  it('the wire’s lastYearNotHeld is read, and is absent when the server sent none', () => {
    const read = readResult({ columns: [], rows: [], lastYear: [], lastYearPeriod: LAST_YEAR_PERIOD, lastYearNotHeld: [{ area: 'loyalty', dataFrom: '2026-01-01', measures: ['points_accrued'] }, 'junk'] })
    expect(read.lastYearNotHeld).toEqual([{ area: 'loyalty', dataFrom: '2026-01-01', measures: ['points_accrued'] }])
    expect(read.lastYear).toEqual([])
    expect('lastYearNotHeld' in readResult({ columns: [], rows: [], lastYear: [], lastYearPeriod: LAST_YEAR_PERIOD })).toBe(false)
    expect('lastYearNotHeld' in readResult({ columns: [], rows: [], lastYearNotHeld: null })).toBe(false)
  })

  it('a table gives the held figure its last-year column and the not-held figure none', () => {
    const t = panelTable(answer(rows, { lastYear, columns: TWO, notHeld: NOT_HELD }), twoMeasures('table'), MODEL, 'en', WORDS)
    expect(t.columns.map((c) => c.key)).toEqual(['region', 'orders', 'orders:lastYear', 'points'])
    expect(t.rows[0]).toEqual({ region: 'Central', orders: 120, 'orders:lastYear': 80, points: 900 })
    const form = toTableView(answer(rows, { lastYear, columns: TWO, notHeld: NOT_HELD }), twoMeasures('table'), MODEL, 'en', WORDS)
    expect(form.columns.map((c) => c.key)).toEqual(['region', 'orders', 'orders:lastYear', 'points'])
  })

  it('a zero the wire should never carry is still not drawn: the not-held figure has no last-year cell at all', () => {
    const zeros = lastYear.map((r) => ({ ...r, points: 0 }))
    const t = panelTable(answer(rows, { lastYear: zeros, columns: TWO, notHeld: NOT_HELD }), twoMeasures('table'), MODEL, 'en', WORDS)
    expect(t.columns.map((c) => c.key)).not.toContain('points:lastYear')
    expect(t.rows.every((r) => !('points:lastYear' in r))).toBe(true)
  })

  it('with no area holding last year the rows are an empty list: no column, no series, no KPI figure', () => {
    const none = answer(rows.map(({ region, points }) => ({ region, points })), { lastYear: [], columns: [{ key: 'region', role: 'dimension' }, POINTS], notHeld: NOT_HELD })
    expect(panelTable(none, twoMeasures('table', ['points']), MODEL, 'en', WORDS).columns.map((c) => c.key)).toEqual(['region', 'points'])
    expect(seriesOf(none, twoMeasures('bar', ['points'])).series.map((s) => s.key)).toEqual(['s0'])
    const kpi = toKpiView(answer([{ points: 900 }], { lastYear: [], columns: [POINTS], notHeld: NOT_HELD }), byRegion('kpi', { measures: ['points'], dimensions: [] }), MODEL, 'en')
    expect(kpi.lastYear).toBeUndefined()
  })

  it('a bar whose first figure is not held draws no last-year series for it, and a KPI states none', () => {
    const result = answer(rows, { lastYear: lastYear.map((r) => ({ ...r, points: 0 })), columns: [{ key: 'region', role: 'dimension' }, POINTS, ORDERS], notHeld: NOT_HELD })
    expect(seriesOf(result, twoMeasures('bar', ['points', 'orders'])).series.map((s) => s.key)).toEqual(['s0', 's1'])
    const kpi = toKpiView(answer([{ points: 900 }], { lastYear: [{ points: 0 }], columns: [POINTS], notHeld: NOT_HELD }), byRegion('kpi', { measures: ['points'], dimensions: [] }), MODEL, 'en')
    expect(kpi.lastYear).toBeUndefined()
  })

  it('the note names the figure and the day its data starts, each isolated whole', () => {
    const result = answer(rows, { lastYear, columns: TWO, notHeld: NOT_HELD })
    expect(lastYearNotes(result, MODEL, 'en', NOTE_WORDS)).toEqual([`no last year for ${isolated('Points')}; data starts ${isolated('Jan 1, 2026')}`])
  })

  it('one note per area, its figures listed; an entry with no day still says the figure has no last year', () => {
    const result = answer(rows, {
      lastYear: [],
      columns: TWO,
      notHeld: [
        { area: 'sales', dataFrom: '2025-12-15', measures: ['orders', 'points'] },
        { area: 'loyalty', dataFrom: '', measures: ['points'] },
      ],
    })
    expect(lastYearNotes(result, MODEL, 'en', NOTE_WORDS)).toEqual([
      `no last year for ${isolated('Orders and Points')}; data starts ${isolated('Dec 15, 2025')}`,
      `no last year for ${isolated('Points')}`,
    ])
  })

  it('no note when every area holds last year, or when last year was not asked', () => {
    expect(lastYearNotes(answer(ROWS, { lastYear: LAST_YEAR }), MODEL, 'en', NOTE_WORDS)).toEqual([])
    expect(lastYearNotes(answer(ROWS), MODEL, 'en', NOTE_WORDS)).toEqual([])
    expect(lastYearNotes(undefined, MODEL, 'en', NOTE_WORDS)).toEqual([])
  })
})

describe('877: a result without last year renders as today', () => {
  // What the server sends when last year was not asked: no `lastYear`, no `lastYearPeriod`, no `lastYearNotHeld`.
  const plain = answer(ROWS, { previous: PREVIOUS })
  const previousOnly = (type: 'table' | 'bar' | 'line' | 'kpi', over: Partial<AnalyticsViewDefinition['query']> = {}) =>
    byRegion(type, { compareToPrevious: true, compareToLastYear: undefined, ...over })

  it('the table and its downloads are the previous-period ones, with the new words passed or not', () => {
    const csv = '﻿Region,Orders,Orders · prev\r\nCentral,120,100\r\nWestern,90,100\r\nEastern,50,\r\n'
    const { lastYear: _l, ...oldWords } = WORDS
    void _l
    for (const words of [WORDS, oldWords]) {
      const t = panelTable(plain, previousOnly('table'), MODEL, 'en', words)
      expect(t.columns.map((c) => c.key)).toEqual(['region', 'orders', 'orders:previous'])
      expect(t.rows[0]).toEqual({ region: 'Central', orders: 120, 'orders:previous': 100 })
      expect(panelCsv(t)).toBe(csv)
      expect(panelSheet(t, 'Orders').data[0]).toEqual(['Region', 'Orders', 'Orders · prev'].map((value) => ({ value, fontWeight: 'bold' })))
      expect(toTableView(plain, previousOnly('table'), MODEL, 'en', words).columns.map((c) => c.key)).toEqual(['region', 'orders', 'orders:previous'])
    }
    // No comparison at all: the two columns a table always had.
    expect(panelCsv(panelTable(answer(ROWS), byRegion('table', { compareToLastYear: undefined }), MODEL, 'en', WORDS))).toBe('﻿Region,Orders\r\nCentral,120\r\nWestern,90\r\nEastern,50\r\n')
  })

  it('a bar and a line draw the series they drew, and no words change them', () => {
    const bar = toSeriesView(plain, previousOnly('bar'), MODEL, 'en')
    if (bar.kind !== 'series') throw new Error(bar.kind)
    expect(bar.series).toEqual([
      { key: 's0', member: 'orders', label: 'Orders', slot: 0, other: false, unit: 'count' },
      { key: 'prev', member: '', label: '', slot: null, other: false, unit: 'count', previous: true },
    ])
    expect(bar.rows.map((r) => r.values)).toEqual([{ s0: 120, prev: 100 }, { s0: 90, prev: 100 }, { s0: 50, prev: null }])
    expect(toSeriesView(plain, previousOnly('bar'), MODEL, 'en', SERIES_WORDS)).toEqual(bar)

    const days = answer([{ day: '2026-11-02', orders: 20 }, { day: '2026-11-03', orders: 30 }], { columns: [{ key: 'day', role: 'dimension' }, ORDERS] })
    expect(seriesOf(days, byRegion('line', { dimensions: ['day'], compareToLastYear: undefined })).series.map((s) => s.key)).toEqual(['s0'])
    expect(seriesOf(days, byRegion('line', { dimensions: ['day'], compareToLastYear: undefined })).rows.map((r) => r.values)).toEqual([{ s0: 20 }, { s0: 30 }])
  })

  it('a KPI carries no last-year figure, and a bar that never asked is still 767’s single bar', () => {
    const kpi = toKpiView(answer([{ orders: 1200 }], { previous: [{ orders: 1000 }], columns: [ORDERS] }), previousOnly('kpi', { dimensions: [] }), MODEL, 'en')
    expect(kpi).toEqual({
      kind: 'kpi',
      measure: { key: 'orders', label: 'Orders', unit: 'count', shape: 'additive' },
      format: 'auto',
      value: 1200,
      previous: 1000,
      delta: { abs: 200, pct: 0.2, direction: 'up' },
      spark: [],
      empty: false,
    })
    expect(Object.keys(kpi)).not.toContain('lastYear')
    expect(drawsAsSeries(byRegion('bar', { compareToLastYear: undefined }))).toBe(false)
  })

  it('a view that asks for last year and is answered without it draws as one that never asked', () => {
    // An older server, or an answer kept from before the switch: the option is on the definition, the fields are absent.
    const asked = byRegion('table', { compareToPrevious: true })
    expect(panelTable(plain, asked, MODEL, 'en', WORDS)).toEqual(panelTable(plain, previousOnly('table'), MODEL, 'en', WORDS))
    expect(toSeriesView(plain, byRegion('bar', { compareToPrevious: true }), MODEL, 'en', SERIES_WORDS)).toEqual(toSeriesView(plain, previousOnly('bar'), MODEL, 'en'))
    expect(lastYearNotes(plain, MODEL, 'en', { notHeld: () => 'x', notHeldNoDay: () => 'x' })).toEqual([])
    expect(lastYearRange(plain, 'en')).toBe('')
  })

  it('last year’s rows without their dates are not drawn: a last-year figure is always named with its dates', () => {
    const { lastYearPeriod: _p, ...undated } = answer(ROWS, { lastYear: LAST_YEAR })
    void _p
    expect(panelTable(undated, byRegion('table'), MODEL, 'en', WORDS).columns.map((c) => c.key)).toEqual(['region', 'orders'])
    expect(seriesOf(undated, byRegion('bar')).series.map((s) => s.key)).toEqual(['s0'])
  })

  it('the answer itself is passed on untouched: the same object, with no last-year field added', () => {
    expect(drawnResult(plain)).toBe(plain)
    const read = readResult({ columns: [], rows: [{ orders: 1 }], previous: [] })
    expect(Object.keys(read).filter((k) => k.startsWith('lastYear'))).toEqual([])
  })
})

describe('877: the export carries the last-year column', () => {
  // The screen's own words isolate the measure and the dates (`./AreaNotes` `useTableWords`); a file never holds an isolate.
  const SCREEN: TableWords = {
    series: 'Series',
    previous: (m) => `⁨${m}⁩ (previous period)`,
    lastYear: (m, range) => `⁨${m}⁩ (last year, ⁨${range}⁩)`,
  }

  it('the CSV and the xlsx write it after the measure, headed by last year’s dates, numbers as numbers', () => {
    const t = panelTable(answer(ROWS, { lastYear: LAST_YEAR }), byRegion('table'), MODEL, 'en', SCREEN)
    expect(panelCsv(t)).toBe('﻿Region,Orders,"Orders (last year, Oct 30, 2025 – Nov 5, 2025)"\r\nCentral,120,80\r\nWestern,90,70\r\nEastern,50,\r\n')
    const sheet = panelSheet(t, 'Orders')
    expect(sheet.data[0]).toEqual(['Region', 'Orders', 'Orders (last year, Oct 30, 2025 – Nov 5, 2025)'].map((value) => ({ value, fontWeight: 'bold' })))
    expect(sheet.data[1]).toEqual([{ type: String, value: 'Central' }, { type: Number, value: 120 }, { type: Number, value: 80 }])
    // No last-year row for Eastern: an empty cell, never a zero.
    expect(sheet.data[3]).toEqual([{ type: String, value: 'Eastern' }, { type: Number, value: 50 }, { type: String, value: '' }])
  })

  it('with both comparisons the file has both columns, and a not-held figure has none', () => {
    const both = panelTable(answer(ROWS, { previous: PREVIOUS, lastYear: LAST_YEAR }), byRegion('table', { compareToPrevious: true }), MODEL, 'en', SCREEN)
    expect(panelCsv(both).split('\r\n')[0]).toBe('﻿Region,Orders,Orders (previous period),"Orders (last year, Oct 30, 2025 – Nov 5, 2025)"')
    expect(panelCsv(both).split('\r\n')[1]).toBe('Central,120,100,80')

    const notHeld = panelTable(
      answer([{ region: 'Central', orders: 120, points: 900 }], {
        lastYear: [{ region: 'Central', orders: 80, points: null }],
        columns: [{ key: 'region', role: 'dimension' }, ORDERS, POINTS],
        notHeld: [{ area: 'loyalty', dataFrom: '2026-01-01', measures: ['points'] }],
      }),
      byRegion('table', { measures: ['orders', 'points'] }),
      MODEL,
      'en',
      SCREEN,
    )
    expect(panelCsv(notHeld)).toBe('﻿Region,Orders,"Orders (last year, Oct 30, 2025 – Nov 5, 2025)",Points\r\nCentral,120,80,900\r\n')
  })
})

describe('877: the labels and the note have their Arabic wording', () => {
  const at = (bundle: unknown, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), bundle)
  const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}|<\/?(\w+)>/g)].map((m) => m[0]).sort()
  const ARABIC = /[؀-ۿ]/
  const fill = (template: string, values: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? '')
  const bare = (s: string) => s.replace(/[⁨⁩]/g, '')

  it('every new sentence is written in both languages, with the same placeholders', () => {
    const NEW: [unknown, unknown, string][] = [
      [en, ar, 'view.lastYearColumn'],
      [en, ar, 'view.lastYearSeries'],
      [en, ar, 'view.lastYearNotHeld'],
      [en, ar, 'view.lastYearNotHeldNoDay'],
      [enCommon, arCommon, 'charts.kpi.lastYear'],
    ]
    for (const [e0, a0, key] of NEW) {
      const [e, a] = [at(e0, key), at(a0, key)]
      expect(typeof e === 'string' && e.trim() !== '', `en ${key}`).toBe(true)
      expect(typeof a === 'string' && ARABIC.test(a), `ar ${key}`).toBe(true)
      expect(ARABIC.test(e as string), `en ${key} is English`).toBe(false)
      expect(placeholders(a as string), `placeholders of ${key}`).toEqual(placeholders(e as string))
    }
  })

  const tableWords = (bundle: unknown): TableWords => ({
    series: at(bundle, 'view.seriesColumn') as string,
    previous: (measure) => fill(at(bundle, 'view.previousColumn') as string, { measure }),
    lastYear: (measure, range) => fill(at(bundle, 'view.lastYearColumn') as string, { measure, range }),
  })
  const seriesWords = (bundle: unknown): SeriesWords => ({ lastYear: (range) => fill(at(bundle, 'view.lastYearSeries') as string, { range }) })
  const noteWords = (bundle: unknown): LastYearNoteWords => ({
    notHeld: (v) => fill(at(bundle, 'view.lastYearNotHeld') as string, v),
    notHeldNoDay: (v) => fill(at(bundle, 'view.lastYearNotHeldNoDay') as string, v),
  })
  const both = answer(ROWS, { previous: PREVIOUS, lastYear: LAST_YEAR })

  it('a table’s last-year heading names the measure and last year’s dates, apart from the previous period’s', () => {
    const def = byRegion('table', { compareToPrevious: true })
    expect(panelTable(both, def, MODEL, 'en', tableWords(en)).columns.map((c) => c.label)).toEqual([
      'Region',
      'Orders',
      'Orders (previous period)',
      'Orders (last year, Oct 30, 2025 – Nov 5, 2025)',
    ])
    expect(panelTable(both, def, MODEL, 'ar', tableWords(ar)).columns.map((c) => c.label)).toEqual([
      'المنطقة',
      'الطلبات',
      'الطلبات (الفترة السابقة)',
      'الطلبات (العام الماضي، 30 أكتوبر 2025 – 5 نوفمبر 2025)',
    ])
  })

  it('a chart’s last-year series is named with its dates, apart from the previous period’s name', () => {
    const name = (bundle: unknown, lang: string) => {
      const view = toSeriesView(both, byRegion('bar', { compareToPrevious: true }), MODEL, lang, seriesWords(bundle))
      if (view.kind !== 'series') throw new Error(view.kind)
      return view.series.find((s) => s.lastYear)?.label
    }
    expect(name(en, 'en')).toBe('Last year (Oct 30, 2025 – Nov 5, 2025)')
    expect(name(ar, 'ar')).toBe('العام الماضي (30 أكتوبر 2025 – 5 نوفمبر 2025)')
    expect(name(en, 'en')).not.toBe(enCommon.charts.previousPeriod)
    expect(name(ar, 'ar')).not.toBe(arCommon.charts.previousPeriod)
  })

  it('a KPI’s last-year line says the figure and the dates, apart from the previous period’s line', () => {
    expect(at(enCommon, 'charts.kpi.lastYear')).toBe('versus <v>{{value}}</v> last year (<r>{{range}}</r>)')
    expect(at(arCommon, 'charts.kpi.lastYear')).toBe('مقابل <v>{{value}}</v> في العام الماضي (<r>{{range}}</r>)')
    expect(at(enCommon, 'charts.kpi.lastYear')).not.toBe(enCommon.charts.kpi.previous)
    expect(at(arCommon, 'charts.kpi.lastYear')).not.toBe(arCommon.charts.kpi.previous)
  })

  it('the "not held" note says the figure and the day its data starts, in both languages', () => {
    const result = answer(ROWS, { lastYear: [], notHeld: [{ area: 'loyalty', dataFrom: '2026-01-01', measures: ['points'] }] })
    expect(lastYearNotes(result, MODEL, 'en', noteWords(en)).map(bare)).toEqual(['Last year is not shown for Points: the data starts on Jan 1, 2026.'])
    expect(lastYearNotes(result, MODEL, 'ar', noteWords(ar)).map(bare)).toEqual(['لا يُعرض العام الماضي لـ النقاط: تبدأ البيانات في 1 يناير 2026.'])
    const noDay = answer(ROWS, { lastYear: [], notHeld: [{ area: 'loyalty', dataFrom: '', measures: ['points'] }] })
    expect(lastYearNotes(noDay, MODEL, 'en', noteWords(en)).map(bare)).toEqual(['Last year is not shown for Points: the data does not go back that far.'])
    expect(lastYearNotes(noDay, MODEL, 'ar', noteWords(ar)).map(bare)).toEqual(['لا يُعرض العام الماضي لـ النقاط: البيانات لا تعود إلى ذلك الوقت.'])
  })
})
