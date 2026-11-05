import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ExternalLink, FileSpreadsheet, PanelRight, Pin, Table2, TriangleAlert } from 'lucide-react'
import type { GridApi } from 'ag-grid-community'
import type { OrderDocumentRow } from '@/core/models/order-document'
import { useKeyHint } from '@/core/commands/key-hint'
import { INSPECTOR_KEYS } from '@/core/list/list-keys'
import { fromListState } from '@/core/oms/open-intent'
import { pinStart } from '@/core/theme/direction'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import { usePopoverDismiss } from '@/core/ui/use-popover-dismiss'
import { exportOrdersToExcel } from './export'
import { deliveryPathOf, documentPathOf } from './inspector-model'
import type { RowPill } from './lenses'
import type { QueryGrants } from './query-model'
import { lensCountText } from './ViewsRail'

/** The pane's id, for the grid bar toggle's and the separator's `aria-controls`. */
export const INSPECTOR_ID = 'order-inspector'

interface ColumnToggle {
  colId: string
  header: string
  visible: boolean
  pinned: boolean
}

/**
 * The results-grid toolbar (the Deliveries toolbar's shape): open the current row's Document
 * details or its delivery, choose and pin columns (AG Grid Community has no column menu, D-14),
 * and export what the grid shows — without patient and member ID unless the grant is held.
 */
export default function GridToolbar({
  gridApi,
  selectedRow,
  hasRows,
  grants,
}: {
  gridApi: GridApi<OrderDocumentRow> | null
  selectedRow: OrderDocumentRow | null
  hasRows: boolean
  grants: QueryGrants
}) {
  const { t } = useTranslation('orders')
  const navigate = useNavigate()
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnList, setColumnList] = useState<ColumnToggle[]>([])
  const popoverRef = useRef<HTMLDivElement>(null)

  const documentTo = selectedRow ? documentPathOf(selectedRow) : null
  const deliveryTo = selectedRow ? deliveryPathOf(selectedRow) : null
  const noRowReason = selectedRow ? undefined : t('inspector.empty')

  usePopoverDismiss(columnsOpen, popoverRef, () => setColumnsOpen(false))

  function refreshColumnList() {
    setColumnList(
      (gridApi?.getColumns() ?? []).map((column) => ({
        colId: column.getColId(),
        header: column.getColDef().headerName ?? column.getColId(),
        visible: column.isVisible(),
        pinned: column.getPinned() != null,
      })),
    )
  }

  async function exportExcel() {
    if (!gridApi) return
    try {
      const count = await exportOrdersToExcel(gridApi, grants)
      if (count > 0) toast.success(t('export.done.title'), { description: t('export.done.detail', { count }) })
      else toast.warning(t('export.empty.title'), { description: t('export.empty.detail') })
    } catch {
      toast.error(t('export.failed.title'), { description: t('export.failed.detail') })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t('toolbar.ariaLabel')}>
      <Button
        variant="outlined"
        aria-disabled={!documentTo || undefined}
        title={noRowReason}
        data-toolbar-open-document=""
        onClick={() => documentTo && navigate(documentTo, { state: fromListState() })}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.openDocument')}
      </Button>
      <Button
        variant="outlined"
        aria-disabled={!deliveryTo || undefined}
        title={noRowReason ?? (deliveryTo ? undefined : t('inspector.noDelivery'))}
        data-toolbar-open-delivery=""
        onClick={() => deliveryTo && navigate(deliveryTo, { state: fromListState() })}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.openDelivery')}
      </Button>
      <div className="relative" ref={popoverRef}>
        <Button
          variant="outlined"
          disabled={!gridApi}
          aria-expanded={columnsOpen}
          data-toolbar-columns=""
          onClick={() => {
            refreshColumnList()
            setColumnsOpen((open) => !open)
          }}
        >
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          {t('toolbar.columns')}
        </Button>
        {columnsOpen && (
          <div className={'absolute start-0 top-full z-50 mt-1 w-72 p-2 ' + POPOVER} data-columns-chooser="">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="flex-1 text-xs font-semibold">{t('columnsChooser.title')}</span>
              <Button
                variant="text"
                onClick={() => {
                  gridApi?.setColumnsVisible(
                    columnList.map((c) => c.colId),
                    true,
                  )
                  refreshColumnList()
                }}
              >
                {t('columnsChooser.showAll')}
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  gridApi?.resetColumnState()
                  refreshColumnList()
                }}
              >
                {t('columnsChooser.reset')}
              </Button>
            </div>
            <ul className="mt-1 max-h-80 overflow-y-auto">
              {columnList.map((column) => (
                <li key={column.colId} className="flex items-center gap-2 px-1 py-0.5">
                  <label className="flex flex-1 items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={() => {
                        gridApi?.setColumnsVisible([column.colId], !column.visible)
                        refreshColumnList()
                      }}
                    />
                    <span className="truncate">{column.header}</span>
                  </label>
                  <IconButton
                    size="compact"
                    aria-pressed={column.pinned}
                    label={t(column.pinned ? 'columnsChooser.unpin' : 'columnsChooser.pin', { column: column.header })}
                    onClick={() => {
                      gridApi?.applyColumnState({ state: [{ colId: column.colId, pinned: column.pinned ? null : pinStart }] })
                      refreshColumnList()
                    }}
                  >
                    <Pin className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Button variant="outlined" disabled={!hasRows} data-toolbar-export="" onClick={exportExcel}>
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        {t('toolbar.export')}
      </Button>
    </div>
  )
}

/** The grid bar's Inspector toggle: folds and unfolds the Order inspector, as `I` does. */
export function InspectorToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation('orders')
  const hint = useKeyHint(INSPECTOR_KEYS)
  return (
    <Chip
      on={open}
      aria-controls={open ? INSPECTOR_ID : undefined}
      aria-keyshortcuts={hint.ariaKeyShortcuts}
      title={hint.title(t('inspector.toggle'))}
      data-inspector-toggle=""
      onClick={onToggle}
    >
      <PanelRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
      {t('inspector.toggle')}
    </Chip>
  )
}

/**
 * The grid bar's row summary: the active lens's loaded rows ("5 orders", "500+ orders"), or
 * "12 of 40 shown" plus Clear grid filters while column filters narrow the grid, then the cut-off
 * line when the page came back full. Every number is one value, isolated once.
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
  const { t } = useTranslation('orders')
  const total = lensCountText(t, pill.total)
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs" data-row-summary="">
      <span className="rounded-full bg-muted px-2 leading-[18px] text-muted-foreground" data-row-pill="">
        {pill.key === 'rows' ? (
          <Trans
            t={t}
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
        <Button variant="text" data-clear-grid-filters="" onClick={onClearFilters}>
          {t('gridBar.clearFilters')}
        </Button>
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
