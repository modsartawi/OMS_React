import { useId, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams, RowClickedEvent } from 'ag-grid-community'
import { ArrowRight } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleSessionState, RuleSessionSummary } from '@/core/models/rule-session'
import { ruleLookupQuery, ruleSessionsQuery } from '@/core/rules/api'
import { lookupName } from '@/core/rules/lookups'
import { ruleSessionPath } from '@/core/rules/campaign-state'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair, fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import { SESSIONS_TAKE, SESSION_STATUSES, SESSION_STATUS_SEV, listQuery, sessionsQueryFromParams, sessionsQueryToParams, type FromList } from './session-query'
import { localMomentKey, momentText } from './timeline'

/**
 * Campaigns ▸ Sessions (tickets 518, 527, BackOffice spec 2737): support's view of the rule
 * engine's customer sessions. One store's sessions on one local day (today until another is
 * chosen), in one state or all, newest first, from `GET Rules/Support/Sessions` (BackOffice 2760);
 * or one looked up by its sale id. A row opens the session: its events, its cart and its campaigns,
 * and Cancel session.
 *
 * No access probe on the leaf yet (BO ask B, ticket 529): the doors answer a reader without
 * `BackOfficeScreen[RuleSupport,03]` a bare 403, which the page explains. The store picker reads the
 * builder's store lookup, under the author's grant: a support reader without it types the store
 * code instead.
 */
export default function SessionsPage() {
  const { t, i18n } = useTranslation('rule-sessions')
  const navigate = useNavigate()
  const { query, update } = useUrlQuery(sessionsQueryFromParams, sessionsQueryToParams)
  // Read each render: a page left open past midnight asks for the new day.
  const asked = listQuery(query, toIsoDate(new Date()))
  // A session opened from here goes Back to the list as it was left.
  const { pathname, search } = useLocation()
  const here = pathname + search
  const fromList = useMemo((): FromList => ({ fromList: here }), [here])

  const stores = useQuery(ruleLookupQuery('stores', ''))
  const sessions = useQuery(ruleSessionsQuery(asked))
  const rows = sessions.data ?? []

  const [saleId, setSaleId] = useState('')
  const lookUp = (e: FormEvent) => {
    e.preventDefault()
    const id = saleId.trim()
    if (id) navigate(ruleSessionPath(id), { state: fromList })
  }

  const columns = useMemo(() => sessionColumns(t), [t])
  const open = (e: RowClickedEvent<RuleSessionSummary>) => {
    // The sale id is a link: a click on it has already navigated.
    if ((e.event?.target as Element | null)?.closest?.('a')) return
    if (e.data) navigate(ruleSessionPath(e.data.sessionId), { state: fromList })
  }
  // Without the store lookup (its grant is the author's), the store code is typed. What is being
  // typed is held only until it is set; otherwise the box shows the address's store.
  const typeStore = stores.isError
  const [typed, setTyped] = useState<string | null>(null)
  const setStore = () => {
    if (typed !== null) update((q) => ({ ...q, store: typed.trim() }))
    setTyped(null)
  }
  const denied = isBareDenial(sessions.error)
  const ids = { store: useId(), date: useId(), status: useId(), sale: useId() }

  return (
    <section className="flex h-full w-full flex-col gap-4" data-sessions="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-end gap-3" data-sessions-filter="">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.store} className="text-xs font-medium text-muted-foreground">
              {t('filter.store')}
            </label>
            {typeStore ? (
              <input
                id={ids.store}
                dir="ltr"
                className={`${RULE_INPUT} w-32 font-mono`}
                value={typed ?? query.store}
                maxLength={20}
                onChange={(e) => setTyped(e.target.value)}
                onBlur={setStore}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setStore()
                }}
                data-sessions-field="storeCode"
              />
            ) : (
              <select
                id={ids.store}
                className={RULE_INPUT}
                value={query.store}
                onChange={(e) => update((q) => ({ ...q, store: e.target.value }))}
                data-sessions-field="store"
              >
                <option value="">{t('filter.chooseStore')}</option>
                {/* A store from the address that the lookup does not list still shows as chosen. */}
                {query.store && !(stores.data ?? []).some((s) => s.code === query.store) && <option value={query.store}>{fsi(query.store)}</option>}
                {(stores.data ?? []).map((s) => (
                  <option key={s.code} value={s.code}>
                    {fsi(formatPair(s.code, lookupName(s, i18n.language)))}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.date} className="text-xs font-medium text-muted-foreground">
              {t('filter.date')}
            </label>
            <input
              id={ids.date}
              type="date"
              className={RULE_INPUT}
              value={asked.from}
              onChange={(e) => update((q) => ({ ...q, date: e.target.value }))}
              data-sessions-field="date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.status} className="text-xs font-medium text-muted-foreground">
              {t('filter.status')}
            </label>
            <select
              id={ids.status}
              className={RULE_INPUT}
              value={query.status ?? ''}
              onChange={(e) => update((q) => ({ ...q, status: (e.target.value || null) as RuleSessionState | null }))}
              data-sessions-field="status"
            >
              <option value="">{t('filter.allStatuses')}</option>
              {SESSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <form className="flex items-end gap-2" onSubmit={lookUp} data-sessions-lookup="">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.sale} className="text-xs font-medium text-muted-foreground">
              {t('lookup.label')}
            </label>
            <input
              id={ids.sale}
              dir="ltr"
              className={`${RULE_INPUT} w-56 font-mono`}
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
              data-sessions-field="saleId"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!saleId.trim()} data-sessions-open="">
            <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
            {t('lookup.open')}
          </Button>
        </form>
      </div>
      {stores.isError && (
        <p className="text-xs text-muted-foreground" data-sessions-stores-failed="">
          {isBareDenial(stores.error) ? t('filter.storesDenied') : <bdi>{apiErrorMessage(stores.error, t('filter.storesFailed'))}</bdi>}{' '}
          {t('filter.typeStore')}
        </p>
      )}

      {!query.store ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-sessions-needs-store="">
          {t('results.needsStore')}
        </p>
      ) : (
        <>
          {sessions.isError && (
            <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={denied ? t('results.denied') : apiErrorMessage(sessions.error, t('results.failed'))} />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="relative h-[calc(100vh-22rem)] min-h-96" data-sessions-grid="">
              <AgGridReact<RuleSessionSummary>
                theme={omsGridTheme}
                rowData={sessions.isError ? [] : rows}
                columnDefs={columns}
                defaultColDef={DEFAULT_COL_DEF}
                getRowId={({ data }) => data.sessionId}
                onRowClicked={open}
                context={fromList}
                rowClass="cursor-pointer"
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                animateRows={false}
                suppressColumnVirtualisation
                loading={sessions.isPending}
                noRowsOverlayComponent={NoRows}
                suppressNoRowsOverlay={sessions.isError}
              />
            </div>
            {!sessions.isError && (
              <div
                className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
                data-status-bar=""
              >
                {sessions.isPending ? (
                  <span>{t('results.loading')}</span>
                ) : (
                  <>
                    <span data-status-count="">
                      <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: rows.length }} components={{ n: <Ltr /> }} />
                    </span>
                    {rows.length >= SESSIONS_TAKE && (
                      <span data-status-capped="">
                        <Trans t={t} i18nKey="results.capped" values={{ n: SESSIONS_TAKE }} components={{ n: <Ltr /> }} />
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const DEFAULT_COL_DEF: ColDef<RuleSessionSummary> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** The sale id as a link into the session — the keyboard's way in, beside the row click. */
function SaleIdCell({ data, context }: ICellRendererParams<RuleSessionSummary, unknown, FromList>) {
  if (!data) return null
  return (
    <Link to={ruleSessionPath(data.sessionId)} state={context} className="font-mono font-medium text-primary hover:underline" data-session-link={data.sessionId}>
      <Ltr>{data.sessionId}</Ltr>
    </Link>
  )
}

function StatusCell({ data }: ICellRendererParams<RuleSessionSummary>) {
  const { t } = useTranslation('rule-sessions')
  return data ? <StatusBadge sev={SESSION_STATUS_SEV[data.state]}>{t(`status.${data.state}`)}</StatusBadge> : null
}

/** Local moments sort as time, whatever their seconds or fraction; a stamp never reached sorts first. */
const byMoment = (a: string | null, b: string | null) => {
  const x = a ? localMomentKey(a) : ''
  const y = b ? localMomentKey(b) : ''
  return x < y ? -1 : x > y ? 1 : 0
}

type Stamp = 'openedAt' | 'paidAt' | 'closedAt' | 'updatedAt'

/** The sessions grid: plain cells are isolated by the core grid base; the renderers isolate their own. */
function sessionColumns(t: (key: string) => string): ColDef<RuleSessionSummary>[] {
  const moment = (field: Stamp, header: string, extra: Partial<ColDef<RuleSessionSummary>> = {}): ColDef<RuleSessionSummary> => ({
    colId: field,
    field,
    headerName: t(header),
    valueFormatter: ({ value }) => momentText(value as string | null),
    comparator: byMoment,
    width: 170,
    ...extra,
  })
  return [
    { colId: 'sessionId', field: 'sessionId', headerName: t('columns.saleId'), cellRenderer: SaleIdCell, minWidth: 180, flex: 1 },
    {
      colId: 'state',
      field: 'state',
      headerName: t('columns.status'),
      cellRenderer: StatusCell,
      comparator: (a: RuleSessionState, b: RuleSessionState) => SESSION_STATUSES.indexOf(a) - SESSION_STATUSES.indexOf(b),
      width: 170,
    },
    { colId: 'channel', field: 'channel', headerName: t('columns.channel'), width: 110 },
    { colId: 'couponCode', field: 'couponCode', headerName: t('columns.coupon'), width: 130 },
    { colId: 'currency', field: 'currency', headerName: t('columns.currency'), width: 90 },
    { colId: 'rulesetVersion', field: 'rulesetVersion', headerName: t('columns.ruleset'), type: 'rightAligned', width: 100 },
    // HQ answers newest first by `openedAt`; the grid shows it so until a header is clicked.
    moment('openedAt', 'columns.opened', { sort: 'desc' }),
    moment('paidAt', 'columns.paid'),
    moment('closedAt', 'columns.closed'),
    moment('updatedAt', 'columns.updated'),
  ]
}

/** An empty answer — no session matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('rule-sessions')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
