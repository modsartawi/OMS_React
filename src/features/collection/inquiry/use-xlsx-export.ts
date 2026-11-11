// The Export button's wiring, shared by the Collections inquiry grids (ticket 258; the
// file became a workbook at ticket 336).
//
// ⚠️ **This is not the shared inquiry shell 244 §1 rules out.** That ruling is about the
// screen's *shape*, which stays literally duplicated across the Pages. This is one
// control's plumbing. Each Page still says which screen it is; what the file holds is the
// Page's own grid, as shown.

import { useCallback } from 'react'
import type { GridApi } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'

import { notify } from '@/core/services/notify'
import { useGridXlsxExport, type GridXlsxExport } from '@/core/ui/use-grid-xlsx-export'

import { exportGridToXlsx, type CollectionScreen } from './xlsx'

/** What a Page spreads onto its `ExportButton` and its `AgGridReact`. */
export interface XlsxExport<Row> {
  buttonProps: { label: string; onExport: () => void; disabled: boolean }
  gridProps: GridXlsxExport<Row>['gridProps']
}

export function useXlsxExport<Row>(screen: CollectionScreen): XlsxExport<Row> {
  const { t } = useTranslation('collection')

  // The sheet is named for the screen, by the screen's own title.
  const write = useCallback(
    (api: GridApi<Row>) => exportGridToXlsx(api, screen, t(`${screen}.title`), new Date()),
    [screen, t],
  )
  const onFailure = useCallback(
    (error: unknown) => {
      console.error('collection export failed', error)
      notify.error(t('export.failed'), t('export.failedDetail'))
    },
    [t],
  )
  const { onExport, disabled, gridProps } = useGridXlsxExport<Row>(write, onFailure)

  return {
    buttonProps: { label: t(`${screen}.toolbar.export`), onExport, disabled },
    gridProps,
  }
}
