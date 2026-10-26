import { useMemo, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { AlertTriangle, ArrowLeft, Archive, Loader2, ShieldAlert } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Select from '@/core/ui/Select'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { CHANGE_KINDS, DATA_SYNC_PAGE_SIZE, type ChangeKind, type ChangeManifestRow } from '@/core/models/data-sync'
import { canOperateDataSync, changesJobQuery, changesListQuery, dataSyncAccessQuery } from './api'
import { buildChangeColumns } from './change-columns'
import { campaignPath, DATA_SYNC_DEFAULT_COL_DEF } from './campaign-columns'
import { changesFromParams, changesToParams, isManifestPruned, truncatedTables } from './changes-helpers'
import { isDataSyncNotFound, storeLabel } from './job-helpers'
import Pager from './Pager'
import ServiceBannerView from './ServiceBannerView'

/**
 * A report-only job's row-level changes (spec 558, ticket 562) — `/admin/data-sync/jobs/:jobId/changes`.
 *
 * Gated on `DataSync.Operate` (the door's own grant; a bare 403 from it shows the same denial).
 * Filters by table (the job's tables) and kind, kept in the URL; 50 a page, Next only on a full
 * page. Each row: table, kind, key and only the differing values, source against store. A table
 * whose manifest stopped at the cap is named; a pruned manifest says so.
 *
 * 🚩 Rows may hold personal data from both servers: never logged, never stored (the query keeps
 * them in memory only while shown, `gcTime: 0`), never exported (no export, no copy affordance).
 */
export default function ChangesPage() {
  const { t } = useTranslation('data-sync')
  return (
    <ScreenGate
      query={dataSyncAccessQuery()}
      can={canOperateDataSync}
      ns="data-sync"
      keyPrefix="changes.access"
      title={t('changes.title')}
      subtitle={t('changes.subtitle')}
    >
      <ChangesView />
    </ScreenGate>
  )
}

function Denied() {
  const { t } = useTranslation('data-sync')
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-changes-denied="">
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('changes.access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('changes.access.deniedHint')}</p>
    </div>
  )
}

function Notice({ icon, children, attr }: { icon: ReactNode; children: ReactNode; attr: Record<string, string> }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm" role="status" {...attr}>
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function ChangesView() {
  const { t } = useTranslation('data-sync')
  const { jobId = '' } = useParams()
  const { query: view, update } = useUrlQuery(changesFromParams, changesToParams)
  const jobRead = useQuery(changesJobQuery(jobId))
  const rowsRead = useQuery({ ...changesListQuery(jobId, view), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildChangeColumns(t), [t])

  const job = jobRead.data
  const pruned = rowsRead.isError && isManifestPruned(rowsRead.error)

  if (isBareDenial(rowsRead.error) || isBareDenial(jobRead.error)) return <Denied />

  const back = job ? (
    <Link
      to={`${campaignPath(job.campaignId)}?job=${encodeURIComponent(job.jobId)}`}
      className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
      data-changes-back=""
    >
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      {t('changes.back')}
    </Link>
  ) : null

  if (jobRead.isPending)
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status" data-changes-page={jobId}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('changes.loading')}
      </div>
    )

  if ((jobRead.isError && isDataSyncNotFound(jobRead.error)) || (rowsRead.isError && isDataSyncNotFound(rowsRead.error)))
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center" data-changes-page={jobId} data-changes-not-found="">
        <p className="text-sm font-semibold">{t('changes.notFoundTitle')}</p>
        <p className="max-w-md text-sm text-muted-foreground">{t('changes.notFoundHint')}</p>
        <Link to="/admin/data-sync" className="text-sm text-primary underline-offset-2 hover:underline">
          {t('campaign.back')}
        </Link>
      </div>
    )

  const truncated = job ? truncatedTables(job.tableTasks, view.table) : []
  // 🚩 A failed read draws no rows: a kept previous answer belongs to the filter before it.
  const shown: ChangeManifestRow[] | undefined = rowsRead.isError ? undefined : rowsRead.data
  const rows = shown ?? []
  return (
    <div className="flex min-w-0 flex-col gap-4" data-changes-page={jobId}>
      <ServiceBannerView />
      <div className="flex flex-wrap items-center gap-3">
        {back}
        {rowsRead.isFetching && !rowsRead.isPending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('refreshing')}
          </span>
        )}
      </div>

      {jobRead.isError && <ErrorBanner className="p-3" message={apiErrorMessage(jobRead.error, t('changes.jobFailed'))} />}

      {job && (
        <div className="flex flex-col gap-0.5" data-changes-job="">
          <span className="text-xs text-muted-foreground">{t('changes.eyebrow')}</span>
          <h2 className="font-mono text-sm font-semibold">
            <Ltr>{storeLabel(job.store)}</Ltr>
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            <Ltr>{job.jobId}</Ltr>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={view.table ?? ''}
          onChange={(e) => update((v) => ({ ...v, table: e.target.value || null, page: 1 }))}
          aria-label={t('changes.table')}
          data-changes-table-filter=""
        >
          <option value="">{t('changes.tableAny')}</option>
          {(job?.tableTasks ?? []).map((task) => (
            // A native <option> is a string-only sink: the table name is isolated whole.
            <option key={task.tableTaskId} value={task.table}>
              {fsi(task.table)}
            </option>
          ))}
        </Select>
        <Select
          value={view.kind ?? ''}
          onChange={(e) => update((v) => ({ ...v, kind: (e.target.value || null) as ChangeKind | null, page: 1 }))}
          aria-label={t('changes.kind')}
          data-changes-kind-filter=""
        >
          <option value="">{t('changes.kindAny')}</option>
          {CHANGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kind.${k}`)}
            </option>
          ))}
        </Select>
      </div>

      {pruned ? (
        <Notice icon={<Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />} attr={{ 'data-changes-pruned': '' }}>
          {t('changes.pruned')}
        </Notice>
      ) : (
        truncated.length > 0 && (
          <Notice icon={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention-800" aria-hidden />} attr={{ 'data-changes-truncated': '' }}>
            {t('changes.truncated')}{' '}
            {truncated.map((name, i) => (
              <span key={name} className="font-mono text-xs" data-truncated-table={name}>
                {i > 0 && ' '}
                <Ltr>{name}</Ltr>
              </span>
            ))}
          </Notice>
        )
      )}

      {rowsRead.isError && !pruned && <ErrorBanner className="p-3" message={apiErrorMessage(rowsRead.error, t('changes.failed'))} />}

      {rowsRead.isPending ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('changes.loading')}
        </div>
      ) : (
        shown && (
          <div className="overflow-hidden rounded-md border border-border/60">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground" data-changes-empty="">
                {t(view.page > 1 ? 'changes.emptyPage' : view.table || view.kind ? 'changes.emptyFiltered' : 'changes.empty')}
              </p>
            ) : (
              <div data-changes-grid="">
                <AgGridReact<ChangeManifestRow>
                  theme={omsGridTheme}
                  rowData={rows}
                  columnDefs={columns}
                  defaultColDef={DATA_SYNC_DEFAULT_COL_DEF}
                  rowHeight={OMS_GRID_ROW_HEIGHT}
                  headerHeight={OMS_GRID_HEADER_HEIGHT}
                  domLayout="autoHeight"
                  animateRows={false}
                  suppressColumnVirtualisation
                />
              </div>
            )}
            {(rows.length >= DATA_SYNC_PAGE_SIZE || view.page > 1) && (
              <Pager
                page={view.page}
                pageSize={DATA_SYNC_PAGE_SIZE}
                rowCount={rows.length}
                busy={rowsRead.isPlaceholderData}
                onPage={(page) => update((v) => ({ ...v, page }))}
              />
            )}
          </div>
        )
      )}
    </div>
  )
}
