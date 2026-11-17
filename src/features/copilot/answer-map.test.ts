import { describe, expect, it } from 'vitest'
import type { CopilotAnswer, CopilotAnswerTable } from '@/core/models/copilot'
import { copilotAnswerModel } from './answer'

// oms-react 884 (BackOffice spec 3630 M42, ticket 3641): a table from a map that fit carries `map: { legend }` and its
// `place` / `legend` columns; every other table carries no `map` at all. The panel reads both shapes.

const reply: Partial<CopilotAnswer> = {
  conversationId: 'c-1',
  questionNo: 1,
  answer: 'Olaya sold the most.',
  trace: [{ tool: 'semantic_query', input: { measures: ['till_sales'] }, rows: 2, ms: 400, ok: true }],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude',
}

const plain: CopilotAnswerTable = {
  step: 0,
  columns: [
    { key: 'store', role: 'dimension', label: { en: 'Store', ar: 'المتجر' }, unit: null, shape: null, dateBasis: null, calculation: null, variant: null },
    { key: 'till_sales', role: 'measure', label: { en: 'Till sales', ar: 'مبيعات نقاط البيع' }, unit: 'SAR', shape: 'additive', dateBasis: null, calculation: null, variant: null },
  ],
  rows: [{ values: ['S001', '1200'], isTotal: null }],
  total: 1,
  truncated: false,
  periodFrom: '2026-10-30',
  periodTo: '2026-11-05',
  previous: null,
  previousFrom: null,
  previousTo: null,
  dataAsOf: '2026-11-11T08:00:00',
  notes: { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null },
  query: { measures: ['till_sales'], dimensions: ['store'], filters: [], period: 'last-7-days' },
}

const legend = {
  size: { key: 'till_sales', label: { en: 'Till sales', ar: 'مبيعات نقاط البيع' }, min: 1200, max: 1200, additive: true },
  colour: null,
  notOnMap: 0,
}

const mapped: CopilotAnswerTable = {
  ...plain,
  columns: [
    ...plain.columns,
    { key: 'latitude', role: 'place', label: { en: 'latitude', ar: 'latitude' }, unit: null, shape: null, dateBasis: null, calculation: null, variant: null },
    { key: 'longitude', role: 'place', label: { en: 'longitude', ar: 'longitude' }, unit: null, shape: null, dateBasis: null, calculation: null, variant: null },
    { key: 'hollow', role: 'legend', label: { en: 'hollow', ar: 'hollow' }, unit: null, shape: null, dateBasis: null, calculation: null, variant: null },
  ],
  rows: [{ values: ['S001', '1200', '24.6943', '46.6853', 'false'], isTotal: null }],
  map: { legend },
}

describe("the answer's tables carry a map part (oms-react 884)", () => {
  it('aTableFromAMapThatFit_keepsItsMapPart_andItsPlaceAndLegendColumns', () => {
    const [table] = copilotAnswerModel({ ...reply, tables: [mapped] }).tables
    expect(table.map).toEqual({ legend })
    expect(table.columns.map((c) => c.role)).toEqual(['dimension', 'measure', 'place', 'place', 'legend'])
  })

  it('anAnswerFromAServerWithoutIt_stillParses_andCarriesNoMapPart', () => {
    const [table] = copilotAnswerModel({ ...reply, tables: [plain] }).tables
    expect(table).toEqual(plain)
    expect('map' in table).toBe(false)
  })

  it('aMapPartWithNoLegend_isLeftOut_andTheTableKept', () => {
    for (const map of [null, 'map', {}, { legend: null }]) {
      const tables = copilotAnswerModel({ ...reply, tables: [{ ...plain, map } as unknown as CopilotAnswerTable] }).tables
      expect(tables).toHaveLength(1)
      expect('map' in tables[0]).toBe(false)
    }
  })

  it('readingTheSameReplyTwice_givesTheSameTables_soTheMapIsNotRestartedOnEveryRender', () => {
    // The panel reads its replies on every render (a keystroke in the ask box): a new table identity restarts each map.
    const sent = { ...reply, tables: [mapped, { ...mapped, map: { legend: null } } as unknown as CopilotAnswerTable, plain] }
    const first = copilotAnswerModel(sent).tables
    const again = copilotAnswerModel(sent).tables
    expect(again).toHaveLength(3)
    again.forEach((t, i) => expect(t).toBe(first[i]))
  })
})
