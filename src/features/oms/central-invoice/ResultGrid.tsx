import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { useTranslation } from 'react-i18next'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { CentralInvoiceRaiseResult } from '@/core/models/central-invoice'
import VerdictBadge from '@/core/central-invoice/VerdictBadge'

const DEFAULT_COL_DEF: ColDef<CentralInvoiceRaiseResult> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

function VerdictCell({ value }: ICellRendererParams<CentralInvoiceRaiseResult, string>) {
  return <VerdictBadge verdict={value ?? ''} />
}

/**
 * One row per delivery the server answered (ticket 332): the number, its verdict, the
 * `CINV-` code and the server's sentence verbatim. Read-only; the rows are the answer to
 * the last send, in the order the server returned them.
 */
export default function ResultGrid({ rows }: { rows: CentralInvoiceRaiseResult[] }) {
  const { t } = useTranslation('central-invoice')
  const columns = useMemo<ColDef<CentralInvoiceRaiseResult>[]>(
    () => [
      { field: 'deliveryNo', headerName: t('results.columns.deliveryNo'), width: 150, cellClass: 'font-mono' },
      { field: 'verdict', headerName: t('results.columns.verdict'), width: 120, cellRenderer: VerdictCell },
      { field: 'code', headerName: t('results.columns.code'), width: 230 },
      {
        field: 'message',
        headerName: t('results.columns.message'),
        flex: 1,
        minWidth: 280,
        tooltipField: 'message',
      },
    ],
    [t],
  )

  return (
    <div className="h-[28rem] w-full" data-central-invoice-results>
      <AgGridReact<CentralInvoiceRaiseResult>
        theme={omsGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={DEFAULT_COL_DEF}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        tooltipShowDelay={500}
        animateRows={false}
      />
    </div>
  )
}
