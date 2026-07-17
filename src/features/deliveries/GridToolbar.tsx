import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ExternalLink, FileSpreadsheet, Pin, Table2 } from 'lucide-react'
import type { GridApi } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { exportDeliveriesToExcel } from './export'
import ViewManager from './ViewManager'

/** One row of the column chooser — a column's current visibility and pin state. */
interface ColumnToggle {
  colId: string
  header: string
  visible: boolean
  pinned: boolean
}

const BTN =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs ' +
  'hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent'

/**
 * Screen 1 results-grid toolbar.
 *
 * Hosts the grid-level actions beside the results: open the selected row's order
 * or delivery on Screen 2, export the current grid, choose which columns show
 * (and pin them), and manage saved views. The column chooser exists because AG
 * Grid Community has no column menu (D-14).
 */
export default function GridToolbar({
  gridApi,
  selectedRow,
  hasRows,
}: {
  gridApi: GridApi<DeliveryDocumentModel> | null
  selectedRow: DeliveryDocumentModel | null
  hasRows: boolean
}) {
  const { t } = useTranslation('deliveries')
  const navigate = useNavigate()
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnList, setColumnList] = useState<ColumnToggle[]>([])
  const popoverRef = useRef<HTMLDivElement>(null)

  const documentNo = selectedRow?.documentNo?.trim()
  const deliveryNo = selectedRow?.deliveryNo?.trim()

  useEffect(() => {
    if (!columnsOpen) return
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setColumnsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColumnsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [columnsOpen])

  /** Rebuild the chooser list from the grid's current column state. */
  function refreshColumnList() {
    const columns = gridApi?.getColumns() ?? []
    setColumnList(
      columns.map((column) => ({
        colId: column.getColId(),
        header: column.getColDef().headerName ?? column.getColId(),
        visible: column.isVisible(),
        pinned: column.getPinned() === 'left',
      })),
    )
  }

  function openColumns() {
    refreshColumnList()
    setColumnsOpen((open) => !open)
  }

  function toggleColumn(column: ColumnToggle) {
    gridApi?.setColumnsVisible([column.colId], !column.visible)
    refreshColumnList()
  }

  function togglePin(column: ColumnToggle) {
    gridApi?.applyColumnState({ state: [{ colId: column.colId, pinned: column.pinned ? null : 'left' }] })
    refreshColumnList()
  }

  function showAll() {
    gridApi?.setColumnsVisible(
      columnList.map((c) => c.colId),
      true,
    )
    refreshColumnList()
  }

  function reset() {
    gridApi?.resetColumnState()
    refreshColumnList()
  }

  async function exportExcel() {
    if (!gridApi) return
    try {
      const count = await exportDeliveriesToExcel(gridApi)
      if (count > 0) {
        toast.success(t('export.done.title'), { description: t('export.done.detail', { count }) })
      } else {
        toast.warning(t('export.empty.title'), { description: t('export.empty.detail') })
      }
    } catch {
      toast.error(t('export.failed.title'), { description: t('export.failed.detail') })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t('toolbar.ariaLabel')}>
      <button
        type="button"
        className={BTN}
        disabled={!documentNo}
        onClick={() => documentNo && navigate(`/oms/document/${documentNo}`)}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.openOrder')}
      </button>
      <button
        type="button"
        className={BTN}
        disabled={!deliveryNo}
        onClick={() => deliveryNo && navigate(`/oms/delivery/${deliveryNo}`)}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.openDelivery')}
      </button>
      <button type="button" className={BTN} disabled={!hasRows} onClick={exportExcel}>
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.export')}
      </button>

      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          className={BTN}
          disabled={!gridApi}
          aria-expanded={columnsOpen}
          onClick={openColumns}
        >
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          {t('toolbar.columns')}
        </button>
        {columnsOpen && (
          <div className="absolute start-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-card p-2 shadow-md">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="flex-1 text-xs font-semibold">{t('columnsChooser.title')}</span>
              <button type="button" className="text-xs text-primary underline" onClick={showAll}>
                {t('columnsChooser.showAll')}
              </button>
              <button type="button" className="text-xs text-primary underline" onClick={reset}>
                {t('columnsChooser.reset')}
              </button>
            </div>
            <ul className="mt-1 max-h-80 overflow-y-auto">
              {columnList.map((column) => (
                <li key={column.colId} className="flex items-center gap-2 px-1 py-0.5">
                  <label className="flex flex-1 items-center gap-2 text-xs">
                    <input type="checkbox" checked={column.visible} onChange={() => toggleColumn(column)} />
                    <span className="truncate">{column.header}</span>
                  </label>
                  <button
                    type="button"
                    aria-pressed={column.pinned}
                    aria-label={t(column.pinned ? 'columnsChooser.unpin' : 'columnsChooser.pin', {
                      column: column.header,
                    })}
                    onClick={() => togglePin(column)}
                    className={
                      'rounded p-1 hover:bg-accent ' +
                      (column.pinned ? 'text-primary' : 'text-muted-foreground')
                    }
                  >
                    <Pin className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ViewManager gridApi={gridApi} />
    </div>
  )
}
