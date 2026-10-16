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
import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import type { RuleSessionRow, RuleSessionStatus } from '@/core/models/rule-campaign'
import { ruleLookupQuery, ruleSessionsQuery } from '@/core/rules/api'
import { ruleSessionPath } from '@/core/rules/campaign-state'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair, fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import { SESSION_STATUSES, SESSION_STATUS_SEV, listQuery, sessionsQueryFromParams, sessionsQueryToParams, type FromList } from './session-query'
import { localMomentKey, momentText } from './timeline'

/**
 * Campaigns ▸ Sessions (ticket 518, BackOffice spec 2737): support's view of the rule engine's
 * customer sessions. One store's sessions on one local day (today until another is chosen), in one
 * status or all, from `RuleCampaign/Sessions` (PROVISIONAL, BackOffice 2760); or one looked up by
 * its sale id. A row opens the session: its events, its cart and its campaigns, and — for support
 * holding the permission — Cancel session.
 *
 * No access probe on the leaf yet (BackOffice 2760 seeds the permission): the doors fail closed on
 * the server; ticket 520 adds the probe.
 */
export default function SessionsPage() {
  const { t } = useTranslation('rule-sessions')
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
  const open = (e: RowClickedEvent<RuleSessionRow>) => {
    // The sale id is a link: a click on it has already navigated.
    if ((e.event?.target as Element | null)?.closest?.('a')) return
    if (e.data) navigate(ruleSessionPath(e.data.id), { state: fromList })
  }
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
            <select
              id={ids.store}
              className={RULE_INPUT}
              value={query.store}
              onChange={(e) => update((q) => ({ ...q, store: e.target.value }))}
              data-sessions-field="store"
            >
              <option value="">{t('filter.chooseStore')}</option>
              {(stores.data ?? []).map((s) => (
                <option key={s.code} value={s.code}>
                  {fsi(formatPair(s.code, s.name))}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.date} className="text-xs font-medium text-muted-foreground">
              {t('filter.date')}
            </label>
            <input
              id={ids.date}
              type="date"
              className={RULE_INPUT}
              value={asked.date}
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
              onChange={(e) => update((q) => ({ ...q, status: (e.target.value || null) as RuleSessionStatus | null }))}
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
      {stores.isError && <p className="text-xs text-danger-800">{apiErrorMessage(stores.error, t('filter.storesFailed'))}</p>}

      {!query.store ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-sessions-needs-store="">
          {t('results.needsStore')}
        </p>
      ) : (
        <>
          {sessions.isError && (
            <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(sessions.error, t('results.failed'))} />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="relative h-[calc(100vh-22rem)] min-h-96" data-sessions-grid="">
              <AgGridReact<RuleSessionRow>
                theme={omsGridTheme}
                rowData={sessions.isError ? [] : rows}
                columnDefs={columns}
                defaultColDef={DEFAULT_COL_DEF}
                getRowId={({ data }) => data.id}
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
                  <span data-status-count="">
                    <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: rows.length }} components={{ n: <Ltr /> }} />
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const DEFAULT_COL_DEF: ColDef<RuleSessionRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** The sale id as a link into the session — the keyboard's way in, beside the row click. */
function SaleIdCell({ data, context }: ICellRendererParams<RuleSessionRow, unknown, FromList>) {
  if (!data) return null
  return (
    <Link to={ruleSessionPath(data.id)} state={context} className="font-mono font-medium text-primary hover:underline" data-session-link={data.id}>
      <Ltr>{data.id}</Ltr>
    </Link>
  )
}

function StatusCell({ data }: ICellRendererParams<RuleSessionRow>) {
  const { t } = useTranslation('rule-sessions')
  return data ? <StatusBadge sev={SESSION_STATUS_SEV[data.status]}>{t(`status.${data.status}`)}</StatusBadge> : null
}

/** Local moments sort as time, whatever their seconds or fraction. */
const byMoment = (a: string, b: string) => {
  const x = localMomentKey(a ?? '')
  const y = localMomentKey(b ?? '')
  return x < y ? -1 : x > y ? 1 : 0
}

/** The sessions grid: plain cells are isolated by the core grid base; the renderers isolate their own. */
function sessionColumns(t: (key: string) => string): ColDef<RuleSessionRow>[] {
  const money: ColDef<RuleSessionRow>['valueFormatter'] = ({ value, data }) => (data ? formatMoneyIn(value as number, data.currency) : '')
  return [
    { colId: 'id', field: 'id', headerName: t('columns.saleId'), cellRenderer: SaleIdCell, minWidth: 180, flex: 1 },
    {
      colId: 'status',
      field: 'status',
      headerName: t('columns.status'),
      cellRenderer: StatusCell,
      comparator: (a: RuleSessionStatus, b: RuleSessionStatus) => SESSION_STATUSES.indexOf(a) - SESSION_STATUSES.indexOf(b),
      width: 170,
    },
    { colId: 'channel', field: 'channel', headerName: t('columns.channel'), width: 120 },
    { colId: 'member', headerName: t('columns.member'), valueGetter: ({ data }) => data?.memberId ?? '', valueFormatter: ({ value }) => value || t('walkIn'), width: 150 },
    { colId: 'currency', field: 'currency', headerName: t('columns.currency'), width: 90 },
    { colId: 'gross', field: 'gross', headerName: t('columns.gross'), valueFormatter: money, type: 'rightAligned', width: 120 },
    { colId: 'discount', field: 'discount', headerName: t('columns.discount'), valueFormatter: money, type: 'rightAligned', width: 120 },
    { colId: 'net', field: 'net', headerName: t('columns.net'), valueFormatter: money, type: 'rightAligned', width: 120 },
    { colId: 'created', field: 'created', headerName: t('columns.created'), valueFormatter: ({ value }) => momentText(value as string), comparator: byMoment, width: 170 },
    {
      colId: 'lastActivity',
      field: 'lastActivity',
      headerName: t('columns.lastActivity'),
      valueFormatter: ({ value }) => momentText(value as string),
      comparator: byMoment,
      sort: 'desc',
      width: 170,
    },
  ]
}

/** An empty answer — no session matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('rule-sessions')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
