import { AgGridReact } from 'ag-grid-react'
import { useTranslation } from 'react-i18next'
import { Inbox, Loader2 } from 'lucide-react'
import type { ColDef, RowClassParams, RowSelectionOptions, RowStyle } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { DETAIL_DEFAULT_COL_DEF } from './columns'

/**
 * A read-only grid for the Screen 2 detail tabs (Items, Header Conditions, Log,
 * Jobs).
 *
 * Wraps the dense grid with explicit loading / error / empty states so every
 * tab renders consistently — whether its rows arrive on the loaded document
 * (Items, Conditions) or from a deferred fetch (Log, Jobs).
 */
export default function DetailGrid<T>({
  columnDefs,
  rowData,
  loading = false,
  error = null,
  emptyMessage,
  getRowStyle,
  pinnedBottomRowData,
  rowSelection,
}: {
  columnDefs: ColDef<T>[]
  /** `null` before a deferred fetch resolves. */
  rowData: T[] | null
  loading?: boolean
  error?: string | null
  emptyMessage: string
  getRowStyle?: (params: RowClassParams<T>) => RowStyle | undefined
  /**
   * The totals row pinned under the last row (Items only). Never reached when
   * `rowData` is empty — the empty state renders instead of a grid, and a footer
   * summing nothing has nothing to say.
   */
  pinnedBottomRowData?: T[]
  rowSelection?: RowSelectionOptions<T>
}) {
  const { t } = useTranslation('document')
  const STATE =
    'flex h-[26rem] items-center justify-center gap-2 rounded-lg border border-dashed ' +
    'border-border text-[0.8125rem] text-muted-foreground'

  if (loading)
    return (
      <div className={STATE} role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('grid.loading')}
      </div>
    )

  if (error) return <ErrorBanner center message={error} className="h-[26rem]" />

  if ((rowData?.length ?? 0) === 0)
    return (
      <div className={STATE}>
        <Inbox className="h-4 w-4" aria-hidden />
        <span>{emptyMessage}</span>
      </div>
    )

  return (
    <div className="h-[26rem] w-full">
      <AgGridReact<T>
        theme={omsGridTheme}
        rowData={rowData ?? []}
        columnDefs={columnDefs}
        defaultColDef={DETAIL_DEFAULT_COL_DEF}
        getRowStyle={getRowStyle}
        pinnedBottomRowData={pinnedBottomRowData}
        rowSelection={rowSelection}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        tooltipShowDelay={500}
        animateRows={false}
      />
    </div>
  )
}
