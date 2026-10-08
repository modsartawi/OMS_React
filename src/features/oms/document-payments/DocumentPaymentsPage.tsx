import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { FileSpreadsheet, RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { lookupQueries } from '@/core/services/lookups'
import { fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { fromListState } from '@/core/oms/open-intent'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenDocumentPayments } from '@/core/oms/access'
import type { DocumentPaymentModel } from '@/core/models/document-payment'
import { TOO_MANY_VALUES, documentPaymentsApi } from './api'
import {
  MAX_NUMBERS,
  criteriaFromState,
  criteriaProblem,
  criteriaToParams,
  defaultCriteria,
  stateWithCriteria,
  type PaymentsCriteria,
} from './criteria'
import { ACTIONS_COL_ID, EXPORT_AS_TEXT, paymentColumns } from './columns'
import { paymentRowOffers } from './row-offers'

/**
 * Document payments (ticket 433, spec 430 D4/D10/D11): the WPF Document Payment Inquiry on the web.
 * Criteria, a grid of payment lines, a row's document or delivery opened in Document Details, and
 * an xlsx export. The list loads on Search (D16).
 *
 * Behind `canOpenDocumentPayments` on the ONE shared OMS probe, the same predicate the menu leaf
 * reads. 🚩 The rows carry customer phones and names, so nothing is asked for without the grant.
 * 🚩 Its door (`SdDocumentWeb/DocumentPayments`, BackOffice ask BO-3) is not built yet.
 */
export default function DocumentPaymentsPage() {
  const { t } = useTranslation('document-payments')
  return (
    <ScreenGate query={omsAccessQuery()} can={canOpenDocumentPayments} ns="document-payments" title={t('title')} subtitle={t('subtitle')}>
      <DocumentPaymentList />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef<DocumentPaymentModel> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'
const NUMBERS =
  'h-[3.75rem] w-48 resize-y rounded-md border border-border/60 bg-background px-2.5 py-1.5 font-mono text-[12px] text-foreground focus:border-primary/50 focus:outline-none'

/** The number the guard names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

function DocumentPaymentList() {
  const { t } = useTranslation('document-payments')
  const navigate = useNavigate()
  const location = useLocation()
  const gridApi = useRef<GridApi<DocumentPaymentModel> | null>(null)
  // `null` until the first Search: the screen opens on its criteria, not on a call (D16). A search
  // is kept on its history entry, so Back from Document Details lands on the same result.
  const [applied, setApplied] = useState<PaymentsCriteria | null>(() => criteriaFromState(location.state))
  const [draft, setDraft] = useState<PaymentsCriteria>(() => applied ?? defaultCriteria())
  // What the grid shows once its column filters have narrowed it: the export's rows.
  const [shown, setShown] = useState(0)
  const problem = criteriaProblem(draft)

  const types = useQuery(lookupQueries.documentTypes())
  const list = useQuery({
    // Keyed on what goes on the wire, so two drafts that send the same query share one entry.
    queryKey: ['document-payments', 'list', applied && criteriaToParams(applied)],
    queryFn: () => documentPaymentsApi.list(applied!),
    enabled: applied !== null,
    retry: false,
  })

  /** Document Details, marked as come from a list so its Esc goes back here. */
  const open = useCallback((to: string | null) => {
    if (to) void navigate(to, { state: fromListState() })
  }, [navigate])

  const columns = useMemo(() => paymentColumns(t, open), [t, open])
  const rows = useMemo(() => (list.isError ? [] : (list.data?.rows ?? [])), [list.data, list.isError])
  const typeOptions = useMemo(
    () =>
      (types.data ?? [])
        .filter((d, i, all) => {
          const code = d.documentType?.trim()
          // A code padded differently is still one type: one option, one React key.
          return !!code && all.findIndex((x) => x.documentType?.trim() === code) === i
        })
        .map((d) => ({ value: d.documentType.trim(), label: d.description?.trim() || d.documentType.trim() })),
    [types.data],
  )

  /** The result as shown — its columns, its column filters, its sort — through the core writer. */
  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.sheet'), {
        skip: (colId) => colId === ACTIONS_COL_ID,
        asText: (colId) => EXPORT_AS_TEXT.has(colId),
      })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const patch = (p: Partial<PaymentsCriteria>) => setDraft((d) => ({ ...d, ...p }))

  function search() {
    if (problem) return
    // A Search with an unchanged draft still asks again: a payment may have landed since.
    if (applied && JSON.stringify(criteriaToParams(draft)) === JSON.stringify(criteriaToParams(applied))) {
      void list.refetch()
      return
    }
    setApplied({ ...draft })
    keepOnEntry(draft)
  }

  /** Back to the landing criteria and no result, so the bar and the grid never disagree. */
  function reset() {
    setDraft(defaultCriteria())
    setApplied(null)
    keepOnEntry(null)
  }

  /** The applied search onto this history entry (its address and other state kept). */
  function keepOnEntry(c: PaymentsCriteria | null) {
    const { pathname, search: query, hash, state } = location
    void navigate({ pathname, search: query, hash }, { replace: true, state: stateWithCriteria(state, c) })
  }

  const refusedTooMany = list.isError && apiErrorCode(list.error) === TOO_MANY_VALUES

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
        data-payment-filters=""
      >
        <label className={FIELD}>
          {t('filters.from')}
          <input type="date" value={draft.from} onChange={(e) => patch({ from: e.target.value })} className={`${INPUT} w-40`} data-payment-filter="from" />
        </label>
        <label className={FIELD}>
          {t('filters.to')}
          <input type="date" value={draft.to} onChange={(e) => patch({ to: e.target.value })} className={`${INPUT} w-40`} data-payment-filter="to" />
        </label>
        <label className={FIELD}>
          {t('filters.store')}
          <input
            type="text"
            value={draft.storeCode}
            onChange={(e) => patch({ storeCode: e.target.value })}
            placeholder={t('filters.storePlaceholder')}
            className={`${INPUT} w-28`}
            data-payment-filter="storeCode"
          />
        </label>
        <label className={FIELD}>
          {t('filters.documentType')}
          <select
            value={draft.documentType}
            onChange={(e) => patch({ documentType: e.target.value })}
            className={`${INPUT} w-44`}
            data-payment-filter="documentType"
          >
            <option value="">{t('filters.anyType')}</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {fsi(o.label)}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          {t('filters.customerPhone')}
          <input
            type="text"
            inputMode="tel"
            dir="ltr"
            value={draft.customerPhone}
            onChange={(e) => patch({ customerPhone: e.target.value })}
            className={`${INPUT} w-40 text-start`}
            data-payment-filter="customerPhone"
          />
        </label>
        <label className={FIELD}>
          {t('filters.documentNos')}
          <textarea
            value={draft.documentNos}
            onChange={(e) => patch({ documentNos: e.target.value })}
            placeholder={t('filters.numbersPlaceholder')}
            title={t('filters.numbersHint')}
            dir="ltr"
            className={NUMBERS}
            data-payment-filter="documentNos"
          />
        </label>
        <label className={FIELD}>
          {t('filters.orderNos')}
          <textarea
            value={draft.orderNos}
            onChange={(e) => patch({ orderNos: e.target.value })}
            placeholder={t('filters.numbersPlaceholder')}
            title={t('filters.numbersHint')}
            dir="ltr"
            className={NUMBERS}
            data-payment-filter="orderNos"
          />
        </label>
        <label className={FIELD}>
          {t('filters.limit')}
          <input
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={draft.limit}
            onChange={(e) => patch({ limit: e.target.value })}
            className={`${INPUT} w-20 text-end`}
            data-payment-filter="limit"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={problem !== null || list.isFetching} data-payment-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button variant="outlined" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.reset')}
          </Button>
        </div>
        {problem && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-payment-problem={problem.kind}>
            {problem.kind === 'tooMany' ? (
              <Trans
                t={t}
                i18nKey="filters.problem.tooMany"
                values={{ count: figure(problem.count), max: figure(MAX_NUMBERS) }}
                components={{ n: <Ltr />, max: <Ltr /> }}
              />
            ) : (
              t(`filters.problem.${problem.kind}`)
            )}
          </p>
        )}
      </form>

      {list.isError && (
        <ErrorBanner
          className="p-2.5"
          title={refusedTooMany ? t('list.tooManyTitle') : t('list.failedTitle')}
          message={apiErrorMessage(list.error, t('list.failed'))}
        />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex justify-end">
          <Button variant="outlined" disabled={list.isError || list.isFetching || shown === 0} onClick={() => void exportXlsx()} data-payment-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
        <div className="relative h-[calc(100vh-24rem)] min-h-96" data-payment-list="">
          <AgGridReact<DocumentPaymentModel>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            onGridReady={({ api }) => {
              gridApi.current = api
            }}
            onRowDoubleClicked={({ data }) => open(data ? paymentRowOffers(data).document : null)}
            onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // Eighteen columns: render every one, so a cell off to the side is in the DOM for
            // find-in-page and for the drive.
            suppressColumnVirtualisation
            loading={list.isFetching && !list.data}
            noRowsOverlayComponent={NoRows}
            // A failed load is the banner's to say, and before the first Search the bar below
            // says what to do: "nothing matches" beside either would contradict it.
            suppressNoRowsOverlay={list.isError || applied === null}
          />
        </div>
        {applied === null ? (
          <p className="flex h-7 items-center px-3 text-[11.5px] text-muted-foreground" data-payment-not-searched="">
            {t('list.notSearched')}
          </p>
        ) : (
          !list.isError && <StatusBar count={rows.length} limited={list.data?.limited === true} loading={list.isFetching} />
        )}
      </div>
    </div>
  )
}

/** The count under the grid, and a plain "showing the first N" when the limit cut it. */
function StatusBar({ count, limited, loading }: { count: number; limited: boolean; loading: boolean }) {
  const { t } = useTranslation('document-payments')
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
            values={{ n: figure(count) }}
            components={{ n: <Ltr /> }}
          />
        </span>
      )}
    </div>
  )
}

/** An empty answer — nothing paid on those criteria, not a failure. */
function NoRows() {
  const { t } = useTranslation('document-payments')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
