import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, RowClassRules } from 'ag-grid-community'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Download, RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage } from '@/core/api'
import { deliverectAccessQuery, deliverectPlatformsQuery } from '@/core/deliverect/api'
import { canViewOrders } from '@/core/deliverect/access'
import type { DeliverectOrderOutcome, DeliverectOrderRow, DeliverectOrdersQuery } from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange, fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { ORDERS_KEY, ordersApi } from './api'
import { orderColumns } from './columns'
import { needsPerson } from './order-status'
import OrderDrawer from './OrderDrawer'
import {
  ORDERS_MAX_WINDOW_DAYS,
  ORDER_OUTCOMES,
  localToday,
  ordersFromParams,
  ordersToParams,
  platformChoices,
  toggled,
  windowProblem,
} from './orders-query'
import RawDrawer from './RawDrawer'
import RetryDialog from './RetryDialog'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Chip from '@/core/ui/Chip'

/**
 * The Deliverect orders monitor (ticket 478, BackOffice spec 2615): every order Deliverect sent us,
 * filtered by a date window (at most 31 days, today by default), delivery platform, store, outcome
 * and text — the search lives in the URL. Each order opens a detail drawer (its lines, dropped ones
 * marked with their reason, and every status sent with Deliverect's answer), its raw body as
 * received, and — for a refused or status-failed order only — a Retry. A cancel that arrived after
 * invoicing (126) is the alert row: it needs a person.
 *
 * Behind `canViewOrders` on the ONE Deliverect probe, the same predicate the menu leaf reads. Its
 * doors are BackOffice 2626.
 */
export default function OrdersPage() {
  const { t } = useTranslation('deliverect-orders')
  return (
    <ScreenGate query={deliverectAccessQuery()} can={canViewOrders} ns="deliverect-orders" title={t('title')} subtitle={t('subtitle')}>
      <Orders />
    </ScreenGate>
  )
}

type Row = DeliverectOrderRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}


/** A 126 row — a cancel after invoicing — is painted on the danger ground (the 480 row recipe). */
const ROW_ALERT = '[--ag-data-background-color:var(--danger-050)]'

/** The detail, raw and retry overlays are independent: the raw body and the retry stack over the drawer. */
type Selected = Row | null

function Orders() {
  const { t } = useTranslation('deliverect-orders')
  const [params, setParams] = useSearchParams()
  // "Today" is read once per page life — the browser's LOCAL date, from its parts.
  const [today] = useState(() => localToday())
  // 🔑 The URL is the query: read from it every render, every change written back (replace, so
  // Back leaves the screen rather than stepping through each filter tweak).
  const query = useMemo(() => ordersFromParams(params, today), [params, today])
  const problem = windowProblem(query.from, query.to)

  // `from` and `to` are ALWAYS in the URL: a bare /deliverect/orders is written out as today..today.
  useEffect(() => {
    if (!params.has('from') || !params.has('to')) setParams(ordersToParams(query), { replace: true })
  }, [params, query, setParams])

  const [store, setStore] = useState(query.store ?? '')
  const [text, setText] = useState(query.q ?? '')
  useEffect(() => setStore(query.store ?? ''), [query.store])
  useEffect(() => setText(query.q ?? ''), [query.q])

  // A filter change takes the text boxes as they read, and starts again at the first page.
  const update = (change: Partial<DeliverectOrdersQuery>) =>
    setParams(ordersToParams({ ...query, store: store.trim() || null, q: text.trim() || null, skip: 0, ...change }), {
      replace: true,
    })

  const orders = useQuery({
    queryKey: [...ORDERS_KEY, ordersToParams(query).toString()],
    queryFn: () => ordersApi.list(query),
    // 🚩 A window the door would refuse is never sent.
    enabled: problem === null,
    placeholderData: keepPreviousData,
    retry: false,
  })
  // Rows only from an answer to THIS query: never while the window is refused, after a failed read,
  // or while the previous page stands in for the next one (its rows would not match `skip`).
  const current = problem === null && !orders.isError && !orders.isPlaceholderData
  const rows = useMemo(() => (current ? (orders.data?.rows ?? []) : []), [orders.data, current])
  const total = current ? (orders.data?.total ?? 0) : 0

  // The platform list rides `canManageTerms` (contract gap, HITL-478): without it the filter offers
  // the platforms seen on the rows, remembered across filters so one platform never shrinks the choice.
  const platforms = useQuery(deliverectPlatformsQuery())
  const [seen, setSeen] = useState<string[]>([])
  useEffect(() => {
    setSeen((prev) => {
      const next = platformChoices(undefined, [...prev, ...rows.map((r) => r.platformKey)], [])
      return next.length === prev.length ? prev : next
    })
  }, [rows])
  const platformKeys = platformChoices(platforms.isSuccess ? platforms.data : undefined, seen, query.platform)

  const [details, setDetails] = useState<Selected>(null)
  const [raw, setRaw] = useState<Selected>(null)
  const [retry, setRetry] = useState<Selected>(null)

  const grid = useRef<GridApi<Row> | null>(null)
  const columns = useMemo(() => orderColumns(t, { onDetails: setDetails, onRetry: setRetry }), [t])
  const rowClassRules = useMemo<RowClassRules<Row>>(() => ({ [ROW_ALERT]: ({ data }) => needsPerson(data?.lastStatusSent) }), [])

  async function exportXlsx() {
    const api = grid.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.sheet'), {
        skip: (id) => id === 'actions',
        // Identities, never totalled or reshaped by Excel.
        asText: (id) => id === 'storeCode' || id === 'documentNumber' || id === 'channelDisplayId',
      })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(figure(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const loading = orders.isFetching && (!orders.data || orders.isPlaceholderData)
  const pageEnd = query.skip + rows.length

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const same = (store.trim() || null) === query.store && (text.trim() || null) === query.q && query.skip === 0
          if (same) void orders.refetch()
          else update({})
        }}
        data-orders-filters=""
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('filters.from')}>
            <Input
              type="date"
              value={query.from}
              onChange={(e) => update({ from: e.target.value })}
              data-filter-from=""
            />
          </Field>
          <Field label={t('filters.to')}>
            <Input type="date" value={query.to} onChange={(e) => update({ to: e.target.value })} data-filter-to="" />
          </Field>
          <Button variant="outlined" onClick={() => update({ from: today, to: today })} data-filter-today="">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {t('filters.today')}
          </Button>
          <Field label={t('filters.store')}>
            <Input
              type="search"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder={t('filters.storePlaceholder')}
              dir="ltr"
              wrapperClassName="w-32 font-mono"
              data-filter-store=""
            />
          </Field>
          <Field label={t('filters.q')} className="min-w-[18rem] flex-1">
            <Input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('filters.qPlaceholder')}
              data-filter-q=""
            />
          </Field>
          <Button type="submit" disabled={orders.isFetching || problem !== null} data-orders-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setStore('')
              setText('')
              setParams(ordersToParams(ordersFromParams(new URLSearchParams(), today)), { replace: true })
            }}
            data-orders-clear=""
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.clear')}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label={t('filters.outcome')} className="flex flex-wrap items-center gap-1.5" data-filter-outcomes="">
            <span className="text-xs font-medium text-muted-foreground">{t('filters.outcome')}</span>
            {ORDER_OUTCOMES.map((o) => (
              <Chip
                key={o}
                on={query.outcome.includes(o)}
                onClick={() => update({ outcome: toggled<DeliverectOrderOutcome>(query.outcome, o) })}
                data-filter-outcome={o}
              >
                {t(`outcomes.${o}`)}
              </Chip>
            ))}
          </div>
          <div role="group" aria-label={t('filters.platform')} className="flex flex-wrap items-center gap-1.5" data-filter-platforms="">
            <span className="text-xs font-medium text-muted-foreground">{t('filters.platform')}</span>
            {platformKeys.length === 0 ? (
              <span className="text-xs text-muted-foreground" data-filter-platform-none="">
                {t('filters.platformNone')}
              </span>
            ) : (
              platformKeys.map((p) => (
                <Chip
                  key={p}
                  on={query.platform.includes(p)}
                  onClick={() => update({ platform: toggled(query.platform, p) })}
                  className="font-mono"
                  data-filter-platform={p}
                >
                  <Ltr>{p}</Ltr>
                </Chip>
              ))
            )}
          </div>
        </div>

        {problem !== null && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-window-problem={problem}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {problem === 'tooLong'
              ? t('filters.windowTooLong', { count: ORDERS_MAX_WINDOW_DAYS, max: fsi(String(ORDERS_MAX_WINDOW_DAYS)) })
              : t(problem === 'reversed' ? 'filters.windowReversed' : 'filters.windowInvalid')}
          </p>
        )}
      </form>

      {problem === null && orders.isError && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(orders.error, t('results.failed'))} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-24rem)] min-h-96" data-orders-grid="">
          <AgGridReact<Row>
            onGridReady={({ api }) => (grid.current = api)}
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.deliverectOrderId}
            rowClassRules={rowClassRules}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // A dozen columns: render every one, so a cell off to the side is in the DOM for
            // find-in-page and for the drive.
            suppressColumnVirtualisation
            loading={loading}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={orders.isError}
          />
        </div>
        <div
          className="flex h-8 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
          data-status-bar=""
        >
          {loading ? (
            <span>{t('results.loading')}</span>
          ) : total > rows.length ? (
            <span data-status-count="">
              <Trans
                t={t}
                i18nKey="results.page"
                values={{ range: formatRange(figure(query.skip + 1), figure(pageEnd)), total: figure(total) }}
                components={{ range: <Ltr />, total: <Ltr /> }}
              />
            </span>
          ) : (
            <span data-status-count="">
              <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
            </span>
          )}
          {total > rows.length && (
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                disabled={query.skip === 0 || orders.isFetching}
                onClick={() => update({ skip: Math.max(0, query.skip - query.take) })}
                data-orders-previous=""
              >
                {/* The arrow points back along the reading direction. */}
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                {t('results.previous')}
              </Button>
              <Button
                variant="ghost"
                disabled={pageEnd >= total || orders.isFetching}
                onClick={() => update({ skip: query.skip + query.take })}
                data-orders-next=""
              >
                {t('results.next')}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </Button>
            </span>
          )}
          <Button variant="ghost" className="ms-auto" disabled={rows.length === 0} onClick={() => void exportXlsx()} data-orders-export="">
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      {details && (
        <OrderDrawer row={details} onClose={() => setDetails(null)} onRaw={setRaw} onRetry={setRetry} />
      )}
      {raw && <RawDrawer row={raw} onClose={() => setRaw(null)} />}
      {retry && <RetryDialog row={retry} onClose={() => setRetry(null)} />}
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('deliverect-orders')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
