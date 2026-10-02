/* PROTOTYPE 368 — the one results grid every variant mounts. */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridReadyEvent, ICellRendererParams, IRowNode } from 'ag-grid-community'
import '@/core/ag-grid-setup'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { buildDeliveryColumns, DELIVERY_DEFAULT_COL_DEF, DELIVERY_ROW_SELECTION } from '../columns'
import { deliveryRowKey } from '../search-store'
import { c } from './copy'
import { lensTest, rowStatus, type Tone } from './model'
import { activeView, adoptBaseline, selectKey, useProto } from './store'

type Row = DeliveryDocumentModel

export const TONE_INK: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-primary',
  ok: 'text-success',
  warn: 'text-attention-800',
  bad: 'text-danger',
}
const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-ink-3',
  info: 'bg-primary',
  ok: 'bg-success',
  warn: 'bg-attention',
  bad: 'bg-danger',
}

export function StatusDot({ row, className = '' }: { row: Row; className?: string }) {
  const s = rowStatus(row)
  return (
    <span className={`inline-flex items-center gap-1.5 ${TONE_INK[s.tone]} ${className}`}>
      <i className={`inline-block size-[7px] shrink-0 rounded-full ${TONE_DOT[s.tone]}`} aria-hidden />
      {c(`status.${s.key}`)}
    </span>
  )
}

function StatusCell(p: ICellRendererParams<Row>) {
  return p.data ? <StatusDot row={p.data} /> : null
}

function FailedCell(p: ICellRendererParams<Row>) {
  const n = typeof p.value === 'number' ? p.value : 0
  if (!n) return <span className="text-ink-3">—</span>
  return (
    <span className="inline-flex h-[18px] min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-primary-foreground">
      {n}
    </span>
  )
}

export function openRecord(navigate: ReturnType<typeof useNavigate>, row: Row | null, open?: string) {
  const no = row?.deliveryNo?.trim()
  if (!no) return
  navigate(`/oms/delivery/${no}`, open ? { state: { open } } : undefined)
}

export default function Grid() {
  const { t } = useTranslation('deliveries')
  const navigate = useNavigate()
  const rows = useProto((s) => s.rows)
  const lens = useProto((s) => s.lens)
  const lensRef = useRef(lens)
  lensRef.current = lens

  const columns = useMemo<ColDef<Row>[]>(() => {
    const base = buildDeliveryColumns(t).map((col) =>
      col.field === 'failedJobsCount' ? { ...col, cellStyle: undefined, cellRenderer: FailedCell, width: 96 } : col,
    )
    const status: ColDef<Row> = {
      headerName: c('grid.status'),
      colId: 'status',
      width: 170,
      valueGetter: (p) => (p.data ? c(`status.${rowStatus(p.data).key}`) : ''),
      cellRenderer: StatusCell,
    }
    return [base[0], status, ...base.slice(1)]
  }, [t])

  const onGridReady = useCallback((e: GridReadyEvent<Row>) => {
    const s = useProto.getState()
    useProto.setState({ gridApi: e.api })
    if (s.columnState) e.api.applyColumnState({ state: s.columnState, applyOrder: true })
    if (s.filterModel) e.api.setFilterModel(s.filterModel)
    const v = activeView(s)
    if (v && (!v.columnState || v.columnState[0]?.width === undefined) && v.criteria) setTimeout(adoptBaseline, 50)
  }, [])

  useEffect(() => () => useProto.setState({ gridApi: null }), [])

  // Lens change: an external filter over LOADED rows; drop a selection the lens hides.
  useEffect(() => {
    const api = useProto.getState().gridApi
    if (!api) return
    api.onFilterChanged()
    const sel = api.getSelectedRows()[0]
    if (sel && !lensTest(lens)(sel)) api.deselectAll()
  }, [lens])

  const restoreSelection = useCallback(() => {
    const { gridApi, selectedKey } = useProto.getState()
    if (!gridApi || !selectedKey) return
    gridApi.forEachNode((node: IRowNode<Row>) => {
      if (node.data && deliveryRowKey(node.data) === selectedKey && !node.isSelected()) {
        node.setSelected(true, true)
        gridApi.ensureNodeVisible(node, 'middle')
      }
    })
  }, [])

  return (
    <AgGridReact<Row>
      theme={omsGridTheme}
      rowData={rows ?? []}
      columnDefs={columns}
      defaultColDef={DELIVERY_DEFAULT_COL_DEF}
      rowSelection={DELIVERY_ROW_SELECTION}
      rowHeight={OMS_GRID_ROW_HEIGHT}
      headerHeight={OMS_GRID_HEADER_HEIGHT}
      getRowId={(p) => deliveryRowKey(p.data)}
      // Native drag-select + Ctrl+C (carried forward from 355).
      enableCellTextSelection
      ensureDomOrder
      animateRows={false}
      suppressNoRowsOverlay
      isExternalFilterPresent={() => lensRef.current !== 'all'}
      doesExternalFilterPass={(node) => !node.data || lensTest(lensRef.current)(node.data)}
      onGridReady={onGridReady}
      onFirstDataRendered={restoreSelection}
      onRowDataUpdated={restoreSelection}
      onModelUpdated={(e) => useProto.setState({ shown: e.api.getDisplayedRowCount() })}
      onStateUpdated={(e) => useProto.setState({ columnState: e.api.getColumnState(), filterModel: e.api.getFilterModel() })}
      // Selection follows focus (365): ↓/↑ and J/K move ONE current row.
      onCellFocused={(e) => {
        if (e.rowIndex == null || e.rowPinned) return
        const node = e.api.getDisplayedRowAtIndex(e.rowIndex)
        if (node && !node.isSelected()) node.setSelected(true, true)
      }}
      onSelectionChanged={(e) => {
        const r = e.api.getSelectedRows()[0]
        selectKey(r ? deliveryRowKey(r) : null)
      }}
      onRowDoubleClicked={(e) => openRecord(navigate, e.data ?? null)}
      // Enter on a cell opens the record. AG Grid preventDefaults Enter, so the
      // document-level list keys never see it; the grid owns this one.
      onCellKeyDown={(e) => {
        const k = e.event as KeyboardEvent | null
        if (k?.key === 'Enter' && !k.ctrlKey && !k.altKey && !k.metaKey) openRecord(navigate, e.data ?? null)
      }}
    />
  )
}
