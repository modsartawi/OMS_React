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

/**
 * Hand a finished CSV string to the browser as a download. Kept out of `csv.ts` so
 * the writer stays testable without a DOM. The anchor is parked in the document
 * and the object URL released a tick after the click — a synchronous revoke is
 * fine in Chrome but can abort the download elsewhere.
 *
 * 🚩 A near-copy of `ua-admin/export.ts`'s own `downloadCsv`, and copied rather
 * than imported **because a feature may not import a feature**
 * (`.claude/rules/feature-structure.md`). It graduates to `@/core` with the rest of
 * the CSV primitives when a third consumer lands, not before.
 */
export function downloadCsv(fileName: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
