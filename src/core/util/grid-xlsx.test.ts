/**
 * The grid → xlsx writer's pure parts (graduated from Screen 1's export at ticket 333).
 * The grid-reading half is read here through a stand-in api; a live AG Grid is the drives'.
 */
import { describe, expect, it } from 'vitest'
import type { GridApi } from 'ag-grid-community'
import { gridSheet, textSheet, xlsxFileName } from './grid-xlsx'

describe('xlsxFileName', () => {
  it('stamps the base with the local day and minute, as Screen 1 always has', () => {
    expect(xlsxFileName('delivery-documents', new Date(2026, 6, 17, 14, 30))).toBe('delivery-documents-20260717-1430.xlsx')
  })
})

describe('textSheet', () => {
  it('is a bold header row then every row as text, never as a number', () => {
    const sheet = textSheet('Serials', ['GTIN', 'Serial'], [['06281234567890', '0012']])
    expect(sheet.name).toBe('Serials')
    expect(sheet.data).toEqual([
      [
        { value: 'GTIN', fontWeight: 'bold' },
        { value: 'Serial', fontWeight: 'bold' },
      ],
      // A GTIN or serial with a leading zero must survive Excel: text, not Number.
      [
        { type: String, value: '06281234567890' },
        { type: String, value: '0012' },
      ],
    ])
  })

  it('sizes each column to its longest cell, between 8 and 60 characters', () => {
    const sheet = textSheet('S', ['A', 'Header'], [['x'.repeat(100), 'yy']])
    expect(sheet.columns).toEqual([{ width: 60 }, { width: 8 }])
  })

  it('writes a header alone when there are no rows', () => {
    expect(textSheet('S', ['A'], []).data).toHaveLength(1)
  })
})

describe('gridSheet options (ticket 336)', () => {
  // The three calls the writer makes, answered for a two-column grid: a document number and an
  // amount, both numbers on the row, plus a column of row actions that holds no value.
  type Line = { no: number; amount: number }
  const column = (colId: string, headerName: string) => ({
    getColDef: () => ({ headerName }),
    getColId: () => colId,
    getActualWidth: () => 140,
  })
  const columns = [column('actions', 'Open'), column('no', 'No#'), column('amount', 'Amount')]
  const api = {
    getAllDisplayedColumns: () => columns,
    forEachNodeAfterFilterAndSort: (visit: (node: { data: Line }) => void) => visit({ data: { no: 7, amount: 12.5 } }),
    getCellValue: ({ rowNode, colKey }: { rowNode: { data: Line }; colKey: { getColId: () => string } }) =>
      (rowNode.data as Record<string, unknown>)[colKey.getColId()],
  } as unknown as GridApi<Line>

  it('writes every shown column, numbers as numbers, when the screen says nothing', () => {
    const sheet = gridSheet(api, 'S')
    expect(sheet.data[0].map((cell) => (cell as { value: unknown }).value)).toEqual(['Open', 'No#', 'Amount'])
    expect(sheet.data[1]).toEqual([
      { type: String, value: '' },
      { type: Number, value: 7 },
      { type: Number, value: 12.5 },
    ])
  })

  it('leaves a skipped column out of the header, the rows and the widths alike', () => {
    const sheet = gridSheet(api, 'S', { skip: (colId) => colId === 'actions' })
    expect(sheet.data[0]).toHaveLength(2)
    expect(sheet.data[1]).toHaveLength(2)
    expect(sheet.columns).toHaveLength(2)
  })

  it('writes a numeric value as text where the screen says the column is an identity', () => {
    const sheet = gridSheet(api, 'S', { asText: (colId) => colId === 'no' })
    expect(sheet.data[1].slice(1)).toEqual([
      { type: String, value: '7' },
      { type: Number, value: 12.5 },
    ])
  })
})
