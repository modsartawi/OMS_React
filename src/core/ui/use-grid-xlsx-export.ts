import { useCallback, useState } from 'react'
import type { GridApi } from 'ag-grid-community'

/** What a screen spreads onto its export button and its `AgGridReact`. */
export interface GridXlsxExport<Row> {
  onExport: () => void
  disabled: boolean
  gridProps: {
    onGridReady: (event: { api: GridApi<Row> }) => void
    onModelUpdated: (event: { api: GridApi<Row> }) => void
    onGridPreDestroyed: () => void
  }
}

/**
 * An Excel button's plumbing, for a grid whose file is the grid as shown.
 *
 * Graduated from `collection/inquiry` when `collection/settlement` needed the same control:
 * a feature may not import a feature. The screen supplies what to write and what to say when
 * writing fails; this holds the grid's api and decides when the button is live.
 */
export function useGridXlsxExport<Row>(
  write: (api: GridApi<Row>) => Promise<void>,
  onFailure: (error: unknown) => void,
): GridXlsxExport<Row> {
  // 🚩 The grid's own api, so the file reads the rows after the active filter and sort,
  // under the columns on screen, rather than the rows as they arrived.
  const [gridApi, setGridApi] = useState<GridApi<Row> | null>(null)
  // ⚠️ How many rows the FILE would hold, not how many the query returned: a grid filtered
  // down to nothing must not offer a headers-only file. `onModelUpdated` fires for a filter,
  // a sort and a fresh result alike.
  const [displayedRows, setDisplayedRows] = useState(0)
  // The writer is loaded on demand, so a second click could land before the first file.
  const [writing, setWriting] = useState(false)

  const onExport = useCallback(() => {
    if (!gridApi) return
    setWriting(true)
    write(gridApi)
      .catch(onFailure)
      .finally(() => setWriting(false))
  }, [gridApi, write, onFailure])

  return {
    onExport,
    disabled: !gridApi || displayedRows === 0 || writing,
    gridProps: {
      onGridReady: (event) => setGridApi(event.api),
      onModelUpdated: (event) => setDisplayedRows(event.api.getDisplayedRowCount()),
      // ⚠️ The grid unmounts whenever the result goes empty, so the api is dropped with it:
      // an export firing against a destroyed grid would throw rather than write nothing.
      onGridPreDestroyed: () => setGridApi(null),
    },
  }
}
