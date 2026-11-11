import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { CHANGE_FROMS } from '@/core/models/analytics-calculations'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { calculationLabel, type CalculationWords } from './calculations'
import { addCalculation, calculationKinds, changeFromOf, changeFroms, droppedBy, updateCalculation } from './calculations-edit'
import { comparisonsOf, editItemLink, readEditorSeed, withCompare, withLastYear } from './editor'
import { comparing as asking, effectiveQuery, panelKey, type ViewPanel } from './effective-query'
import { convertV1Board, defaultsOf } from './params'
import { readDefinition, readItem, readReport, readResult } from './wire'
import { comparing, comparingLastYear, fitted, withChoice, withComparing, withComparingLastYear } from './panel-edit'

/**
 * Ticket 876 (BackOffice spec 3587 B7, B10, B12; tickets 3604, 3605): the query builder's switch for the comparison with
 * the same weeks last year, beside the previous period's, and a `change` taken from last year. The wire names are the
 * server's: `compareToLastYear` on the query and on the request, `from: "lastYear"` on a `change`.
 */

const label = (en: string, ar: string) => ({ en, ar })

const MODEL = {
  areas: [{ key: 'sales', available: true }],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders', 'الطلبات'), description: label('', ''), dimensions: ['region', 'day'] },
    { key: 'value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Value', 'القيمة'), description: label('', ''), dimensions: ['region', 'day'] },
  ],
  dimensions: [
    { key: 'region', kind: 'category', label: label('Region', 'المنطقة'), values: [] },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم'), values: [] },
  ],
} as unknown as AnalyticsModel

const QUERY = { measures: ['orders'], dimensions: ['region'], filters: [], period: 'last-7-days' }

const table = (over: Partial<AnalyticsViewDefinition['query']> = {}): AnalyticsViewDefinition => ({ chart: { type: 'table' }, query: { ...QUERY, ...over } })

describe('876: turning the switch on puts the option in the query the builder sends', () => {
  it('the view editor stores compareToLastYear when it is on, alone or beside the previous period', () => {
    expect(withLastYear(QUERY, 'table', true)).toEqual({ ...QUERY, compareToLastYear: true })
    expect(withLastYear(withCompare(QUERY, 'table', true), 'table', true)).toEqual({ ...QUERY, compareToPrevious: true, compareToLastYear: true })
    // Either without the other: turning the previous period off leaves last year on.
    expect(withCompare(withLastYear(withCompare(QUERY, 'kpi', true), 'kpi', true), 'kpi', false)).toEqual({ ...QUERY, compareToLastYear: true })
  })

  it('the report panel editor stores it the same way, and keeps it only where the chart type compares', () => {
    const on = withComparingLastYear(table(), true, MODEL)
    expect(on.query).toEqual({ ...QUERY, compareToLastYear: true })
    expect(comparingLastYear(on)).toBe(true)
    expect(comparing(on)).toBe(false)
    // Beside the previous period, and each switch turns off alone.
    const both = withComparing(on, true, MODEL)
    expect(both.query).toEqual({ ...QUERY, compareToLastYear: true, compareToPrevious: true })
    expect(withComparing(both, false, MODEL).query).toEqual({ ...QUERY, compareToLastYear: true })
    expect(withComparingLastYear(both, false, MODEL).query).toEqual({ ...QUERY, compareToPrevious: true })
    // A re-fit keeps it on a type that compares, and takes it out with a type that does not (a donut).
    expect(fitted(both, MODEL).query).toEqual(both.query)
    const donut = withChoice(both, 'donut', MODEL)
    expect(donut.chart.type).toBe('donut')
    expect(donut.query).toEqual(QUERY)
    expect(comparingLastYear(donut)).toBe(false)
  })

  it('the request asks for last year when the definition compares to it: the preview, and a board panel by view or by item', () => {
    // The editor's preview sends `{ definition, ...asking(definition) }`.
    expect(asking(table({ compareToLastYear: true }))).toEqual({ compareToLastYear: true })
    expect(asking(table({ compareToLastYear: true, compareToPrevious: true }))).toEqual({ compareToPrevious: true, compareToLastYear: true })

    const panel = { id: 'p', kind: 'view', viewId: 'v-p', layout: { x: 0, y: 0, w: 6, h: 2 }, optOut: [] } satisfies ViewPanel
    const board = convertV1Board({ panels: [panel], filters: { period: { kind: 'relative', token: 'last-30-days' }, city: [], region: [], store: [], channel: [], country: [] } })
    const context = { ...board, values: defaultsOf(board.params), crossFilter: null }
    const source = { panel, view: table({ compareToLastYear: true }), revision: 3, model: MODEL }
    // A v1 board asks by view: the board's request carries the option, as it carries compareToPrevious.
    expect(effectiveQuery(source, context)).toEqual({ viewId: 'v-p', revision: 3, period: 'last-30-days', filters: [], compareToLastYear: true })
    // A board with its own parameters asks by item.
    expect(effectiveQuery(source, { ...context, item: { id: 'b-1', revision: 7 } })).toMatchObject({ itemId: 'b-1', revision: 7, panelId: 'p', compareToLastYear: true })
  })
})

describe('876: a saved definition with the option opens with the switch on', () => {
  // As the store returns them: the client's own JSON (BackOffice 3604 proves the option validates and round-trips).
  const saved = (query: Record<string, unknown>) => ({ chart: { type: 'table' }, query: { measures: ['orders'], dimensions: ['region'], filters: [], period: 'last-7-days', ...query } })
  const view = (query: Record<string, unknown>) => readItem({ id: 'v-1', kind: 'view', owner: 'me', tier: 'personal', revision: 4, definition: saved(query) })
  /** The view editor's switches as it opens on a saved view: the seed read from route state, as the page reads it. */
  const opened = (query: Record<string, unknown>) => comparisonsOf(readEditorSeed(editItemLink(view(query)).state)!.definition.query)

  it('the view editor opens a saved view with the last-year switch on, and the previous period switch as saved', () => {
    expect(opened({ compareToLastYear: true })).toEqual({ previous: false, lastYear: true })
    expect(opened({ compareToLastYear: true, compareToPrevious: true })).toEqual({ previous: true, lastYear: true })
    expect(opened({ compareToPrevious: true })).toEqual({ previous: true, lastYear: false })
    expect(opened({})).toEqual({ previous: false, lastYear: false })
    // Only `true` is on: the builder never guesses at another value.
    expect(opened({ compareToLastYear: 'yes' })).toEqual({ previous: false, lastYear: false })
  })

  it('a report block opens with the switch on, and the block is saved back with the option', () => {
    const report = readReport({
      id: 'r-1',
      kind: 'report',
      definition: { params: [], bindings: {}, sections: [{ id: 's1', blocks: [{ id: 'p1', kind: 'panel', title: { en: 'Orders', ar: 'الطلبات' }, definition: saved({ compareToLastYear: true }) }] }] },
    })
    const block = report.definition.sections[0].blocks[0]
    if (block.kind !== 'panel') throw new Error('a panel block')
    expect(comparingLastYear(block.definition)).toBe(true)
    expect(comparing(block.definition)).toBe(false)
    // What the designer saves is the block's definition itself: the option is still in it.
    expect(JSON.parse(JSON.stringify(block.definition)).query.compareToLastYear).toBe(true)
  })

  it('a board panel shows a saved view: its view opens with the option, and the board asks for it', () => {
    expect(asking(view({ compareToLastYear: true }).definition)).toEqual({ compareToLastYear: true })
  })
})

describe('876: a change taken from last year (BackOffice 3605)', () => {
  const selection = (compare: boolean, lastYear: boolean) => ({ measures: ['orders'], dimensions: ['region'], series: 0, compare, lastYear, calculations: [] })
  const change = (compare: boolean, lastYear: boolean) => calculationKinds(selection(compare, lastYear), MODEL).find((k) => k.kind === 'change')

  it('a change is offered once either comparison is on, and says which comparisons are on', () => {
    expect(change(false, false)).toEqual({ kind: 'change', offered: false, reason: 'needsCompare' })
    expect(change(true, false)).toEqual({ kind: 'change', offered: true })
    // Last year alone is enough: the server needs only the comparison the change is taken from.
    expect(change(false, true)).toEqual({ kind: 'change', offered: true })
    expect(changeFroms(selection(true, false))).toEqual([{ from: 'previous', on: true }, { from: 'lastYear', on: false }])
    expect(changeFroms(selection(false, true))).toEqual([{ from: 'previous', on: false }, { from: 'lastYear', on: true }])
    expect(changeFroms(selection(true, true))).toEqual([{ from: 'previous', on: true }, { from: 'lastYear', on: true }])
  })

  it('picking it turns the last-year comparison on, and the calculation names its comparison as the wire expects', () => {
    // The previous period is on, last year is not: the author adds a change from last year.
    const picked = addCalculation(table({ compareToPrevious: true }), { kind: 'change', measure: 'orders', from: 'lastYear' }, MODEL)
    expect(picked.query.compareToLastYear).toBe(true)
    expect(picked.query.compareToPrevious).toBe(true)
    expect(JSON.parse(JSON.stringify(picked.query.calculations))).toEqual([{ key: 'change_ly_orders', kind: 'change', measure: 'orders', from: 'lastYear' }])
    // Already on: it stays on, and nothing else moves.
    const already = addCalculation(table({ compareToLastYear: true }), { kind: 'change', measure: 'orders', from: 'lastYear' }, MODEL)
    expect(already.query).toEqual({ ...QUERY, compareToLastYear: true, calculations: [{ key: 'change_ly_orders', kind: 'change', measure: 'orders', from: 'lastYear' }] })
    // A kind that takes no comparison never carries `from`.
    expect(addCalculation(table(), { kind: 'shareOfTotal', measure: 'orders', from: 'lastYear' }, MODEL).query).toEqual({ ...QUERY, calculations: [{ key: 'share_orders', kind: 'shareOfTotal', measure: 'orders' }] })
  })

  it('is never kept with the last-year comparison off: switching it off takes the change out, with its own reason', () => {
    // One change from each comparison on the same measure (BackOffice 3605: a query may hold both).
    let both = addCalculation(table({ compareToPrevious: true, compareToLastYear: true }), { kind: 'change', measure: 'orders' }, MODEL)
    both = addCalculation(both, { kind: 'change', measure: 'orders', from: 'lastYear' }, MODEL)
    expect(both.query.calculations).toEqual([
      { key: 'change_orders', kind: 'change', measure: 'orders' },
      { key: 'change_ly_orders', kind: 'change', measure: 'orders', from: 'lastYear' },
    ])

    const noLastYear = withComparingLastYear(both, false, MODEL)
    expect(noLastYear.query.calculations).toEqual([{ key: 'change_orders', kind: 'change', measure: 'orders' }])
    expect(droppedBy(both, noLastYear, MODEL).map((d) => [d.calculation.key, d.reason])).toEqual([['change_ly_orders', 'lastYear']])

    const noPrevious = withComparing(both, false, MODEL)
    expect(noPrevious.query.calculations).toEqual([{ key: 'change_ly_orders', kind: 'change', measure: 'orders', from: 'lastYear' }])
    expect(droppedBy(both, noPrevious, MODEL).map((d) => [d.calculation.key, d.reason])).toEqual([['change_orders', 'compare']])

    // A chart type that shows no comparison (a combo) keeps neither the option nor the change.
    const line: AnalyticsViewDefinition = { chart: { type: 'line' }, query: { ...noPrevious.query, dimensions: ['day'] } }
    const combo = withChoice(line, 'combo', MODEL)
    expect(combo.chart.type).toBe('combo')
    expect(combo.query).toEqual({ ...QUERY, dimensions: ['day'] })
    expect(droppedBy(line, combo, MODEL).map((d) => [d.calculation.key, d.reason])).toEqual([['change_ly_orders', 'lastYear']])
  })

  it('a saved change moved to last year turns the comparison on and keeps its key; moved back, it is today’s change again', () => {
    const previous = addCalculation(table({ compareToPrevious: true }), { kind: 'change', measure: 'orders' }, MODEL)
    const moved = updateCalculation(previous, 'change_orders', { kind: 'change', measure: 'orders', from: 'lastYear' }, MODEL)
    expect(moved.query.compareToLastYear).toBe(true)
    expect(moved.query.calculations).toEqual([{ key: 'change_orders', kind: 'change', measure: 'orders', from: 'lastYear' }])
    const back = updateCalculation(moved, 'change_orders', { kind: 'change', measure: 'orders', from: 'previous' }, MODEL)
    expect(back.query.calculations).toEqual([{ key: 'change_orders', kind: 'change', measure: 'orders' }])
  })

  it('a saved change from last year opens as one, and an answer column says which comparison it was taken from', () => {
    const opened = readDefinition({
      chart: { type: 'table' },
      query: {
        ...QUERY,
        compareToPrevious: true,
        compareToLastYear: true,
        calculations: [
          { key: 'yoy', kind: 'change', measure: 'orders', from: 'lastYear' },
          { key: 'chg', kind: 'change', measure: 'orders' },
          // The server normalises an explicit "previous" to nothing; so does the reader. `from` belongs to a change only.
          { key: 'chg2', kind: 'change', measure: 'orders', from: 'previous' },
          { key: 'share', kind: 'shareOfTotal', measure: 'orders', from: 'lastYear' },
        ],
      },
    })
    expect(opened.query.calculations).toEqual([
      { key: 'yoy', kind: 'change', measure: 'orders', from: 'lastYear' },
      { key: 'chg', kind: 'change', measure: 'orders' },
      { key: 'chg2', kind: 'change', measure: 'orders' },
      { key: 'share', kind: 'shareOfTotal', measure: 'orders' },
    ])
    expect(changeFromOf(opened.query.calculations![0])).toBe('lastYear')
    expect(changeFromOf(opened.query.calculations![1])).toBe('previous')

    const answer = readResult({
      columns: [
        { key: 'yoy', role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind: 'change', measure: 'orders', from: 'lastYear' } },
        { key: 'chg', role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind: 'change', measure: 'orders' } },
      ],
    })
    expect(answer.columns.map((c) => c.calculation)).toEqual([{ kind: 'change', measure: 'orders', from: 'lastYear' }, { kind: 'change', measure: 'orders' }])
  })
})

describe('876: the answer carries last year for the screens that draw it (877, 878)', () => {
  it('reads lastYear and lastYearPeriod when the server sends them, and leaves both off when it does not', () => {
    const asked = readResult({
      columns: [{ key: 'region', role: 'dimension' }, { key: 'orders', role: 'measure' }],
      rows: [{ region: 'central', orders: 120 }],
      period: { from: '2026-11-02', to: '2026-11-08' },
      previous: null,
      lastYear: [{ region: 'central', orders: 100 }],
      lastYearPeriod: { from: '2025-11-03', to: '2025-11-09' },
    })
    expect(asked.lastYear).toEqual([{ region: 'central', orders: 100 }])
    expect(asked.lastYearPeriod).toEqual({ from: '2025-11-03', to: '2025-11-09' })
    expect(asked.previous).toEqual([])

    // The server leaves both off the wire when last year was not asked: the answer is the shape it always was.
    const today = readResult({ columns: [], rows: [], period: { from: '2026-11-02', to: '2026-11-08' }, previous: [] })
    expect('lastYear' in today).toBe(false)
    expect('lastYearPeriod' in today).toBe(false)
    // Asked and nothing held: an empty list is still an answer, not an absence.
    expect(readResult({ lastYear: [], lastYearPeriod: { from: '2025-11-03', to: '2025-11-09' } }).lastYear).toEqual([])
  })
})

describe('876: a definition that does not ask for last year is saved and sent exactly as today', () => {
  // Written out by hand, as the save sent it before 876: a table compared with the previous period, with its change.
  const SAVED =
    '{"chart":{"type":"table"},"query":{"measures":["orders"],"dimensions":["region"],"filters":[],"period":"last-7-days","compareToPrevious":true,"calculations":[{"key":"change_orders","kind":"change","measure":"orders"}]}}'
  const PLAIN = '{"chart":{"type":"table"},"query":{"measures":["orders"],"dimensions":["region"],"filters":[],"period":"last-7-days"}}'
  const today = (): AnalyticsViewDefinition => JSON.parse(SAVED)

  it('the builder builds today’s definition, byte for byte, when last year is never touched', () => {
    const built = addCalculation(withComparing(table(), true, MODEL), { kind: 'change', measure: 'orders' }, MODEL)
    expect(JSON.stringify(built)).toBe(SAVED)
    // Naming the previous period outright writes nothing more.
    expect(JSON.stringify(addCalculation(withComparing(table(), true, MODEL), { kind: 'change', measure: 'orders', from: 'previous' }, MODEL))).toBe(SAVED)
    expect(JSON.stringify(table())).toBe(PLAIN)
  })

  it('opening it, re-fitting it and leaving the switch off change nothing', () => {
    expect(JSON.stringify(readDefinition(JSON.parse(SAVED)))).toBe(SAVED)
    expect(JSON.stringify(fitted(today(), MODEL))).toBe(SAVED)
    expect(JSON.stringify(withComparingLastYear(today(), false, MODEL))).toBe(SAVED)
    // The view editor's own step (it re-stores compareToPrevious last, as it did before 876): the switch off adds nothing.
    expect(JSON.stringify(withLastYear(withCompare(today().query, 'table', true), 'table', false))).toBe(
      '{"measures":["orders"],"dimensions":["region"],"filters":[],"period":"last-7-days","calculations":[{"key":"change_orders","kind":"change","measure":"orders"}],"compareToPrevious":true}',
    )
    expect(JSON.stringify(fitted(JSON.parse(PLAIN), MODEL))).toBe(PLAIN)
    // Switched on and off again, it is today's definition once more.
    expect(JSON.stringify(withComparingLastYear(withComparingLastYear(today(), true, MODEL), false, MODEL))).toBe(SAVED)
  })

  it('the request, and so the panel’s cache key, are today’s', () => {
    const panel = { id: 'p', kind: 'view', viewId: 'v-p', layout: { x: 0, y: 0, w: 6, h: 2 }, optOut: [] } satisfies ViewPanel
    const board = convertV1Board({ panels: [panel], filters: { period: { kind: 'relative', token: 'last-30-days' }, city: [], region: [], store: [], channel: [], country: [] } })
    const context = { ...board, values: defaultsOf(board.params), crossFilter: null }
    const ask = (view: AnalyticsViewDefinition) => effectiveQuery({ panel, view, revision: 3, model: MODEL }, context)
    expect(JSON.stringify(ask(today()))).toBe('{"viewId":"v-p","revision":3,"period":"last-30-days","filters":[],"compareToPrevious":true}')
    expect(JSON.stringify(ask(JSON.parse(PLAIN)))).toBe('{"viewId":"v-p","revision":3,"period":"last-30-days","filters":[]}')
    expect(panelKey(ask(today()))).toBe('{"compareToPrevious":true,"filters":[],"period":"last-30-days","revision":3,"viewId":"v-p"}')
    // The editor's preview: `{ definition, ...asking(definition) }`.
    expect(JSON.stringify({ definition: today(), ...asking(today()) })).toBe(`{"definition":${SAVED},"compareToPrevious":true}`)
    expect(JSON.stringify({ definition: JSON.parse(PLAIN), ...asking(JSON.parse(PLAIN)) })).toBe(`{"definition":${PLAIN}}`)
  })
})

describe('876: the switch and the choice have their words in English and in Arabic', () => {
  const at = (bundle: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), bundle)
  const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
  const ARABIC = /[؀-ۿ]/

  const NEW = [
    // The switch, beside "Compare with the previous period".
    'editor.compareLastYear',
    'editor.compareLastYearHint',
    // The choice on a change, and what picking one whose comparison is off does.
    'editor.calc.from',
    ...CHANGE_FROMS.map((from) => `editor.calc.fromName.${from}`),
    ...CHANGE_FROMS.map((from) => `editor.calc.fromTurnsOn.${from}`),
    // The note when the switch going off takes a change out, and the column's default name.
    'editor.calc.dropped.lastYear',
    'calculation.label.changeLastYear',
  ]

  it('every new sentence is written in both languages, with the same placeholders', () => {
    for (const key of NEW) {
      const [e, a] = [at(en, key), at(ar, key)]
      expect(typeof e === 'string' && e.trim() !== '', `en ${key}`).toBe(true)
      expect(typeof a === 'string' && ARABIC.test(a), `ar ${key}`).toBe(true)
      expect(ARABIC.test(e as string), `en ${key} is English`).toBe(false)
      expect(placeholders(a as string), `placeholders of ${key}`).toEqual(placeholders(e as string))
    }
  })

  it('the switch reads as last year’s, apart from the previous period’s, in both languages', () => {
    expect(en.editor.compareLastYear).toBe('Compare with the same weeks last year')
    expect(ar.editor.compareLastYear).toBe('المقارنة بالأسابيع نفسها من العام الماضي')
    expect(en.editor.compareLastYear).not.toBe(en.editor.compare)
    expect(ar.editor.compareLastYear).not.toBe(ar.editor.compare)
    // A change no longer needs the previous period alone: the reason names both comparisons.
    expect(en.editor.calc.why.needsCompare).toContain('last year')
    expect(ar.editor.calc.why.needsCompare).toContain('العام الماضي')
  })

  it('a change from last year is named apart from a change from the previous period, in both languages', () => {
    const fill = (template: string, values: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? '')
    const wordsOf = (bundle: typeof en): CalculationWords => ({
      shareOfTotal: (v) => fill(bundle.calculation.label.shareOfTotal, v),
      ratio: (v) => fill(bundle.calculation.label.ratio, v),
      cumulativeShare: (v) => fill(bundle.calculation.label.cumulativeShare, v),
      change: (v) => fill(bundle.calculation.label.change, v),
      average: (v) => fill(bundle.calculation.label.average, v),
      shareOfTotalWithin: (v) => fill(bundle.calculation.label.shareOfTotalWithin, v),
      cumulativeShareWithin: (v) => fill(bundle.calculation.label.cumulativeShareWithin, v),
      changeLastYear: (v) => fill(at(bundle, 'calculation.label.changeLastYear') as string, v),
    })
    const name = (from: 'lastYear' | undefined, lang: string) => calculationLabel({ kind: 'change', measure: 'orders', ...(from ? { from } : {}) }, null, MODEL, lang, wordsOf(lang === 'ar' ? ar : en))
    expect(name('lastYear', 'en')).toBe('Change in Orders from last year')
    expect(name('lastYear', 'ar')).toBe('التغير في الطلبات عن العام الماضي')
    // A change from the previous period keeps the name it had.
    expect(name(undefined, 'en')).toBe('Change in Orders')
    expect(name(undefined, 'ar')).toBe('التغير في الطلبات')
    // The author's own label still wins.
    expect(calculationLabel({ kind: 'change', measure: 'orders', from: 'lastYear' }, { en: 'YoY', ar: 'سنوي' }, MODEL, 'ar', wordsOf(ar))).toBe('سنوي')
  })
})
