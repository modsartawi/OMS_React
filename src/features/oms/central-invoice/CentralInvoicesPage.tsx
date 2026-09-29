import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { FileSpreadsheet, RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import {
  canOpenCentralInvoice,
  centralInvoiceAccessQuery,
  isGrantRefused,
  revokeCentralInvoiceAccess,
} from '@/core/central-invoice/api'
import type { CentralInvoiceListRow } from '@/core/models/central-invoice'
import { gridSheet, textSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { centralInvoiceListApi } from './api'
import {
  CENTRAL_INVOICE_STATUSES,
  criteriaProblem,
  defaultListCriteria,
  type CentralInvoiceDateBasis,
  type CentralInvoiceListCriteria,
  type CentralInvoiceStatus,
} from './list-criteria'
import { listColumns } from './list-columns'
import { serialLines } from './list-rows'
import SerialsDialog from './SerialsDialog'

/**
 * The raised central invoices (ticket 333, BackOffice spec 2094 / ticket 2100) — the read
 * screen beside 332's bulk raise. Finance reconciles the cash remainders no Z-report counted;
 * regulatory reports by hand the GS1 packs no RSD dispatch notice covered.
 *
 * Behind the same `CentralInvoice` grant and the same shared probe as the raise, so a 403
 * from either screen drops both leaves and the delivery page's action together.
 *
 * Read only. The export is the grid as shown (`@/core/util/grid-xlsx`), plus a second sheet
 * holding one line per consumed pack of the rows shown, because a pack is not a grid cell.
 */
export default function CentralInvoicesPage() {
  const { t } = useTranslation('central-invoice')
  return (
    <ScreenGate
      query={centralInvoiceAccessQuery()}
      can={canOpenCentralInvoice}
      ns="central-invoice"
      title={t('list.title')}
      subtitle={t('list.subtitle')}
    >
      <CentralInvoiceList />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef<CentralInvoiceListRow> = {
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

function CentralInvoiceList() {
  const { t } = useTranslation('central-invoice')
  const queryClient = useQueryClient()
  const gridApi = useRef<GridApi<CentralInvoiceListRow> | null>(null)

  // The toolbar edits a draft; only Search promotes it, so the grid keeps showing the answer
  // to the question actually asked.
  const [draft, setDraft] = useState<CentralInvoiceListCriteria>(() => defaultListCriteria())
  const [applied, setApplied] = useState<CentralInvoiceListCriteria>(draft)
  const [serialsOf, setSerialsOf] = useState<CentralInvoiceListRow | null>(null)
  const [shown, setShown] = useState(0)
  // Regulatory's question (spec 2094 story 36), answered on the rows already here — the server
  // has no GS1 filter. Read through a ref: AG Grid keeps the first external-filter callbacks.
  const [gs1Only, setGs1Only] = useState(false)
  const gs1OnlyRef = useRef(gs1Only)
  gs1OnlyRef.current = gs1Only
  useEffect(() => {
    gridApi.current?.onFilterChanged()
  }, [gs1Only])
  const problem = criteriaProblem(draft)

  const list = useQuery({
    queryKey: ['central-invoice', 'list', applied],
    queryFn: () => centralInvoiceListApi.list(applied),
    retry: false,
  })

  // A 403 revokes the grant for the page life: the gate above becomes the denied card, and
  // the two leaves and the delivery page's action go with it.
  useEffect(() => {
    if (isGrantRefused(list.error)) revokeCentralInvoiceAccess(queryClient)
  }, [list.error, queryClient])

  const columns = useMemo(() => listColumns(t, setSerialsOf), [t])
  const rows = list.data ?? []

  const patch = (p: Partial<CentralInvoiceListCriteria>) => setDraft((d) => ({ ...d, ...p }))

  function search() {
    if (problem) return
    // A Search with an unchanged draft still asks again: a queued row may have billed since.
    setApplied({ ...draft })
    if (JSON.stringify(draft) === JSON.stringify(applied)) void list.refetch()
  }

  function reset() {
    const fresh = defaultListCriteria()
    setDraft(fresh)
    setApplied(fresh)
  }

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('list.export.sheet'))
      const serials = textSheet(
        t('list.export.serialsSheet'),
        [
          t('list.columns.deliveryNo'),
          t('list.columns.invoiceNo'),
          t('list.columns.store'),
          t('list.columns.country'),
          t('list.serials.columns.pickDocument'),
          t('list.serials.columns.gtin'),
          t('list.serials.columns.serial'),
          t('list.serials.columns.batch'),
          t('list.serials.columns.expiry'),
          t('list.columns.gs1'),
        ],
        serialLines(sheet.rows, (flagged) => (flagged ? t('list.gs1.yes') : t('list.gs1.no'))),
      )
      await writeWorkbook([sheet, serials], xlsxFileName(t('list.export.fileName')))
      notify.success(t('list.export.done'), t('list.export.doneDetail', { count: sheet.count }))
    } catch {
      notify.error(t('list.export.failed'), t('list.export.failedDetail'))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <label className={FIELD}>
          {t('list.filters.dateBasis')}
          <select
            value={draft.dateBasis}
            onChange={(e) => patch({ dateBasis: e.target.value as CentralInvoiceDateBasis })}
            className={`${INPUT} w-36`}
          >
            <option value="requested">{t('list.filters.basis.requested')}</option>
            <option value="billed">{t('list.filters.basis.billed')}</option>
          </select>
        </label>
        <label className={FIELD}>
          {t('list.filters.from')}
          <input type="date" value={draft.from} onChange={(e) => patch({ from: e.target.value })} className={`${INPUT} w-40`} />
        </label>
        <label className={FIELD}>
          {t('list.filters.to')}
          <input type="date" value={draft.to} onChange={(e) => patch({ to: e.target.value })} className={`${INPUT} w-40`} />
        </label>
        <label className={FIELD}>
          {t('list.filters.store')}
          <input
            type="text"
            value={draft.store}
            onChange={(e) => patch({ store: e.target.value })}
            placeholder={t('list.filters.storePlaceholder')}
            className={`${INPUT} w-32`}
          />
        </label>
        <label className={FIELD}>
          {t('list.filters.status')}
          <select
            value={draft.status}
            onChange={(e) => patch({ status: e.target.value as CentralInvoiceStatus | '' })}
            className={`${INPUT} w-36`}
          >
            <option value="">{t('list.filters.anyStatus')}</option>
            {CENTRAL_INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`list.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={problem !== null || list.isFetching}>
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('list.filters.search')}
          </Button>
          <Button variant="outlined" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('list.filters.reset')}
          </Button>
        </div>
        {problem && (
          <p role="alert" className="basis-full text-xs text-danger-800">
            {t(`list.filters.problem.${problem}`)}
          </p>
        )}
      </form>

      {list.isError && !isGrantRefused(list.error) && (
        <ErrorBanner
          className="p-2.5"
          title={t('list.failedTitle')}
          message={apiErrorMessage(list.error, t('list.failed'))}
        />
      )}

      <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="central-invoice-list-title">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="central-invoice-list-title" className="text-sm font-semibold tracking-tight">
            {t('list.gridTitle')}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums" data-central-invoice-list-count>
            {list.isFetching
              ? t('list.loading')
              : shown === rows.length
                ? t('list.count', { count: rows.length })
                : t('list.countFiltered', { shown, count: rows.length })}
          </span>
          <label className="ms-auto inline-flex items-center gap-1.5 text-xs font-medium" title={t('list.gs1.onlyHint')}>
            <input
              type="checkbox"
              checked={gs1Only}
              onChange={(e) => setGs1Only(e.target.checked)}
              data-central-invoice-gs1-only
            />
            {t('list.gs1.only')}
          </label>
          <Button
            variant="outlined"
            disabled={shown === 0}
            onClick={() => void exportXlsx()}
            data-central-invoice-export
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('list.export.button')}
          </Button>
        </div>
        <div className="h-[32rem] w-full" data-central-invoice-list>
          <AgGridReact<CentralInvoiceListRow>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.id}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // Sixteen columns and an audit's worth of rows: render every column, so a cell off to
            // the side is in the DOM for find-in-page and for the drive.
            suppressColumnVirtualisation
            loading={list.isPending}
            noRowsOverlayComponent={NoRows}
            onGridReady={({ api }) => {
              gridApi.current = api
            }}
            onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
            isExternalFilterPresent={() => gs1OnlyRef.current}
            doesExternalFilterPass={({ data }) => !gs1OnlyRef.current || data?.serialisedInGs1Market === true}
          />
        </div>
      </section>

      <SerialsDialog row={serialsOf} onClose={() => setSerialsOf(null)} />
    </div>
  )
}

/** What an empty answer says — a range with nothing raised in it, not a failure. */
function NoRows() {
  const { t } = useTranslation('central-invoice')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
