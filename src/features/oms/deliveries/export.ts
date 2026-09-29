import type { GridApi } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'

/** Worksheet name for the export. */
const SHEET_NAME = 'Delivery Documents'

/**
 * Export the current Screen 1 grid to a `.xlsx` workbook (D-4/D-16) — exactly what the
 * operator sees: the visible columns in display order, the rows left after the filters in
 * the active sort. The writer is `@/core/util/grid-xlsx` (graduated there at ticket 333).
 *
 * @returns the number of data rows written (0 when nothing matches the filters).
 */
export async function exportDeliveriesToExcel(api: GridApi<DeliveryDocumentModel>): Promise<number> {
  const sheet = gridSheet(api, SHEET_NAME)
  await writeWorkbook([sheet], xlsxFileName('delivery-documents'))
  return sheet.count
}
