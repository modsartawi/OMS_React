import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, RowClassRules } from 'ag-grid-community'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { hungerStationAccessQuery, hungerStationChainsQuery } from '@/core/hungerstation/api'
import { canManageStores, canViewOrders } from '@/core/hungerstation/access'
import { useSeenChains } from '@/core/hungerstation/seen-chains'
import { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import {
  HUNGERSTATION_ERRORS,
  HUNGERSTATION_ORDERS_MAX_DAYS,
  type HungerStationOrderRow,
  type HungerStationOrdersQuery,
  type HungerStationOutcomeFilter,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange, fsi } from '@/core/util/bidi'
import { addDays, localToday } from '@/core/util/date-window'
import { keyChoices, toggled } from '@/core/util/filter-choices'
import { formatFigure as figure } from '@/core/util/number-format'
import { ORDERS_KEY, ordersApi } from './api'
import { orderColumns } from './columns'
import OrderDrawer from './OrderDrawer'
import {
  ORDERS_EARLIEST_DAY,
  ORDER_OUTCOME_FILTERS,
  ordersFromParams,
  ordersToParams,
  ordersWindowProblem,
} from './orders-query'
import RawDrawer, { type RawTarget } from './RawDrawer'
import RetryDialog, { type RetryTarget } from './RetryDialog'

/**
 * The HungerStation orders monitor (ticket 556, BackOffice spec 3028) — the DIRECT rail's orders,
 * shaped like the Deliverect monitor: a date window (at most 31 days, today by default, refused
 * before any call outside 2000-01-01..tomorrow), store, chain, outcome and text filters, all in the
 * URL. Each order opens a detail drawer (its lines with each replacement after the line it replaced,
 * its deliveries and their runs), a delivery's raw body, and — for a `retryable` order only — a
 * Retry with a reason. An `unmatched` order is the alert row: onboard (or revive) the store.
 *
 * Behind `canViewOrders` on the ONE HungerStation probe, the same predicate the menu leaf reads.
 */
export default function OrdersPage() {
  const { t } = useTranslation('hungerstation-orders')
  return (
    <ScreenGate query={hungerStationAccessQuery()} can={canViewOrders} ns="hungerstation-orders" title={t('title')} subtitle={t('subtitle')}>
      <Orders />
    </ScreenGate>
  )
}

type Row = HungerStationOrderRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'
const CHIP =
  'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors aria-pressed:border-primary aria-pressed:bg-primary-050 aria-pressed:text-primary-800'

/** An alert row — the vendor id resolves to no onboarded store — on the attention ground. */
const ROW_ALERT = '[--ag-data-background-color:var(--attention-050)]'

function Orders() {
  const { t } = useTranslation('hungerstation-orders')
  const [params, setParams] = useSearchParams()
  // "Today" is read once per page life — the browser's LOCAL date, from its parts.
  const [today] = useState(() => localToday())
  // 🔑 The URL is the query (replace, so Back leaves the screen rather than stepping through filters).
  const query = useMemo(() => ordersFromParams(params, today), [params, today])
  const problem = ordersWindowProblem(query, today)

  // `from` and `to` are ALWAYS in the URL: a bare /hungerstation/orders is written out as today..today.
  useEffect(() => {
    if (!params.has('from') || !params.has('to')) setParams(ordersToParams(query), { replace: true })
  }, [params, query, setParams])

  const [store, setStore] = useState(query.store ?? '')
  const [text, setText] = useState(query.q ?? '')
  useEffect(() => setStore(query.store ?? ''), [query.store])
  useEffect(() => setText(query.q ?? ''), [query.q])

  // A filter change takes the text boxes as they read, and starts again at the first page.
  const update = (change: Partial<HungerStationOrdersQuery>) =>
    setParams(ordersToParams({ ...query, store: store.trim() || null, q: text.trim() || null, skip: 0, ...change }), { replace: true })

  const orders = useQuery({
    queryKey: [...ORDERS_KEY, ordersToParams(query).toString()],
    queryFn: () => ordersApi.list(query),
    // 🚩 A window the door would refuse is never sent.
    enabled: problem === null,
    placeholderData: keepPreviousData,
    retry: false,
  })
  // Rows only from an answer to THIS query: never while the window is refused, after a failed read,
  // or while the previous page stands in for the next one.
  const current = problem === null && !orders.isError && !orders.isPlaceholderData
  const rows = useMemo(() => (current ? (orders.data?.rows ?? []) : []), [orders.data, current])
  const total = current ? (orders.data?.total ?? 0) : 0
  // The server stays authoritative on the window: its 400 shows inline, beside the dates.
  const serverWindow = problem === null && orders.isError && apiErrorCode(orders.error) === HUNGERSTATION_ERRORS.windowInvalid

  // 🚩 The `Chains` read rides `canManageStores` (contract § Access), which an orders user may lack —
  // then it is never sent (it could only be a bare 403), and the filter offers the chains seen on the
  // rows. The same grant links a store code to its logs on the Stores page.
  const access = useQuery(hungerStationAccessQuery())
  const manageStores = canManageStores(access.data)
  const chains = useQuery({ ...hungerStationChainsQuery(), enabled: manageStores })
  const seen = useSeenChains(rows)
  const chainKeys = keyChoices(manageStores && chains.isSuccess ? chains.data : undefined, seen, [query.chain])

  const [details, setDetails] = useState<Row | null>(null)
  const [raw, setRaw] = useState<RawTarget | null>(null)
  const [retry, setRetry] = useState<RetryTarget | null>(null)

  const columns = useMemo(() => orderColumns(t, { onDetails: setDetails, onRetry: setRetry }, manageStores), [t, manageStores])
  const rowClassRules = useMemo<RowClassRules<Row>>(() => ({ [ROW_ALERT]: ({ data }) => !!data?.alert }), [])

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
          <label className={FIELD}>
            {t('filters.from')}
            <input type="date" value={query.from} onChange={(e) => update({ from: e.target.value })} className={INPUT} data-filter-from="" />
          </label>
          <label className={FIELD}>
            {t('filters.to')}
            <input type="date" value={query.to} onChange={(e) => update({ to: e.target.value })} className={INPUT} data-filter-to="" />
          </label>
          <Button variant="outlined" className="h-9" onClick={() => update({ from: today, to: today })} data-filter-today="">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {t('filters.today')}
          </Button>
          <label className={FIELD}>
            {t('filters.store')}
            <input
              type="search"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder={t('filters.storePlaceholder')}
              dir="ltr"
              className={INPUT + ' w-32 font-mono'}
              data-filter-store=""
            />
          </label>
          <label className={FIELD}>
            {t('filters.chain')}
            <select value={query.chain ?? ''} onChange={(e) => update({ chain: e.target.value || null })} className={INPUT} data-filter-chain="">
              <option value="">{t('filters.chainAll')}</option>
              {chainKeys.map((c) => (
                <option key={c} value={c}>
                  {fsi(c)}
                </option>
              ))}
            </select>
          </label>
          <label className={`${FIELD} min-w-[18rem] flex-1`}>
            {t('filters.q')}
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('filters.qPlaceholder')}
              className={INPUT}
              data-filter-q=""
            />
          </label>
          <Button type="submit" className="h-9" disabled={orders.isFetching || problem !== null} data-orders-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button
            variant="outlined"
            className="h-9"
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

        <div role="group" aria-label={t('filters.outcome')} className="flex flex-wrap items-center gap-1.5" data-filter-outcomes="">
          <span className="text-xs font-medium text-muted-foreground">{t('filters.outcome')}</span>
          {ORDER_OUTCOME_FILTERS.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={query.outcome.includes(o)}
              onClick={() => update({ outcome: toggled<HungerStationOutcomeFilter>(query.outcome, o) })}
              className={CHIP + ' border-border/60 text-foreground'}
              data-filter-outcome={o}
            >
              {t(`outcomeFilters.${o}`)}
            </button>
          ))}
        </div>

        {problem !== null && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-window-problem={problem}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {problem === 'tooLong'
              ? t('filters.windowTooLong', { count: HUNGERSTATION_ORDERS_MAX_DAYS, max: fsi(String(HUNGERSTATION_ORDERS_MAX_DAYS)) })
              : problem === 'outOfBounds'
                ? t('filters.windowOutOfBounds', { earliest: fsi(ORDERS_EARLIEST_DAY), latest: fsi(addDays(today, 1)) })
                : t(problem === 'reversed' ? 'filters.windowReversed' : 'filters.windowInvalid')}
          </p>
        )}
        {serverWindow && (
          <div data-window-problem="server">
            <InlineRefusal message={apiErrorMessage(orders.error, t('results.windowRefused'))} code={apiErrorCode(orders.error)} />
          </div>
        )}
      </form>

      {problem === null && orders.isError && !serverWindow && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(orders.error, t('results.failed'))} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-24rem)] min-h-96" data-orders-grid="">
          <AgGridReact<Row>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.orderId}
            rowClassRules={rowClassRules}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // Fifteen columns: render every one, so a cell off to the side is in the DOM for
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
        </div>
      </div>

      {details && <OrderDrawer row={details} linkStores={manageStores} onClose={() => setDetails(null)} onRaw={setRaw} onRetry={setRetry} />}
      {raw && <RawDrawer target={raw} onClose={() => setRaw(null)} />}
      {retry && <RetryDialog target={retry} onClose={() => setRetry(null)} />}
    </div>
  )
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('hungerstation-orders')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
