import type { GridApi } from 'ag-grid-community'
import type { OrderDocumentRow } from '@/core/models/order-document'
import { gridSheet, writeWorkbook, xlsxFileName, type GridSheetOptions } from '@/core/util/grid-xlsx'
import type { QueryGrants } from './query-model'

/** Worksheet name for the export (not translated: a file artefact, like the delivery list's). */
const SHEET_NAME = 'Orders'

/** The health identifiers (3389): shown and exported only with the insurance-view grant. */
export const INSURANCE_ID_COLUMNS: readonly string[] = ['patientId', 'memberId']

/** Identity columns Excel must not total or reshape (leading zeros, long digits). */
const TEXT_COLUMNS = new Set(['orderNo', 'documentNo', 'deliveryNo', 'storeCode', 'customerPhone', ...INSURANCE_ID_COLUMNS])

/**
 * What the screen says about its columns to the writer. 🚩 Without the grant the two ID columns
 * are skipped whatever the grid shows — the columns are not built without it either, so this is
 * the second lock, for a saved layout or a grant revoked under an open page.
 */
export function orderSheetOptions(grants: QueryGrants): GridSheetOptions {
  return {
    skip: (colId) => !grants.canViewInsurance && INSURANCE_ID_COLUMNS.includes(colId),
    asText: (colId) => TEXT_COLUMNS.has(colId),
  }
}

/** The grid as the export's one worksheet: visible columns in order, the rows after filter and sort. */
export function orderSheet(api: GridApi<OrderDocumentRow>, grants: QueryGrants) {
  return gridSheet(api, SHEET_NAME, orderSheetOptions(grants))
}

/** Export the grid to `.xlsx`. @returns the data rows written (0 when nothing matches). */
export async function exportOrdersToExcel(api: GridApi<OrderDocumentRow>, grants: QueryGrants): Promise<number> {
  const sheet = orderSheet(api, grants)
  await writeWorkbook([sheet], xlsxFileName('orders'))
  return sheet.count
}
