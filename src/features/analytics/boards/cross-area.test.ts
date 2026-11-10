import { describe, expect, it } from 'vitest'
import { FSI, PDI } from '@/core/util/bidi'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsRow, AnalyticsViewDefinition } from '@/core/models/analytics'
import { panelCsv, panelSheet, panelTable } from './panel-table'
import { toKpiView, toSeriesView } from './series-view'
import { allowedDimensions, MAX_AREAS, pickerSubjects, queryAreas, unsplitFigures } from './editor'
import { areaNotes, columnTooltip, drawnResult, type AreaNoteWords } from './unsplit'
import { canBind } from './bindings'
import { panelArea } from './panel-edit'
import { queryMeasureName, settleVariants, variantMeasures } from './variants'
import { toBarView } from './view-model'
import { toComboView, toDonutView, toHeatmapView, toTableView } from './view-model-forms'
import { readResult } from './wire'

// Ticket 864 (BackOffice spec 3543 parts C and D): the wire as SIS.Api spec3543 sends it (AnalyticsWire.cs, 3548/3549/3550).
const RAW = {
  columns: [
    { key: 'region', role: 'dimension' },
    { key: 'category', role: 'dimension' },
    { key: 'till_sales', role: 'measure', shape: 'additive', unit: 'count', dateBasis: { en: 'By business date', ar: 'حسب تاريخ العمل' } },
    { key: 'deliveries', role: 'measure', shape: 'additive', unit: 'count', dateBasis: { en: 'By the day the delivery was created', ar: 'حسب يوم إنشاء التوصيل' } },
    { key: 'perSale', role: 'measure', shape: 'rate', unit: 'count', calculation: { kind: 'average', measure: 'deliveries', of: 'till_sales' } },
  ],
  rows: [
    { region: 'E', category: 'otc', till_sales: 10, deliveries: null, perSale: null },
    { region: 'E', category: null, till_sales: null, deliveries: 4, perSale: null, isTotal: true },
  ],
  total: 2,
  truncated: false,
  notSplit: [{ measure: 'deliveries', by: ['category'] }],
  notFiltered: [{ measure: 'deliveries', by: ['category'] }],
}

describe('the cross-area wire (spec 3543 decisions 9, 12, 14, 18)', () => {
  it('reads notSplit, notFiltered, a column dateBasis and the average kind; the isTotal row passes through', () => {
    const r = readResult(RAW)
    expect(r.notSplit).toEqual([{ measure: 'deliveries', by: ['category'] }])
    expect(r.notFiltered).toEqual([{ measure: 'deliveries', by: ['category'] }])
    expect(r.columns[2].dateBasis).toEqual({ en: 'By business date', ar: 'حسب تاريخ العمل' })
    expect(r.columns[4].calculation).toEqual({ kind: 'average', measure: 'deliveries', of: 'till_sales' })
    expect(r.rows[1].isTotal).toBe(true)
  })

  it('a one-area result keeps the shape it always had: no notSplit, notFiltered or dateBasis keys', () => {
    const r = readResult({ columns: [{ key: 'orders', role: 'measure', dateBasis: null }], rows: [], notSplit: null, notFiltered: null })
    expect('notSplit' in r).toBe(false)
    expect('notFiltered' in r).toBe(false)
    expect(r.columns[0].dateBasis ?? null).toBeNull()
  })
})

// ── "All" rows (decision 12, owner: kept apart) ────────────────────────────────────────────────────────────

const MODEL = {
  areas: [{ key: 'till', available: true }, { key: 'delivery', available: true }],
  measures: [
    { key: 'till_sales', area: 'till', shape: 'additive', unit: 'count', label: { en: 'Till sales', ar: 'مبيعات الصندوق' }, description: { en: '', ar: '' }, dimensions: ['region', 'category'] },
    { key: 'deliveries', area: 'delivery', shape: 'additive', unit: 'count', label: { en: 'Deliveries', ar: 'التوصيلات' }, description: { en: '', ar: '' }, dimensions: ['region'] },
  ],
  dimensions: [
    { key: 'region', kind: 'category', label: { en: 'Region', ar: 'المنطقة' }, values: [{ key: 'E', label: { en: 'Eastern', ar: 'الشرقية' } }, { key: 'C', label: { en: 'Central', ar: 'الوسطى' } }] },
    { key: 'category', kind: 'category', label: { en: 'Category', ar: 'الفئة' }, values: [] },
  ],
} as unknown as AnalyticsModel

type ChartType = AnalyticsViewDefinition['chart']['type']
const crossDef = (type: ChartType, dimensions = ['region', 'category'], chart: Partial<AnalyticsViewDefinition['chart']> = {}, measures = ['till_sales', 'deliveries']): AnalyticsViewDefinition =>
  ({ chart: { type, ...chart }, query: { measures, dimensions, filters: [] } }) as AnalyticsViewDefinition

// "Till sales and deliveries by region and category": deliveries split by region only, one "All" row per region. The
// "All" rows sit BETWEEN split rows here on purpose: the web keeps them apart itself, it does not trust the order.
const SPLIT_AND_ALL: AnalyticsRow[] = [
  { region: 'E', category: 'otc', till_sales: 10, deliveries: null },
  { region: 'E', category: null, till_sales: null, deliveries: 4, isTotal: true },
  { region: 'C', category: 'otc', till_sales: 30, deliveries: null },
  { region: 'E', category: 'rx', till_sales: 20, deliveries: null },
  { region: 'C', category: null, till_sales: null, deliveries: 9, isTotal: true },
]
const crossResult = (rows: AnalyticsRow[] = SPLIT_AND_ALL, extra: Partial<AnalyticsQueryResult> = {}): AnalyticsQueryResult => ({
  columns: [
    { key: 'region', role: 'dimension' },
    { key: 'category', role: 'dimension' },
    { key: 'till_sales', role: 'measure', shape: 'additive', unit: 'count', dateBasis: { en: 'By business date', ar: 'حسب تاريخ العمل' } },
    { key: 'deliveries', role: 'measure', shape: 'additive', unit: 'count', dateBasis: { en: 'By the day the delivery was created', ar: 'حسب يوم إنشاء التوصيل' } },
  ],
  rows,
  total: rows.length,
  truncated: false,
  period: null,
  previous: [],
  fetchedAt: '',
  dataAsOf: '',
  notSplit: [{ measure: 'deliveries', by: ['category'] }],
  ...extra,
})

describe('"All" rows are listed last in the table and the exports', () => {
  it("the panel table keeps the split rows in the answer's order, then every \"All\" row, its unsplit cell named \"All\"", () => {
    const t = panelTable(crossResult(), crossDef('bar'), MODEL, 'en', { series: 'Series', all: 'All' })
    expect(t.rows).toEqual([
      { region: 'Eastern', category: 'otc', till_sales: 10, deliveries: null },
      { region: 'Central', category: 'otc', till_sales: 30, deliveries: null },
      { region: 'Eastern', category: 'rx', till_sales: 20, deliveries: null },
      { region: 'Eastern', category: 'All', till_sales: null, deliveries: 4 },
      { region: 'Central', category: 'All', till_sales: null, deliveries: 9 },
    ])
  })
  it('the CSV and the xlsx sheet carry the same order', () => {
    const t = panelTable(crossResult(), crossDef('bar'), MODEL, 'ar', { series: 'السلسلة', all: 'الكل' })
    const csv = panelCsv(t).split('\r\n')
    expect(csv.slice(4, 6)).toEqual(['الشرقية,الكل,,4', 'الوسطى,الكل,,9'])
    const sheet = panelSheet(t, 'x')
    expect(sheet.data.slice(4).map((r) => r.map((c) => (c as { value: unknown }).value))).toEqual([
      ['الشرقية', 'الكل', '', 4],
      ['الوسطى', 'الكل', '', 9],
    ])
  })
  it('the table form sorts and cuts the split rows only, then lists every "All" row, never clickable', () => {
    const v = toTableView(crossResult(), crossDef('table', ['region', 'category'], { sort: { key: 'till_sales', direction: 'desc' }, topN: 2 }), MODEL, 'en', { series: 'Series', all: 'All' })
    expect(v.rows.map((r) => [r.region, r.category, r.till_sales, r.deliveries])).toEqual([
      ['Central', 'otc', 30, null],
      ['Eastern', 'rx', 20, null],
      ['Eastern', 'All', null, 4],
      ['Central', 'All', null, 9],
    ])
    expect(v.cut).toBe(true)
    // A row click cross-filters by `members[i]`: an "All" row has none.
    expect(v.members).toEqual(['C', 'E'])
  })
})

describe('"All" rows are never a bar, slice or point', () => {
  // By region alone with no region in the delivery area: one "All" row for the whole result (decision 12).
  const byRegion = (): AnalyticsQueryResult =>
    crossResult(
      [
        { region: 'E', till_sales: 10, deliveries: 3 },
        { region: null, till_sales: null, deliveries: 99, isTotal: true },
        { region: 'C', till_sales: 30, deliveries: 1 },
      ],
      { previous: [{ region: null, till_sales: null, deliveries: 50, isTotal: true }] },
    )
  it('a bar', () => {
    const v = toBarView(byRegion(), crossDef('bar', ['region']), MODEL, 'en')
    expect(v.points.map((p) => p.member)).toEqual(['E', 'C'])
  })
  it('a series form (a bar of two measures)', () => {
    const v = toSeriesView(byRegion(), crossDef('bar', ['region']), MODEL, 'en')
    expect(v.kind).not.toBe('refused')
    expect(JSON.stringify(v)).not.toContain('99')
  })
  it('a donut, a heatmap and a combo', () => {
    expect(JSON.stringify(toDonutView(byRegion(), crossDef('donut', ['region'], {}, ['deliveries']), MODEL, 'en'))).not.toContain('99')
    expect(JSON.stringify(toHeatmapView(crossResult(), crossDef('heatmap', ['region', 'category'], {}, ['deliveries']), MODEL, 'en'))).not.toMatch(/"value":(4|9)\b/)
    expect(JSON.stringify(toComboView(byRegion(), crossDef('combo', ['region']), MODEL, 'en'))).not.toContain('99')
  })
  it('a KPI does not add an "All" row into its figure, nor its previous', () => {
    const v = toKpiView(byRegion(), crossDef('kpi', [], {}, ['deliveries']), MODEL, 'en')
    expect(v.value).toBe(4)
    expect(v.previous).toBeNull()
  })
  it('a one-area result is drawn untouched (the same object)', () => {
    const one = crossResult([{ region: 'E', till_sales: 1, deliveries: 1 }])
    expect(drawnResult(one)).toBe(one)
  })
})

// ── The panel notes and the header tooltip (decisions 12, 14, 18) ───────────────────────────────────────────

const fill = (template: string, values: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? '')
const noteWords = (bundle: typeof en): AreaNoteWords => ({
  notSplit: (v) => fill(bundle.view.unsplit.notSplit, v),
  notFiltered: (v) => fill(bundle.view.unsplit.notFiltered, v),
  totalIn: (v) => fill(bundle.view.unsplit.totalIn, v),
  total: (v) => fill(bundle.view.unsplit.total, v),
})
const iso = (s: string) => `${FSI}${s}${PDI}`

describe('the notSplit note carries the sentence and the totals', () => {
  it('EN: "Deliveries cannot be split by Category", then each region total, formatted by the unit', () => {
    const n = areaNotes(crossDef('bar'), crossResult(), MODEL, 'en', noteWords(en))
    expect(n.notSplit).toEqual([
      { measure: 'deliveries', sentence: `${iso('Deliveries')} cannot be split by ${iso('Category')}.`, totals: [`In ${iso('Eastern')}: ${iso('4')}`, `In ${iso('Central')}: ${iso('9')}`] },
    ])
    expect(n.notFiltered).toEqual([])
  })
  it('AR: the same note in Arabic, the parent and the number isolated', () => {
    const n = areaNotes(crossDef('bar'), crossResult(), MODEL, 'ar', noteWords(ar))
    expect(n.notSplit[0].sentence).toBe(`لا يمكن تقسيم ${iso('التوصيلات')} حسب ${iso('الفئة')}.`)
    expect(n.notSplit[0].totals).toEqual([`في ${iso('الشرقية')}: ${iso('4')}`, `في ${iso('الوسطى')}: ${iso('9')}`])
  })
  it('an "All" row for the whole result reads as the total', () => {
    const r = crossResult([{ region: 'E', till_sales: 10, deliveries: null }, { region: null, till_sales: null, deliveries: 1234, isTotal: true }], { notSplit: [{ measure: 'deliveries', by: ['region'] }] })
    expect(areaNotes(crossDef('bar', ['region']), r, MODEL, 'en', noteWords(en)).notSplit[0].totals).toEqual([`Total: ${iso('1,234')}`])
  })
  it('a table lists its totals as its own "All" rows, so its note is the sentence alone (local walk 2026-11-10)', () => {
    const n = areaNotes(crossDef('table'), crossResult(), MODEL, 'en', noteWords(en))
    expect(n.notSplit.map((x) => x.totals)).toEqual([[]])
    expect(n.notSplit[0].sentence).toBe(`${iso('Deliveries')} cannot be split by ${iso('Category')}.`)
  })
  it('no notes on a one-area result', () => {
    expect(areaNotes(crossDef('bar'), crossResult([], { notSplit: undefined }), MODEL, 'en', noteWords(en))).toEqual({ notSplit: [], notFiltered: [] })
  })
})

describe('the notFiltered note (decision 18)', () => {
  const r = crossResult(SPLIT_AND_ALL, { notFiltered: [{ measure: 'deliveries', by: ['category', 'region'] }] })
  it('EN and AR: the figure is marked "not filtered by" its dimensions', () => {
    expect(areaNotes(crossDef('bar'), r, MODEL, 'en', noteWords(en)).notFiltered).toEqual([`${iso('Deliveries')} is not filtered by ${iso('Category and Region')}.`])
    expect(areaNotes(crossDef('bar'), r, MODEL, 'ar', noteWords(ar)).notFiltered).toEqual([`لم يُطبَّق ترشيح ${iso('الفئة والمنطقة')} على ${iso('التوصيلات')}.`])
  })
  it('the mark is on the column header of the figure too', () => {
    expect(columnTooltip('deliveries', r, MODEL, 'en', noteWords(en))).toContain(`${iso('Deliveries')} is not filtered by ${iso('Category and Region')}.`)
  })
})

describe('dateBasis in the column header tooltip of a cross-area panel (decision 14)', () => {
  it('each measure column says what its dates mean, in EN and AR; a dimension or a one-area column says nothing', () => {
    expect(columnTooltip('till_sales', crossResult(), MODEL, 'en', noteWords(en))).toBe('By business date')
    expect(columnTooltip('deliveries', crossResult(), MODEL, 'ar', noteWords(ar))).toBe('حسب يوم إنشاء التوصيل')
    expect(columnTooltip('region', crossResult(), MODEL, 'en', noteWords(en))).toBeUndefined()
    const one = crossResult([], { columns: [{ key: 'till_sales', role: 'measure' }] })
    expect(columnTooltip('till_sales', one, MODEL, 'en', noteWords(en))).toBeUndefined()
  })
  it('the panel table and the table form put it on the column', () => {
    const t = panelTable(crossResult(), crossDef('bar'), MODEL, 'en', { series: 'Series', all: 'All', tooltip: (k) => columnTooltip(k, crossResult(), MODEL, 'en', noteWords(en)) })
    expect(t.columns.find((c) => c.key === 'till_sales')?.tooltip).toBe('By business date')
    const v = toTableView(crossResult(), crossDef('table'), MODEL, 'en', { series: 'Series', all: 'All', tooltip: (k) => columnTooltip(k, crossResult(), MODEL, 'en', noteWords(en)) })
    expect(v.columns.find((c) => c.key === 'deliveries')?.tooltip).toBe('By the day the delivery was created')
  })
})

// ── The editor (decision 30): measures from every area, grouped, up to 4 areas ─────────────────────────────

const area = (key: string) => ({ key, available: true })
const measure = (key: string, a: string, dimensions: string[]) => ({ key, area: a, shape: 'additive', unit: 'count', label: { en: key, ar: key }, description: { en: '', ar: '' }, dimensions })
const FIVE = {
  areas: ['till', 'delivery', 'orders', 'claims', 'items'].map(area),
  measures: [
    measure('till_sales', 'till', ['region', 'category', 'day']),
    measure('till_value', 'till', ['region', 'category', 'day']),
    measure('return_rate', 'till', ['region', 'day']),
    measure('deliveries', 'delivery', ['region', 'day']),
    measure('orders', 'orders', ['region', 'channel', 'day']),
    measure('claims', 'claims', ['region', 'day']),
    measure('items_sold', 'items', ['category', 'day']),
  ],
  dimensions: [
    { key: 'day', kind: 'time', label: { en: 'Day', ar: 'اليوم' }, values: [] },
    { key: 'region', kind: 'category', label: { en: 'Region', ar: 'المنطقة' }, values: [] },
    { key: 'category', kind: 'category', label: { en: 'Category', ar: 'الفئة' }, values: [] },
    { key: 'channel', kind: 'category', label: { en: 'Channel', ar: 'القناة' }, values: [] },
  ],
} as unknown as AnalyticsModel

describe('the measure picker groups by area and stops at 4 areas', () => {
  it('lists every area, the chosen ones first in the order they were chosen, nothing blocked under 4', () => {
    const groups = pickerSubjects(FIVE, ['deliveries', 'till_sales'], '', 'en')
    expect(groups.map((g) => g.area)).toEqual(['delivery', 'till', 'orders', 'claims', 'items'])
    expect(groups.flatMap((g) => g.measures).every((m) => m.blocked === null)).toBe(true)
  })
  it('with 4 areas chosen, a fifth area is blocked (the server refuses it, 406) and the 4 stay open', () => {
    const chosen = ['till_sales', 'deliveries', 'orders', 'claims']
    expect(queryAreas(chosen, FIVE)).toEqual(['till', 'delivery', 'orders', 'claims'])
    expect(MAX_AREAS).toBe(4)
    const groups = pickerSubjects(FIVE, chosen, '', 'en')
    expect(groups.find((g) => g.area === 'items')!.measures.map((m) => m.blocked)).toEqual(['tooManyAreas'])
    expect(groups.find((g) => g.area === 'till')!.measures.map((m) => m.blocked)).toEqual([null, null, null])
  })
})

describe('the dimension picker offers every dimension of the chosen areas, and marks what it will not split', () => {
  it('a dimension any chosen area has is offered; one no chosen area has is not', () => {
    expect(allowedDimensions(['till_sales', 'deliveries'], FIVE).map((d) => d.key)).toEqual(['day', 'region', 'category'])
  })
  it("a measure's own area having the dimension but the measure not (notBy) still keeps it off", () => {
    // return_rate is till's, and till breaks down by category: the server refuses notBy on the measure's own area.
    expect(allowedDimensions(['till_sales', 'return_rate', 'deliveries'], FIVE).map((d) => d.key)).toEqual(['day', 'region'])
  })
  it('names the figures a dimension will not split', () => {
    expect(unsplitFigures('category', ['till_sales', 'deliveries', 'claims'], FIVE)).toEqual(['deliveries', 'claims'])
    expect(unsplitFigures('region', ['till_sales', 'deliveries'], FIVE)).toEqual([])
  })
})

describe('a filtered measure may be of any area, within the 4', () => {
  const d = (measures: string[]): AnalyticsViewDefinition => ({ chart: { type: 'table' }, query: { measures, dimensions: ['region'], filters: [] } })
  it('offers the measures of every area while fewer than 4 are chosen, then only of the 4', () => {
    expect(variantMeasures(d(['till_sales']), FIVE)).toContain('deliveries')
    expect(variantMeasures(d(['till_sales', 'deliveries', 'orders', 'claims']), FIVE)).not.toContain('items_sold')
  })
  it('a variant of another area is kept when the query settles', () => {
    const def: AnalyticsViewDefinition = { ...d(['till_sales', 'del_DL']), query: { ...d(['till_sales', 'del_DL']).query, variants: [{ key: 'del_DL', measure: 'deliveries', filters: [{ dimension: 'channel', values: ['app'] }] }] } }
    expect(settleVariants(def, FIVE).dropped).toEqual([])
  })
})

// ── 863's gap: a query whose only measures are variants ───────────────────────────────────────────────────

describe('a query whose only measures are variants (863 gap)', () => {
  const onlyVariant: AnalyticsViewDefinition = {
    chart: { type: 'bar' },
    query: { measures: ['del_app'], dimensions: ['region'], filters: [], variants: [{ key: 'del_app', measure: 'deliveries', filters: [{ dimension: 'channel', values: ['app'] }] }] },
  }
  const word = (v: { measure: string; values: string }) => `${v.measure} (${v.values})`
  it('the generated title names the variant, not a retired measure', () => {
    expect(queryMeasureName(onlyVariant, FIVE, 'en', word)).toBe('deliveries (app)')
    expect(queryMeasureName({ ...onlyVariant, query: { ...onlyVariant.query, measures: [] } }, FIVE, 'en', word)).toBe('')
  })
  it("the report panel's area is the variant's measure's", () => {
    expect(panelArea(onlyVariant, FIVE)).toBe('delivery')
  })
})

// ── Parameters on a mixed panel (server 3551: members binds when SOME area has the dimension; a variant key reads as its measure) ──

describe('a members parameter on a mixed or variant-only panel (3551)', () => {
  const members = { name: 'cat', kind: 'members', label: { en: '', ar: '' }, required: false, dimension: 'category', pinned: null, multi: true, default: { kind: 'members', values: [] } } as unknown as Parameters<typeof canBind>[0]
  it('binds when some area of the panel has the dimension', () => {
    const mixed: AnalyticsViewDefinition = { chart: { type: 'bar' }, query: { measures: ['deliveries', 'till_sales'], dimensions: ['region'], filters: [] } }
    expect(canBind(members, mixed, FIVE)).toEqual({ ok: true, target: 'category' })
  })
  it('binds on a panel whose only measure is a variant, read as its measure', () => {
    const v: AnalyticsViewDefinition = {
      chart: { type: 'bar' },
      query: { measures: ['till_app'], dimensions: ['region'], filters: [], variants: [{ key: 'till_app', measure: 'till_sales', filters: [{ dimension: 'channel', values: ['app'] }] }] },
    }
    expect(canBind(members, v, FIVE)).toEqual({ ok: true, target: 'category' })
  })
})
