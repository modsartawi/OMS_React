import type { Column, GridApi, IRowNode } from 'ag-grid-community'
import type { Row } from 'write-excel-file/browser'

/**
 * The app's grid → `.xlsx` writer.
 *
 * Born as Screen 1's `features/oms/deliveries/export.ts` (D-4/D-16) and graduated here at
 * ticket 333, when the central-invoice list became its second consumer — a feature may not
 * import a feature, so the escalation path
 * [feature-structure](../../../.claude/rules/feature-structure.md) sets is up, not sideways.
 * A pure move of the grid-reading part: Screen 1's workbook is byte-for-byte what it was.
 *
 * "The grid" means exactly what the operator sees: only the columns currently visible, in
 * their display order (pinned included), and only the rows left after the active per-column
 * filters, in the active sort order. Numeric cells keep their numeric type so Excel can
 * total and sort them; every other cell exports the same formatted text shown in the grid.
 *
 * AG Grid Community has no native Excel export (that is an Enterprise module, budgeted but
 * not licensed — baseline 404 §3), so the workbook is built client-side with no API call.
 * The writer is loaded on demand rather than weighing down a screen's chunk.
 *
 * Writer choice: `write-excel-file`, NOT npm `xlsx@0.18.5` — the Angular prototype's SheetJS
 * pin carries a high-severity advisory in its *parsing* path and is the last npm SheetJS
 * release (403 R-7 says pick a maintained writer up front for React). This library only
 * writes and has no parser.
 */

/** One worksheet of a workbook. */
export interface XlsxSheet {
  /** The worksheet's tab name (Excel caps it at 31 characters). */
  name: string
  data: Row[]
  /** Column widths in characters, in column order. */
  columns?: { width: number }[]
}

/** What a screen may say about its own columns (ticket 336). Both are asked by column id. */
export interface GridSheetOptions {
  /** A shown column that holds no value and is left out of the sheet — a column of row actions. */
  skip?: (colId: string) => boolean
  /**
   * A column written as the text the grid shows even where its value is a number: an identity
   * (a receipt or document number), which Excel must not total or reshape.
   */
  asText?: (colId: string) => boolean
}

/**
 * The grid as one worksheet — see the module note for what "the grid" means.
 *
 * @returns the sheet, plus `rows` — the data rows it wrote, in that order — and `count`, their
 *   number (0 when nothing matches the filters).
 */
export function gridSheet<T>(
  api: GridApi<T>,
  name: string,
  options: GridSheetOptions = {},
): XlsxSheet & { rows: T[]; count: number } {
  const columns = api.getAllDisplayedColumns().filter((column) => !options.skip?.(column.getColId()))

  // Asked once per column, not once per cell.
  const asText = columns.map((column) => options.asText?.(column.getColId()) ?? false)

  const header: Row = columns.map((column) => ({
    value: columnHeader(column),
    fontWeight: 'bold',
  }))
  const body: Row[] = []
  const rows: T[] = []
  api.forEachNodeAfterFilterAndSort((node) => {
    if (!node.data) return
    rows.push(node.data)
    body.push(rowCells(api, node, columns, asText))
  })

  return {
    name,
    data: [header, ...body],
    columns: columns.map((column) => ({ width: columnWidthChars(column) })),
    rows,
    count: body.length,
  }
}

/** A worksheet of plain text — a bold header row, then the rows as given. */
export function textSheet(name: string, header: readonly string[], rows: readonly (readonly string[])[]): XlsxSheet {
  return {
    name,
    data: [
      header.map((value) => ({ value, fontWeight: 'bold' as const })),
      ...rows.map((row) => row.map((value) => ({ type: String, value }))),
    ],
    columns: header.map((value, i) => ({ width: textColumnWidth(value, rows, i) })),
  }
}

/**
 * A text column's width: its longest cell plus two, between 8 and 60 characters. A loop, not
 * `Math.max(...rows)`: an unpaged sheet can outgrow the engine's argument limit.
 */
function textColumnWidth(header: string, rows: readonly (readonly string[])[], i: number): number {
  let width = Math.max(8, header.length + 2)
  for (const row of rows) {
    if (width >= 60) break
    width = Math.max(width, (row[i] ?? '').length + 2)
  }
  return Math.min(60, width)
}

/** Write the sheets, in order, to one workbook and hand it to the browser as `fileName`. */
export async function writeWorkbook(sheets: readonly XlsxSheet[], fileName: string): Promise<void> {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  await writeXlsxFile(
    sheets.map((sheet) => ({ data: sheet.data, sheet: sheet.name, columns: sheet.columns })),
  ).toFile(fileName)
}

/** A timestamped workbook file name, e.g. `delivery-documents-20260717-1430.xlsx`. */
export function xlsxFileName(base: string, now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${base}-${stamp}.xlsx`
}

/** The export header for a column — its grid header, falling back to its id. */
function columnHeader(column: Column): string {
  return column.getColDef().headerName?.trim() || column.getColId()
}

/**
 * One exported row. Real numbers stay numeric so Excel keeps them totalable — unless the
 * screen says the column is text; everything else exports as the grid's formatted text.
 */
function rowCells<T>(
  api: GridApi<T>,
  rowNode: IRowNode<T>,
  columns: Column[],
  asText: readonly boolean[],
): Row {
  return columns.map((column, i) => {
    if (!asText[i]) {
      const raw = api.getCellValue({ rowNode, colKey: column })
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return { type: Number, value: raw }
      }
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
