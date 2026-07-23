import type { GridApi, ProcessCellForExportParams } from 'ag-grid-community'
import type { BbyInquiryRow } from '@/core/models/bonus-buy-inquiry'

// CSV export of the current (filtered) BBY inquiry grid (spec 061, ticket 065) — the
// react equivalent of the WPF Export-to-Xlsx, resolved to CSV-in-v1 (059 decision).
//
// AG Grid Community ships CSV export natively (`exportDataAsCsv`); the Excel/xlsx module
// is Enterprise-only and out of scope here (deferred). Prior art: the Screen-1
// `deliveries/export.ts` xlsx writer.
//
// "Current grid" = exactly what the operator sees: only the rows left after the active
// per-column filters, in the active sort order (`exportDataAsCsv` walks
// after-filter-and-sort by default). We export all 28 columns.
//
// RAW values, not display chips: every column's underlying value is the raw wire value
// (063 rendered dates/codes with display-only formatters + cellRenderers, never mutating
// the row), and `processCellCallback` returns that raw `params.value` — so the CSV carries
// `yyyyMMdd` dates, `HHMMSS` times and single-letter codes verbatim, bypassing the grid's
// valueFormatters. That is the point of the ticket: the export is the raw data, not the
// on-screen labels.

/**
 * Export the current filtered/sorted grid to a timestamped `.csv`.
 * @returns nothing; AG Grid triggers the browser download.
 */
export function exportBbyToCsv(api: GridApi<BbyInquiryRow>, fileNameBase: string): void {
  api.exportDataAsCsv({
    fileName: fileName(fileNameBase),
    // One clean header row of the 28 leaf fields — drop AG Grid's column-group header row.
    skipColumnGroupHeaders: true,
    // Raw values only — bypass the display valueFormatters so codes/dates export verbatim.
    processCellCallback: (params: ProcessCellForExportParams<BbyInquiryRow>) => {
      const value = params.value
      return value == null ? '' : String(value)
    },
  })
}

/** A timestamped file name, e.g. `bonus-buy-inquiry-20260721-1430.csv`. */
function fileName(base: string): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${base}-${stamp}.csv`
}
