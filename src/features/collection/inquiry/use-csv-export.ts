// The Export button's wiring, shared by the four Collections grids (ticket 258).
//
// ⚠️ **This is not the shared inquiry shell 244 §1 rules out.** That ruling is
// about the screen's *shape* — the gate / toolbar / criteria-draft / grid skeleton
// — which stays literally duplicated across the four Pages so a fourth screen's
// departure costs nothing. This is one control's plumbing, and it arrived at
// **four** identical copies in a single slice: the exact escalation `GridStates`
// and `cap.ts` already took **inside this feature**, one layer below `core/`.
// Each Page still says which screen it is, which columns it writes and which key
// prefix its headers come from; nothing here decides what a screen exports.

import { useCallback, useState } from 'react'
import type { GridApi } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'

import type { CollectionScreen, CsvColumn } from './csv'
import { exportGridToCsv } from './export'

/** What a Page spreads onto its `ExportButton` and its `AgGridReact`. */
export interface CsvExport<Row> {
  buttonProps: { label: string; onExport: () => void; disabled: boolean }
  gridProps: {
    onGridReady: (event: { api: GridApi<Row> }) => void
    onModelUpdated: (event: { api: GridApi<Row> }) => void
    onGridPreDestroyed: () => void
  }
}

export function useCsvExport<Row>(
  screen: CollectionScreen,
  columns: readonly CsvColumn<Row>[],
): CsvExport<Row> {
  const { t } = useTranslation('collection')

  // 🚩 The grid's own api, held so the export can read the rows **after the
  // active filter and sort** rather than the rows as they arrived. The accountant
  // exports the view they built, and `rowData` would quietly ignore both the
  // floating filter row and the header they clicked.
  const [gridApi, setGridApi] = useState<GridApi<Row> | null>(null)
  // ⚠️ How many rows the FILE would hold, which is not how many the query
  // returned: a grid the accountant has filtered down to nothing must not offer a
  // button that silently downloads a headers-only file under the day's name.
  // `onModelUpdated` is the one event that fires for a filter, a sort and a fresh
  // result alike.
  const [displayedRows, setDisplayedRows] = useState(0)

  const onExport = useCallback(() => {
    if (!gridApi) return
    exportGridToCsv(
      gridApi,
      screen,
      columns,
      // The file's headers are the screen's headers, through the same keys —
      // never a second spelling invented for the file.
      (field) => t(`${screen}.columns.${field}`),
      new Date(),
    )
  }, [gridApi, screen, columns, t])

  return {
    buttonProps: {
      label: t(`${screen}.toolbar.export`),
      onExport,
      disabled: !gridApi || displayedRows === 0,
    },
    gridProps: {
      onGridReady: (event) => setGridApi(event.api),
      onModelUpdated: (event) => setDisplayedRows(event.api.getDisplayedRowCount()),
      // ⚠️ The grid unmounts whenever the result goes empty, so the api is dropped
      // with it — an export firing against a destroyed grid would throw rather
      // than write nothing.
      onGridPreDestroyed: () => setGridApi(null),
    },
  }
}
