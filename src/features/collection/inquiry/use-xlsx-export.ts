// The Export button's wiring, shared by the four Collections grids (ticket 258; the
// file became a workbook at ticket 336).
//
// ⚠️ **This is not the shared inquiry shell 244 §1 rules out.** That ruling is
// about the screen's *shape* — the gate / toolbar / criteria-draft / grid skeleton
// — which stays literally duplicated across the four Pages so a fourth screen's
// departure costs nothing. This is one control's plumbing, and it arrived at
// **four** identical copies in a single slice: the exact escalation `GridStates`
// and `cap.ts` already took **inside this feature**, one layer below `core/`.
// Each Page still says which screen it is; what the file holds is the Page's own
// grid, as shown.

import { useCallback, useState } from 'react'
import type { GridApi } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'

import { notify } from '@/core/services/notify'

import { exportGridToXlsx, type CollectionScreen } from './xlsx'

/** What a Page spreads onto its `ExportButton` and its `AgGridReact`. */
export interface XlsxExport<Row> {
  buttonProps: { label: string; onExport: () => void; disabled: boolean }
  gridProps: {
    onGridReady: (event: { api: GridApi<Row> }) => void
    onModelUpdated: (event: { api: GridApi<Row> }) => void
    onGridPreDestroyed: () => void
  }
}

export function useXlsxExport<Row>(screen: CollectionScreen): XlsxExport<Row> {
  const { t } = useTranslation('collection')

  // 🚩 The grid's own api, held so the export reads the grid **as shown** — the
  // rows after the active filter and sort, under the columns on screen — rather
  // than the rows as they arrived.
  const [gridApi, setGridApi] = useState<GridApi<Row> | null>(null)
  // ⚠️ How many rows the FILE would hold, which is not how many the query
  // returned: a grid the accountant has filtered down to nothing must not offer a
  // button that silently downloads a headers-only file under the day's name.
  // `onModelUpdated` is the one event that fires for a filter, a sort and a fresh
  // result alike.
  const [displayedRows, setDisplayedRows] = useState(0)
  // The writer is loaded on demand, so a second click could land before the first file.
  const [writing, setWriting] = useState(false)

  const onExport = useCallback(() => {
    if (!gridApi) return
    setWriting(true)
    // The sheet is named for the screen, by the screen's own title.
    exportGridToXlsx(gridApi, screen, t(`${screen}.title`), new Date())
      .catch((error: unknown) => {
        console.error('collection export failed', error)
        notify.error(t('export.failed'), t('export.failedDetail'))
      })
      .finally(() => setWriting(false))
  }, [gridApi, screen, t])

  return {
    buttonProps: {
      label: t(`${screen}.toolbar.export`),
      onExport,
      disabled: !gridApi || displayedRows === 0 || writing,
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
