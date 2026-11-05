/**
 * The Order / ERX list's Excel export (ticket 786, spec 3389): what the grid shows, minus the
 * patient ID and member ID unless the session holds the insurance-view grant — even when a row
 * carries them and the column is on screen (a saved layout, a stale grant).
 */
import { describe, expect, it } from 'vitest'
import type { GridApi } from 'ag-grid-community'
import type { OrderDocumentRow } from '@/core/models/order-document'
import { orderSheet } from './export'

type Cells = Partial<OrderDocumentRow>

// The three calls the writer makes, answered for a grid that shows both health identifiers.
const column = (colId: string, headerName: string) => ({
  getColDef: () => ({ headerName }),
  getColId: () => colId,
  getActualWidth: () => 140,
})
const fakeGrid = (row: Cells) =>
  ({
    getAllDisplayedColumns: () => [
      column('documentNo', 'Document no.'),
      column('patientId', 'Patient ID'),
      column('memberId', 'Member ID'),
      column('netTotal', 'Net total'),
    ],
    forEachNodeAfterFilterAndSort: (visit: (node: { data: Cells }) => void) => visit({ data: row }),
    getCellValue: ({ rowNode, colKey }: { rowNode: { data: Cells }; colKey: { getColId: () => string } }) =>
      (rowNode.data as Record<string, unknown>)[colKey.getColId()],
  }) as unknown as GridApi<OrderDocumentRow>

const row: Cells = { documentNo: '1006358459', patientId: '2402727917', memberId: '30112233', netTotal: 100 }
const header = (sheet: ReturnType<typeof orderSheet>) => sheet.data[0].map((c) => (c as { value: unknown }).value)

describe('order-list export leaves patient and member ID out without the insurance grant', () => {
  it('without the grant: no Patient ID or Member ID column, header or cell', () => {
    const sheet = orderSheet(fakeGrid(row), { canViewInsurance: false })
    expect(header(sheet)).toEqual(['Document no.', 'Net total'])
    expect(JSON.stringify(sheet.data)).not.toContain('2402727917')
    expect(JSON.stringify(sheet.data)).not.toContain('30112233')
  })

  it('with the grant: both are written, as text so Excel keeps their digits', () => {
    const sheet = orderSheet(fakeGrid(row), { canViewInsurance: true })
    expect(header(sheet)).toEqual(['Document no.', 'Patient ID', 'Member ID', 'Net total'])
    expect(sheet.data[1]).toEqual([
      { type: String, value: '1006358459' },
      { type: String, value: '2402727917' },
      { type: String, value: '30112233' },
      { type: Number, value: 100 },
    ])
  })
})
