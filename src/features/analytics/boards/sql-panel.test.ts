import { describe, expect, it } from 'vitest'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { reportPanels } from './report'
import { isSqlBlock, sqlItemAnswer, sqlMark, sqlPanelInput, sqlPanelView } from './sql-panel'
import { readSqlItem } from './sql-editor'
import { readBoard, readItems, readReport, readResult } from './wire'

/**
 * Ticket 891 (BackOffice spec 3632 Q43, Q48, Q49; server halves 3675-3677): the "SQL" and "SQL, verified" marks
 * wherever a SQL item is drawn, the "filters do not apply" line and the "can no longer run" message.
 */

const sqlAnswer = (over: Record<string, unknown> = {}) => ({
  engine: 'sql',
  columns: [],
  rows: [],
  total: 0,
  truncated: false,
  fetchedAt: '2026-11-12T09:00:00',
  dataAsOf: '',
  notReached: [],
  sql: {
    itemId: 'sql-1',
    title: { en: 'Late orders by store', ar: 'الطلبات المتأخرة حسب الفرع' },
    subtitle: { en: '', ar: '' },
    chart: { type: 'table', values: [] },
    filtersApply: false,
    verified: false,
    revision: 3,
    ranAt: '2026-11-12T09:00:00',
    result: { columns: ['store', 'late'], rows: [{ store: 'R001', late: 4 }], rowCount: 1, isCut: false, durationMs: 120, statement: 'SELECT …', tables: ['mart_orders'] },
    refusal: null,
    ...over,
  },
})

describe('the SQL marks (Q43)', () => {
  it('the library, a board panel, a report block, the print page and a panel answer each carry the mark; a cube one none', () => {
    // The library: GET Analytics/Items rows carry engine and verified (3675, 3676).
    const [cube, sql, verified] = readItems([
      { id: 'v1', kind: 'view', engine: 'cube', verified: false },
      { id: 'v2', kind: 'view', engine: 'sql', verified: false },
      { id: 'v3', kind: 'view', engine: 'sql', verified: true },
    ])
    expect([sqlMark(cube), sqlMark(sql), sqlMark(verified)]).toEqual([null, 'sql', 'verified'])
    // An older server sends no engine: cube.
    expect(sqlMark(readItems([{ id: 'v4', kind: 'view' }])[0])).toBeNull()

    // A board read: only a SQL item's panel carries engine "sql" (3677).
    const board = readBoard({
      id: 'b1',
      kind: 'board',
      definition: {
        panels: [
          { id: 'p1', kind: 'view', viewId: 'v1', layout: { x: 0, y: 0, w: 6, h: 2 } },
          { id: 'p2', kind: 'view', viewId: 'v2', layout: { x: 6, y: 0, w: 6, h: 2 }, engine: 'sql' },
        ],
      },
    })
    expect(board.definition.panels.map((p) => (p.kind === 'view' ? sqlMark(p) : null))).toEqual([null, 'sql'])

    // A report read, and the print page's Analytics/Render/Report (the same shape): a SQL block is held by reference.
    const report = readReport({
      id: 'r1',
      kind: 'report',
      definition: {
        params: [],
        bindings: {},
        sections: [
          {
            id: 's1',
            heading: { en: 'Orders', ar: 'الطلبات' },
            blocks: [
              { id: 'k1', kind: 'panel', title: { en: '', ar: '' }, definition: { query: { measures: ['orders'], dimensions: [] }, chart: { type: 'kpi' } } },
              { id: 'k2', kind: 'panel', viewId: 'v2', engine: 'sql' },
            ],
          },
        ],
      },
    })
    const blocks = report.definition.sections[0].blocks
    expect(blocks.map((b) => isSqlBlock(b))).toEqual([false, true])
    expect(blocks[1]).toEqual({ id: 'k2', kind: 'panel', viewId: 'v2', engine: 'sql' })
    expect(blocks.map((b) => (b.kind === 'panel' ? sqlMark(b) : null))).toEqual([null, 'sql'])
    // A SQL block is not one of the report's Cube panels (no definition to bind, validate or fill a figure from).
    expect(reportPanels(report.definition).map((p) => p.id)).toEqual(['k1'])

    // The panel's answer: engine "sql", and its own verified (3676) gives "SQL, verified".
    expect(sqlMark(readResult(sqlAnswer({ verified: true })))).toBe('verified')
    expect(sqlMark(readResult(sqlAnswer()))).toBe('sql')
    // A Cube answer carries no engine (absent = cube; spec 3587 B3).
    expect(sqlMark(readResult({ columns: [], rows: [], total: 0 }))).toBeNull()
  })

  it('the mark has words in both languages', () => {
    expect(en.sqlEditor.mark).toBe('SQL')
    expect(en.sqlEditor.markVerified).toBe('SQL, verified')
    expect(ar.sqlEditor.mark).toBeTruthy()
    expect(ar.sqlEditor.markVerified).not.toBe(en.sqlEditor.markVerified)
  })
})

describe('a statement that no longer runs (Q49)', () => {
  it('draws the plain message with its reason, and no chart', () => {
    const refusal = { code: 'ANALYTICS-425', reason: 'column-not-allowed', line: null, column: null, message: 'The column late_minutes is not on the allow-list.' }
    const view = sqlPanelView(readResult(sqlAnswer({ result: null, refusal })), [])
    expect(view?.body).toEqual({ kind: 'refusal', refusal })
    // A refusal never shows a result beside it, even if a kept one were sent too.
    expect(sqlPanelView(readResult(sqlAnswer({ refusal })), [])?.body.kind).toBe('refusal')
    // A run: its rows are drawn.
    expect(sqlPanelView(readResult(sqlAnswer()), [])?.body.kind).toBe('result')
    // Neither: not run yet.
    expect(sqlPanelView(readResult(sqlAnswer({ result: null })), [])?.body.kind).toBe('notRun')
    // A Cube answer is not a SQL panel's.
    expect(sqlPanelView(readResult({ columns: [], rows: [] }), [])).toBeNull()
  })

  it('the message has words in both languages', () => {
    expect(en.sqlPanel.cannotRun).toMatch(/can no longer run/)
    expect(ar.sqlPanel.cannotRun).toBeTruthy()
    expect(ar.sqlPanel.cannotRun).not.toBe(en.sqlPanel.cannotRun)
  })
})

describe('filters do not apply to a SQL panel (Q48)', () => {
  const params = [
    { name: 'period', kind: 'period' as const, label: { en: 'Period', ar: 'الفترة' }, required: true, default: { kind: 'period' as const, token: 'this-month' as const } },
    { name: 'city', kind: 'members' as const, label: { en: 'City', ar: 'المدينة' }, required: false, dimension: 'city', default: { kind: 'members' as const, values: [] } },
  ]

  it('a board with filters draws the line on its SQL panel; a board without any draws none', () => {
    const answer = readResult(sqlAnswer({}))
    const withFilters = readResult({ ...sqlAnswer(), notReached: [{ param: 'period', reason: 'sqlPanel' }, { param: 'city', reason: 'sqlPanel' }] })
    expect(sqlPanelView(withFilters, params)?.filtersDoNotApply).toBe(true)
    // An older answer without notReached still says it: a SQL panel's filters never apply (filtersApply: false).
    expect(sqlPanelView(answer, params)?.filtersDoNotApply).toBe(true)
    // Nothing to apply: no line.
    expect(sqlPanelView(answer, [])?.filtersDoNotApply).toBe(false)
  })

  it('a SQL panel asks by its board and panel with no values, so moving a filter does not ask it again', () => {
    const context = { params, bindings: {}, values: { city: { kind: 'members' as const, values: ['riyadh'] } }, item: { id: 'b1', revision: 4 } }
    expect(sqlPanelInput('p2', context)).toEqual({ itemId: 'b1', revision: 4, panelId: 'p2', values: {} })
    const draft = { panels: [] }
    expect(sqlPanelInput('p2', { ...context, item: null, draft })).toEqual({ draft, panelId: 'p2', values: {} })
    // A v1 board the server did not convert names no item: the panel reads the SQL item itself.
    expect(sqlPanelInput('p2', { ...context, item: null })).toBeNull()
    // …and draws the item's own kept run the same way, line included.
    const item = readSqlItem({ id: 'v2', engine: 'sql', verified: true, title: { en: 'Late', ar: 'متأخر' }, definition: { statement: 'SELECT 1' }, sql: { revision: 2, ranAt: null, result: null, refusal: null } })
    expect(sqlPanelView(sqlItemAnswer(item), params)).toMatchObject({ mark: 'verified', itemId: 'v2', filtersDoNotApply: true, body: { kind: 'notRun' } })
  })

  it('the line has words in both languages', () => {
    expect(en.sqlPanel.filtersDoNotApply).toBe('Filters do not apply to this SQL panel.')
    expect(ar.sqlPanel.filtersDoNotApply).toBeTruthy()
    expect(ar.sqlPanel.filtersDoNotApply).not.toBe(en.sqlPanel.filtersDoNotApply)
  })
})
