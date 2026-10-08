import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type {
  CellFocusedEvent,
  CellKeyDownEvent,
  ColDef,
  FullWidthCellKeyDownEvent,
  GridApi,
  RowSelectionOptions,
} from 'ag-grid-community'
import { FileSpreadsheet, RotateCcw, Search, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { INSPECTOR_WIDTH } from '@/core/ui/inspector-pane'
import { fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { fromListState } from '@/core/oms/open-intent'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenDonorRequests } from '@/core/oms/access'
import type { DonorRequestState } from '@/core/models/sd-document'
import { waitingOnDonor } from '@/core/oms/donor-moments'
import { donorRequestsApi } from './api'
import {
  DONOR_REQUEST_STATES,
  criteriaProblem,
  defaultCriteria,
  initialCriteria,
  type DonorRequestCriteria,
} from './criteria'
import { donorColumns, type DonorRequestRow } from './columns'
import { donorRow } from './donor-row'
import DonorInspector from './DonorInspector'
import { deliveryPath } from './inspector'

/**
 * Donor requests (ticket 431, spec 430 D9): every store's donor asks, opening on today's. The
 * Deliveries layout cut down — a filter bar, the grid, a read-only inspector beside it (ticket
 * 432) and a status bar; no query-token bar, saved views, lenses or view rail.
 *
 * Behind `canOpenDonorRequests` on the ONE shared OMS probe, the same predicate the menu leaf
 * reads, so the nav and the screen cannot disagree. 🚩 Its door (`SdDocumentWeb/DonorRequests`,
 * BackOffice ask BO-2) is not built yet.
 */
export default function DonorRequestsPage() {
  const { t } = useTranslation('donor-requests')
  // `?request=<no>` (a failed donor transfer's link, ticket 434) is read ONCE per arrival: the
  // list is keyed on it, so a new link — or the menu leaf, which drops it — starts afresh.
  const [searchParams] = useSearchParams()
  const requestParam = searchParams.get('request')
  return (
    <ScreenGate query={omsAccessQuery()} can={canOpenDonorRequests} ns="donor-requests" title={t('title')} subtitle={t('subtitle')}>
      <DonorRequestList key={requestParam ?? ''} requestParam={requestParam} />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef<DonorRequestRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

/** One current row: a click, or the arrow keys (selection follows focus), selects it. */
const ROW_SELECTION: RowSelectionOptions<DonorRequestRow> = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}

/** Identities the export writes as text, so Excel never totals or reshapes a number or a code. */
const EXPORT_AS_TEXT: ReadonlySet<string> = new Set(['requestNo', 'deliveryNo', 'donorStore', 'orderStore'])

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** The current time, ticking each minute, so a waiting row counts up while the page is open. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function DonorRequestList({ requestParam }: { requestParam: string | null }) {
  const { t } = useTranslation('donor-requests')
  const [, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const gridApi = useRef<GridApi<DonorRequestRow> | null>(null)
  // The current row by its number, so a reload shows its fresh copy (or none, once it is gone).
  const [selectedNo, setSelectedNo] = useState<string | null>(null)
  // The pane's width; it opens at 360 each visit.
  const [paneWidth, setPaneWidth] = useState<number>(INSPECTOR_WIDTH.default)
  // What the grid shows once its column filters have narrowed it: the export's rows.
  const [shown, setShown] = useState(0)
  // The param seeds a request-only search with no date bound; later edits are the user's own.
  const [draft, setDraft] = useState<DonorRequestCriteria>(() => initialCriteria(requestParam))
  const [applied, setApplied] = useState<DonorRequestCriteria>(draft)
  const problem = criteriaProblem(draft)
  const now = useMinuteClock()

  const list = useQuery({
    queryKey: ['donor-requests', 'list', applied],
    queryFn: () => donorRequestsApi.list(applied),
    retry: false,
  })

  const columns = useMemo(() => donorColumns(t), [t])
  // The clock matters only to a waiting row: without one, the rows keep their identity all day.
  const anyWaiting = useMemo(() => waitingOnDonor(list.data?.rows).length > 0, [list.data])
  const tick = anyWaiting ? now : 0
  const rows = useMemo<DonorRequestRow[]>(
    () => (list.isError ? [] : (list.data?.rows ?? [])).map((r) => ({ ...r, view: donorRow(r, now) })),
    // `now` is read through `tick`, so a minute with nothing waiting changes nothing.
    [list.data, list.isError, tick],
  )

  const selectedRow = useMemo(
    () => (selectedNo === null ? null : (rows.find((r) => r.requestNo === selectedNo) ?? null)),
    [rows, selectedNo],
  )

  /** Document Details' delivery route (D10), marked as come from a list so its Esc goes back here. */
  const openDelivery = useCallback(
    (to: string | null) => {
      if (to) void navigate(to, { state: fromListState() })
    },
    [navigate],
  )

  /** Selection follows focus: the arrow keys step the inspector through the rows, with no call. */
  const onCellFocused = useCallback((event: CellFocusedEvent<DonorRequestRow>) => {
    if (event.rowIndex == null || event.rowPinned) return
    const node = event.api.getDisplayedRowAtIndex(event.rowIndex)
    if (node && !node.isSelected()) node.setSelected(true, true)
  }, [])

  /**
   * Enter opens the delivery. It is the grid's own event, because AG Grid prevents Enter on a
   * cell, so a window key listener never sees it.
   */
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<DonorRequestRow> | FullWidthCellKeyDownEvent<DonorRequestRow>) => {
      const key = event.event
      if (!(key instanceof KeyboardEvent) || key.key !== 'Enter' || key.isComposing) return
      if (key.ctrlKey || key.altKey || key.metaKey || key.shiftKey) return
      if (key.target instanceof Element && key.target.closest('button, a')) return
      openDelivery(deliveryPath(event.data?.deliveryNo))
    },
    [openDelivery],
  )

  /** The list as shown — its columns, its column filters, its sort — through the core writer. */
  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.sheet'), { asText: (colId) => EXPORT_AS_TEXT.has(colId) })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const patch = (p: Partial<DonorRequestCriteria>) => setDraft((d) => ({ ...d, ...p }))
  // Kept in the offered order, so one question is one cache entry whatever the click order.
  const toggleState = (s: DonorRequestState, on: boolean) =>
    setDraft((d) => ({
      ...d,
      states: DONOR_REQUEST_STATES.filter((x) => (x === s ? on : d.states.includes(x))),
    }))

  function search() {
    if (problem) return
    // A Search with an unchanged draft still asks again: a request may have been raised since.
    setApplied({ ...draft, states: [...draft.states] })
    if (JSON.stringify(draft) === JSON.stringify(applied)) void list.refetch()
  }

  function reset() {
    // Leaving a one-request search drops the param too, so a refresh does not bring it back
    // (the keyed remount then opens on today).
    if (requestParam?.trim()) {
      setSearchParams({}, { replace: true })
      return
    }
    const fresh = defaultCriteria()
    setDraft(fresh)
    setApplied(fresh)
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
        data-donor-filters=""
      >
        <fieldset className={FIELD}>
          <legend className="mb-1">{t('filters.state')}</legend>
          <div className="flex h-9 flex-wrap items-center gap-x-3 gap-y-1">
            {DONOR_REQUEST_STATES.map((s) => (
              <label key={s} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draft.states.includes(s)}
                  onChange={(e) => toggleState(s, e.target.checked)}
                  data-donor-state={s}
                />
                {t(`state.${s}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={FIELD}>
          {t('filters.donorStore')}
          <input
            type="text"
            value={draft.donorStore}
            onChange={(e) => patch({ donorStore: e.target.value })}
            placeholder={t('filters.storePlaceholder')}
            className={`${INPUT} w-28`}
            data-donor-filter="donorStore"
          />
        </label>
        <label className={FIELD}>
          {t('filters.orderStore')}
          <input
            type="text"
            value={draft.orderStore}
            onChange={(e) => patch({ orderStore: e.target.value })}
            placeholder={t('filters.storePlaceholder')}
            className={`${INPUT} w-28`}
            data-donor-filter="orderStore"
          />
        </label>
        <label className={FIELD}>
          {t('filters.from')}
          <input
            type="date"
            value={draft.from}
            onChange={(e) => patch({ from: e.target.value })}
            className={`${INPUT} w-40`}
            data-donor-filter="from"
          />
        </label>
        <label className={FIELD}>
          {t('filters.to')}
          <input
            type="date"
            value={draft.to}
            onChange={(e) => patch({ to: e.target.value })}
            className={`${INPUT} w-40`}
            data-donor-filter="to"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={problem !== null || list.isFetching} data-donor-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button variant="outlined" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.reset')}
          </Button>
        </div>
        {draft.requestNo && (
          <p className="flex basis-full items-center gap-2 text-xs text-muted-foreground" data-donor-request-seed="">
            <Trans t={t} i18nKey="filters.requestOnly" values={{ requestNo: draft.requestNo }} components={{ no: <Ltr /> }} />
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-medium text-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" aria-hidden />
              {t('filters.requestClear')}
            </button>
          </p>
        )}
        {problem && (
          <p role="alert" className="basis-full text-xs text-danger-800">
            {t(`filters.problem.${problem}`)}
          </p>
        )}
      </form>

      {list.isError && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(list.error, t('list.failed'))} />
      )}

      <div className="flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex justify-end">
            <Button variant="outlined" disabled={list.isError || shown === 0} onClick={() => void exportXlsx()} data-donor-export="">
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
              {t('export.button')}
            </Button>
          </div>
          <div className="relative h-[calc(100vh-21.5rem)] min-h-96" data-donor-list="">
            <AgGridReact<DonorRequestRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => data.requestNo}
              getRowClass={({ data }) => (data?.view.tone === 'muted' ? 'text-muted-foreground' : undefined)}
              rowSelection={ROW_SELECTION}
              onGridReady={({ api }) => {
                gridApi.current = api
              }}
              onSelectionChanged={({ api }) => setSelectedNo(api.getSelectedRows()[0]?.requestNo ?? null)}
              onCellFocused={onCellFocused}
              onCellKeyDown={onCellKeyDown}
              onRowDoubleClicked={({ data }) => openDelivery(deliveryPath(data?.deliveryNo))}
              onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              tooltipShowDelay={500}
              animateRows={false}
              // Fourteen columns: render every one, so a cell off to the side is in the DOM for
              // find-in-page and for the drive.
              suppressColumnVirtualisation
              loading={list.isPending}
              noRowsOverlayComponent={NoRows}
              // A failed load is the banner's to say; "nothing matches" beside it would contradict it.
              suppressNoRowsOverlay={list.isError}
            />
          </div>
          {!list.isError && <StatusBar count={rows.length} limited={list.data?.limited === true} loading={list.isFetching} />}
        </div>

        <DonorInspector row={selectedRow} now={now} width={paneWidth} onWidth={setPaneWidth} onOpen={openDelivery} />
      </div>
    </div>
  )
}

/** The count under the grid, and a plain "showing the first N" when the server's limit cut it. */
function StatusBar({ count, limited, loading }: { count: number; limited: boolean; loading: boolean }) {
  const { t } = useTranslation('donor-requests')
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
      data-status-bar=""
    >
      {loading ? (
        <span>{t('statusBar.loading')}</span>
      ) : (
        <span data-status-count="" data-limited={limited ? '' : undefined}>
          <Trans
            t={t}
            i18nKey={limited ? 'statusBar.limited' : 'statusBar.rows'}
            count={count}
            values={{ n: String(count) }}
            components={{ n: <Ltr /> }}
          />
        </span>
      )}
    </div>
  )
}

/** What an empty answer says — a day with nothing raised, not a failure. */
function NoRows() {
  const { t } = useTranslation('donor-requests')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
