import type { Column, GridApi, IRowNode } from 'ag-grid-community'
import type { Row } from 'write-excel-file/browser'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'

/** Worksheet name for the export. */
const SHEET_NAME = 'Delivery Documents'

/**
 * Export the current Screen 1 grid to a `.xlsx` workbook (D-4/D-16).
 *
 * "Current grid" means exactly what the operator sees: only the columns
 * currently visible, in their display order (pinned included), and only the rows
 * left after the active per-column filters, in the active sort order. Numeric
 * cells keep their numeric type so Excel can total and sort them; every other
 * cell exports the same formatted text shown in the grid.
 *
 * AG Grid Community has no native Excel export (that is an Enterprise module,
 * budgeted but not licensed — baseline 404 §3), so the workbook is built
 * client-side with no API call. The writer is loaded on demand rather than
 * weighing down the Screen 1 chunk.
 *
 * Writer choice: `write-excel-file`, NOT npm `xlsx@0.18.5` — the Angular
 * prototype's SheetJS pin carries a high-severity advisory in its *parsing*
 * path and is the last npm SheetJS release (403 R-7 says pick a maintained
 * writer up front for React). This library only writes and has no parser.
 *
 * @returns the number of data rows written (0 when nothing matches the filters).
 */
export async function exportDeliveriesToExcel(api: GridApi<DeliveryDocumentModel>): Promise<number> {
  const writeXlsxFile = (await import('write-excel-file/browser')).default

  const columns = api.getAllDisplayedColumns()

  const header: Row = columns.map((column) => ({
    value: columnHeader(column),
    fontWeight: 'bold',
  }))
  const body: Row[] = []
  api.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) body.push(rowCells(api, node, columns))
  })

  await writeXlsxFile([header, ...body], {
    columns: columns.map((column) => ({ width: columnWidthChars(column) })),
    sheet: SHEET_NAME,
  }).toFile(fileName())

  return body.length
}

/** The export header for a column — its grid header, falling back to its id. */
function columnHeader(column: Column): string {
  return column.getColDef().headerName?.trim() || column.getColId()
}

/**
 * One exported row. Real numbers stay numeric so Excel keeps them totalable;
 * everything else exports as the grid's formatted text.
 */
function rowCells(
  api: GridApi<DeliveryDocumentModel>,
  rowNode: IRowNode<DeliveryDocumentModel>,
  columns: Column[],
): Row {
  return columns.map((column) => {
    const raw = api.getCellValue({ rowNode, colKey: column })
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return { type: Number, value: raw }
    }
    const text = api.getCellValue({ rowNode, colKey: column, useFormatter: true })
    return { type: String, value: text == null ? '' : String(text) }
  })
}

/** Approximate an Excel column width (characters) from the grid pixel width. */
function columnWidthChars(column: Column): number {
  const chars = Math.round(column.getActualWidth() / 7)
  return Math.min(60, Math.max(8, chars))
}

/** A timestamped workbook file name, e.g. `delivery-documents-20260717-1430.xlsx`. */
function fileName(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `delivery-documents-${stamp}.xlsx`
}
