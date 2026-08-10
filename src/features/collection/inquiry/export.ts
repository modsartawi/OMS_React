// The export's two impure halves (ticket 258): reading the rows **as the grid
// currently holds them**, and handing the finished string to the browser. The
// writer itself is pure and lives in `csv.ts`.
//
// ⚠️ **Deliberately nothing like `features/admin/ua-admin/export.ts`.** That file
// pages the server 120 times behind a runaway guard, a cancel path and a
// no-partial-file rule, because the export is bigger than the screen. Here it is
// not: 254 holds the whole ~2,000-row matched result client-side precisely so that
// sort, the per-column filter row and this export all see every row. So there is
// **no server call, no walk, no progress bar and no cancel** — copying that
// machinery would be cargo cult (ticket 258).

import type { GridApi } from 'ag-grid-community'

import { downloadCsv } from '@/core/util/download-file'

import {
  buildCollectionCsv,
  collectionCsvFileName,
  type CollectionScreen,
  type CsvColumn,
  type HeaderResolver,
} from './csv'

/**
 * The rows the accountant is actually looking at: **after the active per-column
 * filters, in the active sort order**.
 *
 * 🚩 `forEachNodeAfterFilterAndSort` rather than `rowData`. The accountant exports
 * the view they built — a store typed into the floating filter row and a click on
 * the Variance header are the whole reason they came to the screen, and a file
 * that quietly ignored both would be a different question's answer. Client-side
 * paging does **not** narrow it: the walk is over the filtered result set, not
 * over the visible page.
 */
export function rowsForExport<Row>(api: GridApi<Row>): Row[] {
  const rows: Row[] = []
  api.forEachNodeAfterFilterAndSort((node) => {
    if (node.data) rows.push(node.data)
  })
  return rows
}

/**
 * Write the current view of one grid to a CSV download.
 *
 * `screen` is the file-name slug — a machine token, not a label, so it is
 * deliberately not localised: a file name has to be greppable in a shared folder
 * months later.
 */
export function exportGridToCsv<Row>(
  api: GridApi<Row>,
  screen: CollectionScreen,
  columns: readonly CsvColumn<Row>[],
  header: HeaderResolver,
  now: Date,
): void {
  const contents = buildCollectionCsv(rowsForExport(api), columns, header)
  downloadCsv(collectionCsvFileName(screen, now), contents)
}
