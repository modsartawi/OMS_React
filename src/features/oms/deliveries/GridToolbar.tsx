import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ExternalLink, FileSpreadsheet, PanelRight, Pin, Table2, TriangleAlert } from 'lucide-react'
import type { GridApi } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { takesEscape } from '@/core/commands/key-layer'
import { fromListState } from '@/core/oms/open-intent'
import { useKeyHint } from '@/core/commands/key-hint'
import { pinStart } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import { INSPECTOR_ID } from './DeliveryInspector'
import { exportDeliveriesToExcel } from './export'
import { INSPECTOR_KEYS } from './inspector-pane'
import type { RowPill } from './lenses'
import { lensCountText } from './ViewsRail'

/** One row of the column chooser — a column's current visibility and pin state. */
interface ColumnToggle {
  colId: string
  header: string
  visible: boolean
  pinned: boolean
}

const BTN =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs ' +
  'hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent'

/**
 * Screen 1 results-grid toolbar.
 *
 * Hosts the grid-level actions beside the results: open the selected row's order
 * or delivery on Screen 2, export the current grid, and choose which columns show
 * (and pin them). The column chooser exists because AG Grid Community has no
 * column menu (D-14). Saved views live in the views rail (ticket 400).
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
      if (!takesEscape(e, popoverRef.current)) return
      e.preventDefault()
      setColumnsOpen(false)
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
        // Pinned on EITHER side: a view saved under the other direction pins to
        // the reading end, and it must still read as pinned and unpin here.
        pinned: column.getPinned() != null,
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
    gridApi?.applyColumnState({ state: [{ colId: column.colId, pinned: column.pinned ? null : pinStart }] })
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
        onClick={() => documentNo && navigate(`/oms/document/${documentNo}`, { state: fromListState() })}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.openOrder')}
      </button>
      <button
        type="button"
        className={BTN}
        disabled={!deliveryNo}
        onClick={() => deliveryNo && navigate(`/oms/delivery/${deliveryNo}`, { state: fromListState() })}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.openDelivery')}
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
          <div className={'absolute start-0 top-full z-50 mt-1 w-72 p-2 ' + POPOVER}>
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

      <button type="button" className={BTN} disabled={!hasRows} onClick={exportExcel}>
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.export')}
      </button>
    </div>
  )
}

/**
 * The grid bar's Inspector toggle (spec 380 L9, L15): folds and unfolds the Delivery inspector,
 * as its chevron and `I` do. Its tooltip reads "Inspector (I)" (368 §4). Shown before any
 * search too, so a folded pane can always come back.
 */
export function InspectorToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation('deliveries')
  const hint = useKeyHint(INSPECTOR_KEYS)
  return (
    <button
      type="button"
      className={BTN}
      aria-pressed={open}
      aria-controls={open ? INSPECTOR_ID : undefined}
      aria-keyshortcuts={hint.ariaKeyShortcuts}
      title={hint.title(t('inspector.toggle'))}
      data-inspector-toggle=""
      onClick={onToggle}
    >
      {/* The pane sits at the inline end: the icon's panel follows it under RTL. */}
      <PanelRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
      {t('inspector.toggle')}
    </button>
  )
}

/**
 * The grid bar's row summary (ticket 398, spec 380 L9; ruling 366): the row pill — the active
 * lens's loaded rows ("5 deliveries", "200+ deliveries"), or "12 of 40 shown" plus *Clear grid
 * filters* while column filters narrow the grid — then, when the page came back full, the
 * cut-off line. Every number is one value, isolated once.
 */
export function RowSummary({
  pill,
  cut,
  limit,
  onClearFilters,
}: {
  pill: RowPill
  cut: boolean
  limit: number | null
  onClearFilters: () => void
}) {
  const { t } = useTranslation('deliveries')
  const total = lensCountText(t, pill.total)
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs" data-row-summary="">
      <span className="rounded-full bg-muted px-2 leading-[18px] text-muted-foreground" data-row-pill="">
        {pill.key === 'rows' ? (
          <Trans
            t={t}
            // A lower bound reads plural whatever its number ("1+ deliveries"); an exact count by its own.
            i18nKey={pill.total.key === 'atLeast' ? 'gridBar.rowsAtLeast' : 'gridBar.rows'}
            count={pill.total.key === 'exact' ? pill.total.count : undefined}
            values={{ n: total }}
            components={{ n: <Ltr /> }}
          />
        ) : (
          <Trans
            t={t}
            i18nKey="gridBar.shown"
            values={{ shown: String(pill.shown), total }}
            components={{ shown: <Ltr />, total: <Ltr /> }}
          />
        )}
      </span>
      {pill.key === 'shown' && (
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          data-clear-grid-filters=""
          onClick={onClearFilters}
        >
          {t('gridBar.clearFilters')}
        </button>
      )}
      {cut && limit !== null && (
        <span className="inline-flex items-center gap-1 text-attention-800" data-cut-line="">
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          <span>
            <Trans t={t} i18nKey="gridBar.cut" values={{ limit: String(limit) }} components={{ limit: <Ltr /> }} />
          </span>
        </span>
      )}
    </span>
  )
}
