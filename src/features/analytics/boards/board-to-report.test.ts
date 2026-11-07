import { describe, expect, it } from 'vitest'
import type { AnalyticsBoard, AnalyticsItem, AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { boardToReport } from './board-to-report'

const label = (en: string, ar = '') => ({ en, ar })
const def = (measure: string): AnalyticsViewDefinition => ({ chart: { type: 'kpi' }, query: { measures: [measure], dimensions: [], filters: [] } })
const view = (id: string, revision: number, measure: string, title = label(`View ${id}`)): AnalyticsItem => ({
  id,
  kind: 'view',
  title,
  subtitle: label(''),
  owner: 'msartawi',
  tier: 'shared',
  sourceChangedSinceCopy: false,
  revision,
  updatedAt: '2026-11-05T10:00:00',
  updatedBy: 'msartawi',
  definition: def(measure),
})
const board = (definition: AnalyticsBoard['definition']): AnalyticsBoard => ({
  id: 'b1',
  kind: 'board',
  title: label('Operations week', 'أسبوع العمليات'),
  subtitle: label('Every store', 'كل الفروع'),
  owner: 'curator1',
  tier: 'certified',
  sourceChangedSinceCopy: false,
  revision: 4,
  updatedAt: '2026-11-05T10:00:00',
  updatedBy: 'curator1',
  definition,
})
const at = (x: number, y: number) => ({ x, y, w: 4, h: 3 })
const VIEWS = new Map([
  ['v-a', view('v-a', 3, 'orders')],
  ['v-b', view('v-b', 7, 'till_value', label('Till value', 'قيمة نقاط البيع'))],
  ['v-c', view('v-c', 1, 'deliveries')],
])

// orders breaks down by store and city; till_value by store only; deliveries by city only.
const MODEL = {
  measures: [
    { key: 'orders', dimensions: ['store', 'city'] },
    { key: 'till_value', dimensions: ['store'] },
    { key: 'deliveries', dimensions: ['city'] },
  ],
} as unknown as AnalyticsModel

describe('boardToReport', () => {
  it('reads the panels row by row, then by logical column, into the report in that order', () => {
    const { create } = boardToReport(
      board({
        panels: [
          { id: 'p-c', kind: 'view', viewId: 'v-c', layout: at(0, 4), optOut: [] },
          { id: 'p-b', kind: 'view', viewId: 'v-b', layout: at(4, 1), optOut: [] },
          { id: 'p-a', kind: 'view', viewId: 'v-a', layout: at(0, 1), optOut: [] },
          { id: 't-1', kind: 'text', text: label('HQ only', 'للإدارة فقط'), layout: at(4, 4) },
        ],
      }),
      VIEWS,
      MODEL,
    )
    expect(create.kind).toBe('report')
    expect(create.definition.sections).toHaveLength(1)
    expect(create.definition.sections[0].blocks.map((b) => b.id)).toEqual(['p-a', 'p-b', 'p-c', 't-1'])
  })

  it('copies each view panel inline with its provenance, and a text panel as a text block', () => {
    const { create } = boardToReport(
      board({
        panels: [
          { id: 'p-b', kind: 'view', viewId: 'v-b', layout: at(0, 0), optOut: [] },
          { id: 't-1', kind: 'text', text: label('HQ only', 'للإدارة فقط'), layout: at(0, 3) },
        ],
      }),
      VIEWS,
      MODEL,
    )
    expect(create.definition.sections[0].blocks).toEqual([
      { id: 'p-b', kind: 'panel', title: { en: 'Till value', ar: 'قيمة نقاط البيع' }, definition: def('till_value'), from: { viewId: 'v-b', revision: 7 } },
      { id: 't-1', kind: 'text', text: { en: 'HQ only', ar: 'للإدارة فقط' } },
    ])
  })

  it("titles the report as the board, and copies the view's definition rather than sharing it", () => {
    const { create } = boardToReport(board({ panels: [{ id: 'p-a', kind: 'view', viewId: 'v-a', layout: at(0, 0), optOut: [] }] }), VIEWS, MODEL)
    expect(create.title).toEqual({ en: 'Operations week', ar: 'أسبوع العمليات' })
    expect(create.subtitle).toEqual({ en: 'Every store', ar: 'كل الفروع' })
    const block = create.definition.sections[0].blocks[0]
    expect(block.kind === 'panel' && block.definition).not.toBe(VIEWS.get('v-a')!.definition)
  })

  it('makes each section panel a heading: the blocks after it fall under it', () => {
    const { create } = boardToReport(
      board({
        panels: [
          { id: 'p-a', kind: 'view', viewId: 'v-a', layout: at(0, 0), optOut: [] },
          { id: 'h-1', kind: 'section', title: label('Delivery', 'التوصيل'), layout: at(0, 3) },
          { id: 'p-c', kind: 'view', viewId: 'v-c', layout: at(0, 4), optOut: [] },
          { id: 'h-2', kind: 'section', title: label('Notes', 'ملاحظات'), layout: at(0, 7) },
        ],
      }),
      VIEWS,
      MODEL,
    )
    expect(create.definition.sections.map((s) => [s.id, s.heading.en, s.blocks.map((b) => b.id)])).toEqual([
      ['s1', '', ['p-a']],
      ['h-1', 'Delivery', ['p-c']],
      ['h-2', 'Notes', []],
    ])
  })

  it('opens on the first section panel when the board starts with one (no headless section before it)', () => {
    const { create } = boardToReport(
      board({
        panels: [
          { id: 'p-a', kind: 'view', viewId: 'v-a', layout: at(0, 1), optOut: [] },
          { id: 'h-1', kind: 'section', title: label('Orders', 'الطلبات'), layout: at(0, 0) },
        ],
      }),
      VIEWS,
      MODEL,
    )
    expect(create.definition.sections.map((s) => [s.id, s.heading.ar, s.blocks.map((b) => b.id)])).toEqual([['h-1', 'الطلبات', ['p-a']]])
  })

  it('gives an empty board one empty section', () => {
    const { create } = boardToReport(board({ panels: [] }), VIEWS, MODEL)
    expect(create.definition.sections).toEqual([{ id: 's1', heading: { en: '', ar: '' }, blocks: [] }])
  })

  it("carries the board's parameters and bindings to the same panel ids", () => {
    const params = [
      { name: 'period', kind: 'period' as const, label: label(''), required: true, default: { kind: 'period' as const, token: 'last-7-days' as const } },
      { name: 'zone', kind: 'members' as const, label: label('Zone', 'المنطقة'), required: false, dimension: 'region', pinned: null, multi: true, default: { kind: 'members' as const, values: [] } },
    ]
    const bindings = { period: { 'p-a': true as const, 'p-b': true as const }, zone: { 'p-b': 'region' } }
    const { create } = boardToReport(
      board({
        panels: [
          { id: 'p-a', kind: 'view', viewId: 'v-a', layout: at(0, 0), optOut: [] },
          { id: 'p-b', kind: 'view', viewId: 'v-b', layout: at(4, 0), optOut: [] },
        ],
        params,
        bindings,
      }),
      VIEWS,
      MODEL,
    )
    expect(create.definition.params).toEqual(params)
    expect(create.definition.bindings).toEqual({ period: { 'p-a': true, 'p-b': true }, zone: { 'p-b': 'region' } })
  })

  it("converts a v1 board's filters and opt-outs into parameters, bound only where v1's rule reached", () => {
    const { create } = boardToReport(
      board({
        panels: [
          { id: 'p-a', kind: 'view', viewId: 'v-a', layout: at(0, 0), optOut: ['store'] },
          { id: 'p-b', kind: 'view', viewId: 'v-b', layout: at(4, 0), optOut: [] },
        ],
        filters: { city: ['RUH'] },
      }),
      VIEWS,
      MODEL,
    )
    const { params, bindings } = create.definition
    expect(params.map((p) => p.name)).toEqual(['period', 'city', 'region', 'store', 'channel', 'country'])
    expect(params.find((p) => p.name === 'city')!.default).toEqual({ kind: 'members', values: ['RUH'] })
    expect(bindings.store).toEqual({ 'p-b': 'store' })
    expect(bindings.city).toEqual({ 'p-a': 'city' })
    expect(bindings.period).toEqual({ 'p-a': true, 'p-b': true })
  })

  it('leaves out a view panel whose view could not be read, and its bindings, and says which', () => {
    const { create, missing } = boardToReport(
      board({
        panels: [
          { id: 'p-a', kind: 'view', viewId: 'v-a', layout: at(0, 0), optOut: [] },
          { id: 'p-gone', kind: 'view', viewId: 'v-gone', layout: at(4, 0), optOut: [] },
        ],
        params: [{ name: 'period', kind: 'period', label: label(''), required: true, default: { kind: 'period', token: 'last-7-days' } }],
        bindings: { period: { 'p-a': true, 'p-gone': true } },
      }),
      VIEWS,
      MODEL,
    )
    expect(create.definition.sections[0].blocks.map((b) => b.id)).toEqual(['p-a'])
    expect(create.definition.bindings).toEqual({ period: { 'p-a': true } })
    expect(missing).toEqual(['p-gone'])
  })
})
