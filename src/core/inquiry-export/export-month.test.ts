import type { ColDef, GridApi } from 'ag-grid-community'
import { describe, expect, it } from 'vitest'
import { planExportMonth, type ExportMonthSource } from './export-month'

// Ticket 4318 (spec 4314 stories 6 and 9): the dialog refuses a missing end or a range over 31 days BEFORE anything is
// queued, and sends the grid's visible columns in the user's order with the header text the user sees.

/** A grid as AG Grid would answer it: displayed columns in on-screen order, each with its shown header. */
function grid(columns: [string, string][]): GridApi {
  const cols = columns.map(([id, header]) => ({ getColId: () => id, header }))
  return {
    getAllDisplayedColumns: () => cols,
    getDisplayNameForColumn: (c: { header: string }) => c.header,
  } as unknown as GridApi
}

const source = (over: Partial<ExportMonthSource> = {}): ExportMonthSource => ({
  gridApi: grid([
    ['attemptTime', 'Collection date'],
    ['storeText', 'الفرع'],
    ['businessDay', 'Business date'],
  ]),
  columnDefs: [],
  filters: { StoreCode: 'P001', ReasonCode: 'CLOSED' },
  range: { from: '', to: '' },
  ...over,
})

const plan = (from: string, to: string, over: Partial<ExportMonthSource> = {}) =>
  planExportMonth({ screen: 'CollectionAttempts', from, to, source: source(over), language: 'ar' })

describe('ExportMonthDialog refuses a range over 31 days or with a missing end, and sends visible columns in order', () => {
  it('a missing end is refused, either end', () => {
    expect(plan('', '2026-07-31')).toEqual({ ok: false, problem: 'missingEnd' })
    expect(plan('2026-07-01', '')).toEqual({ ok: false, problem: 'missingEnd' })
  })

  it('32 days is refused; 31 days (both ends counted) is accepted', () => {
    expect(plan('2026-07-01', '2026-08-01')).toEqual({ ok: false, problem: 'tooLong' })
    expect(plan('2026-07-01', '2026-07-31').ok).toBe(true)
    // February: 1 Feb .. 3 Mar is 31 days in 2026 (28-day February).
    expect(plan('2026-02-01', '2026-03-03').ok).toBe(true)
    expect(plan('2026-02-01', '2026-03-04')).toEqual({ ok: false, problem: 'tooLong' })
  })

  it('an end before the start is refused', () => {
    expect(plan('2026-07-31', '2026-07-01')).toEqual({ ok: false, problem: 'reversed' })
  })

  it('sends the screen, the range, the filters, the language and the displayed columns in on-screen order', () => {
    expect(plan('2026-07-01', '2026-07-31')).toEqual({
      ok: true,
      request: {
        screen: 'CollectionAttempts',
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
        filters: { StoreCode: 'P001', ReasonCode: 'CLOSED' },
        columns: [
          { id: 'attemptTime', header: 'Collection date' },
          { id: 'storeText', header: 'الفرع' },
          { id: 'businessDay', header: 'Business date' },
        ],
        language: 'ar',
      },
    })
  })

  it('leaves out a column the screen skips (an actions column)', () => {
    const r = plan('2026-07-01', '2026-07-02', {
      gridApi: grid([
        ['actions', ''],
        ['storeCode', 'Store'],
      ]),
      skipColumn: (id) => id === 'actions',
    })
    expect(r.ok && r.request.columns).toEqual([{ id: 'storeCode', header: 'Store' }])
  })

  it('with no grid mounted (an empty result), reads the column definitions, skipping hidden ones', () => {
    const columnDefs: ColDef[] = [
      { colId: 'businessDay', headerName: 'Business date' },
      { field: 'storeCode', headerName: 'Store' },
      { colId: 'shiftId', headerName: 'Shift', hide: true },
    ]
    const r = plan('2026-07-01', '2026-07-02', { gridApi: null, columnDefs })
    expect(r.ok && r.request.columns).toEqual([
      { id: 'businessDay', header: 'Business date' },
      { id: 'storeCode', header: 'Store' },
    ])
  })

  it('no columns at all is refused rather than sent', () => {
    expect(plan('2026-07-01', '2026-07-02', { gridApi: null, columnDefs: [] })).toEqual({ ok: false, problem: 'noColumns' })
  })
})
