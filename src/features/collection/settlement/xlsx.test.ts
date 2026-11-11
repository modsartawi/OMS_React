import { describe, expect, it } from 'vitest'
import type { GridApi } from 'ag-grid-community'

import { settlementFileName, settlementSheet, settlementSheetName } from './xlsx'

type Row = { entryNumber: number; amount: number; storeName: string; ageDays: number }

/** The displayed columns and rows, as the writer reads them off the grid. */
function shownGrid(colIds: string[], rows: Row[]): GridApi<Row> {
  const columns = colIds.map((id) => ({
    getColId: () => id,
    getColDef: () => ({ headerName: id }),
    getActualWidth: () => 140,
  }))
  return {
    getAllDisplayedColumns: () => columns,
    forEachNodeAfterFilterAndSort: (visit: (node: { data: Row }) => void) =>
      rows.forEach((data) => visit({ data })),
    getCellValue: ({ rowNode, colKey }: { rowNode: { data: Row }; colKey: { getColId: () => string } }) =>
      (rowNode.data as Record<string, unknown>)[colKey.getColId()],
  } as unknown as GridApi<Row>
}

describe('settlementSheet', () => {
  const row: Row = { entryNumber: 5501, amount: 150.5, storeName: 'الرياض', ageDays: 4 }

  it('writes figures as numbers and an entry number as text', () => {
    const sheet = settlementSheet(shownGrid(['entryNumber', 'amount', 'ageDays'], [row]), 'Ledger')
    expect(sheet.data[1]).toEqual([
      { type: String, value: '5501' },
      { type: Number, value: 150.5 },
      { type: Number, value: 4 },
    ])
  })

  it('leaves the Decision column of buttons out', () => {
    const sheet = settlementSheet(shownGrid(['storeName', 'decide'], [row]), 'Pending')
    expect(sheet.data[0]).toHaveLength(1)
    expect(sheet.data[1]).toEqual([{ type: String, value: 'الرياض' }])
  })
})

describe('the file and sheet names', () => {
  it('names the file for the grid and the day, with no time in it', () => {
    expect(settlementFileName('ledger', new Date(2026, 9, 5, 23, 59))).toBe('settlement-ledger-2026-10-05.xlsx')
  })

  it('makes a title Excel accepts', () => {
    expect(settlementSheetName('Open / closed: a very long sheet title indeed')).toBe('Open   closed  a very long shee')
  })
})
