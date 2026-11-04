import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import type { CellKeyDownEvent, ColDef, FullWidthCellKeyDownEvent, RowDoubleClickedEvent, RowSelectionOptions } from 'ag-grid-community'

import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { pinStart } from '@/core/theme/direction'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { formatDateTime } from '@/core/util/date-format'
import type { NeedingActionView } from './lf-returns'

/** The queue read's cache key — the page's query and the rail's count read the same entry. */
export const LF_RETURNS_NEEDING_ACTION_KEY = ['oms', 'lf-returns', 'needing-action'] as const

type QueueColDef = ColDef<NeedingActionView>

const DEFAULT_COL_DEF: QueueColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: false,
  cellDataType: false,
}

const ROW_SELECTION: RowSelectionOptions<NeedingActionView> = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}

/** How long since the pickup was booked, in words: "Today", "3 days". Blank with no `bookedAt`. */
export function ageText(t: TFunction<'deliveries'>, ageDays: number | null): string {
  if (ageDays === null) return ''
  return ageDays === 0 ? t('lfReturns.ageToday') : t('lfReturns.age', { count: ageDays })
}

function buildColumns(t: TFunction<'deliveries'>): QueueColDef[] {
  return [
    {
      colId: 'returnDeliveryNo',
      field: 'returnDeliveryNo',
      headerName: t('lfReturns.column.returnDeliveryNo'),
      width: 160,
      pinned: pinStart,
      cellClass: 'font-mono font-semibold',
    },
    {
      colId: 'forwardDeliveryNo',
      field: 'forwardDeliveryNo',
      headerName: t('lfReturns.column.forwardDeliveryNo'),
      width: 160,
      cellClass: 'font-mono',
    },
    {
      colId: 'reason',
      field: 'reason',
      headerName: t('lfReturns.column.reason'),
      width: 200,
      valueFormatter: (p) => (p.value ? t(`lfReturns.reason.${p.value as NeedingActionView['reason']}`) : ''),
    },
    {
      colId: 'age',
      field: 'ageDays',
      headerName: t('lfReturns.column.age'),
      width: 120,
      // Sorts on the number of days; shows the words.
      valueFormatter: (p) => ageText(t, (p.value as number | null | undefined) ?? null),
    },
    {
      colId: 'bookedAt',
      field: 'bookedAt',
      headerName: t('lfReturns.column.bookedAt'),
      width: 170,
      cellClass: 'font-mono',
      valueFormatter: (p) => formatDateTime(p.value as string | null | undefined),
    },
  ]
}

/**
 * "LF returns needing action" (ticket 764, spec 759 F6): the queue, in its own small grid in place
 * of the results grid. Its rows are the server's needing-action read projected by `needingActionRows`
 * — never the loaded deliveries. Enter or a double-click opens the RETURN delivery's Document Details,
 * where its LF return panel is (762).
 *
 * Three states besides the rows: reading, a failed read (said with the server's message), and an
 * empty answer, which says there is nothing needing action — not "no search yet".
 */
export default function LfReturnsQueue({
  rows,
  pending,
  error,
  onOpen,
}: {
  rows: NeedingActionView[] | undefined
  pending: boolean
  error: unknown
  onOpen: (returnDeliveryNo: string) => void
}) {
  const { t } = useTranslation('deliveries')
  const columns = useMemo(() => buildColumns(t), [t])

  const open = useCallback(
    (row: NeedingActionView | undefined) => {
      if (row?.returnDeliveryNo) onOpen(row.returnDeliveryNo)
    },
    [onOpen],
  )
  const onRowDoubleClicked = useCallback((e: RowDoubleClickedEvent<NeedingActionView>) => open(e.data), [open])
  // Enter is the grid's own event: AG Grid prevents Enter on a cell, so no window key sees it.
  const onCellKeyDown = useCallback(
    (e: CellKeyDownEvent<NeedingActionView> | FullWidthCellKeyDownEvent<NeedingActionView>) => {
      const key = e.event
      if (!(key instanceof KeyboardEvent) || key.key !== 'Enter' || key.isComposing) return
      if (key.ctrlKey || key.altKey || key.metaKey || key.shiftKey) return
      open(e.data)
    },
    [open],
  )

  if (error) {
    return (
      <div
        role="alert"
        data-lf-returns-error=""
        className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div>
          <p className="font-medium">{t('lfReturns.failed')}</p>
          <p className="text-muted-foreground">{apiErrorMessage(error, t('lfReturns.unexpected'))}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1" data-lf-returns-queue="">
      <div className="relative h-[calc(100vh-17.75rem)] min-h-96">
        <AgGridReact<NeedingActionView>
          theme={omsGridTheme}
          rowData={rows ?? NO_ROWS}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          rowSelection={ROW_SELECTION}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          animateRows={false}
          onRowDoubleClicked={onRowDoubleClicked}
          onCellKeyDown={onCellKeyDown}
          suppressOverlays={OVERLAYS}
        />
        {pending ? (
          <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-4">
            <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('lfReturns.loading')}
            </p>
          </div>
        ) : (
          rows?.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-4">
              <p
                data-lf-returns-empty=""
                className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
              >
                {t('lfReturns.empty')}
              </p>
            </div>
          )
        )}
      </div>
      <p className="px-1 text-xs text-muted-foreground">{t('lfReturns.openHint')}</p>
    </div>
  )
}

const NO_ROWS: NeedingActionView[] = []
const OVERLAYS: ('loading' | 'noRows')[] = ['loading', 'noRows']
