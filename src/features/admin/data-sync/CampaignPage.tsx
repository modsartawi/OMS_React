import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { ArrowLeft, Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { DATA_SYNC_PAGE_SIZE, JOB_STATUSES, type Campaign, type Job, type JobStatus } from '@/core/models/data-sync'
import {
  campaignJobsKey,
  campaignJobsQuery,
  campaignKey,
  campaignQuery,
  campaignSummaryKey,
  canOpenDataSync,
  dataSyncAccessQuery,
  profilesQuery,
} from './api'
import CampaignHeader from './CampaignHeader'
import { CreateWarningsNotice } from './CreateWarnings'
import { CampaignControls, jobDrawerControls, jobRowControls, useCanOperateDataSync } from './Controls'
import { useChangesLinkFooter } from './ChangesLink'
import { DATA_SYNC_DEFAULT_COL_DEF } from './campaign-columns'
import { buildJobColumns } from './job-columns'
import { campaignJobsFromParams, campaignJobsToParams, isDataSyncNotFound, pollInterval } from './job-helpers'
import HandBackButton from './HandBack'
import JobDrawer from './JobDrawer'
import Pager from './Pager'
import ServiceBannerView from './ServiceBannerView'
import StartCampaignButton from './StartCampaignButton'

/**
 * One campaign's page (spec 558, ticket 560) — `/admin/data-sync/campaigns/:campaignId`.
 *
 * The header and rollup, the jobs grid (one row per store, 50 a page, a job-status filter kept in
 * the URL) and the job drawer (`?job=`). Campaign, jobs and the open job refetch every 5 s while
 * any job is non-terminal and the tab is visible (`pollInterval`); a 404 shows a not-found state.
 * Pause / Resume / Cancel (563, `./Controls`) show for holders of `DataSync.Operate` only.
 */
export default function CampaignPage() {
  const { t } = useTranslation('data-sync')
  return (
    <ScreenGate query={dataSyncAccessQuery()} can={canOpenDataSync} ns="data-sync" title={t('campaign.placeholderTitle')} subtitle={t('subtitle')}>
      <CampaignView />
    </ScreenGate>
  )
}

const jobId = ({ data }: { data: Job }) => data.jobId

function CampaignView() {
  const { t } = useTranslation('data-sync')
  const { campaignId = '' } = useParams()
  const { query: view, update } = useUrlQuery(campaignJobsFromParams, campaignJobsToParams)
  const profiles = useQuery(profilesQuery())

  // The campaign and the page of jobs decide together whether to keep polling, from what the
  // cache last holds for both (this re-renders on every answer, so it stays current); every read of
  // the page — campaign, jobs, the drawer's job — takes the same answer, so they stop together.
  const qc = useQueryClient()
  const interval = pollInterval(
    qc.getQueryData<Campaign>(campaignSummaryKey(campaignId)),
    qc.getQueryData<Job[]>(campaignJobsKey(campaignId, view)),
  )
  const campaign = useQuery(campaignQuery(campaignId, interval))
  const jobsRead = useQuery({ ...campaignJobsQuery(campaignId, view, interval), placeholderData: keepPreviousData })

  // The read that sees the campaign finish also stops the poll — before the jobs (and the open job)
  // were re-read after the last job ended. So the moment it turns terminal, they are read once more;
  // a campaign that was already finished when the page opened needs nothing.
  const status = campaign.data?.status
  const wasLive = useRef(false)
  useEffect(() => {
    if (!status) return
    const live = status !== 'Completed' && status !== 'Cancelled'
    if (wasLive.current && !live) {
      void qc.invalidateQueries({ queryKey: [...campaignKey(campaignId), 'jobs'] })
      void qc.invalidateQueries({ queryKey: [...campaignKey(campaignId), 'job'] })
    }
    wasLive.current = live
  }, [status, qc, campaignId])

  const openJob = useCallback((id: string) => update((v) => ({ ...v, job: id })), [update])
  const closeJob = useCallback(() => update((v) => ({ ...v, job: null })), [update])
  const canOperate = useCanOperateDataSync()

  // ── 🔌 Seams for the later slices (all absent today: this slice is read-only) ──────────────
  // 561/563/565: campaign-level buttons (Start; Pause / Resume / Cancel; hand back to ActionSync).
  const headerActions: ReactNode = campaign.data && (
    <>
      <StartCampaignButton campaign={campaign.data} />
      <CampaignControls campaign={campaign.data} />
      <HandBackButton campaign={campaign.data} />
    </>
  )
  // 563: a job row's Pause / Resume / Cancel — set this and the grid grows an `actions` column.
  const jobRowActions: ((job: Job) => ReactNode) | undefined = canOperate ? jobRowControls : undefined
  // 562 (Changes link, report-only + Operate) / 563 (the open job's controls): the drawer's footer.
  const changesFooter = useChangesLinkFooter(campaign.data?.mode)
  const jobDrawerFooter: ((job: Job) => ReactNode) | undefined = useMemo(() => {
    const controls = canOperate ? jobDrawerControls : undefined
    if (!changesFooter && !controls) return undefined
    return (job: Job) => (
      <>
        {changesFooter?.(job)}
        {controls?.(job)}
      </>
    )
  }, [changesFooter, canOperate])

  const columns = useMemo(() => buildJobColumns(t, { onOpen: openJob, rowActions: jobRowActions }), [t, openJob, jobRowActions])

  const back = (
    <Link to="/admin/data-sync" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline" data-campaign-back="">
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      {t('campaign.back')}
    </Link>
  )

  if (campaign.isPending)
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status" data-campaign-page={campaignId}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('campaign.loading')}
      </div>
    )

  if (campaign.isError && isDataSyncNotFound(campaign.error))
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center" data-campaign-page={campaignId} data-campaign-not-found="">
        <p className="text-sm font-semibold">{t('campaign.notFoundTitle')}</p>
        <p className="max-w-md text-sm text-muted-foreground">{t('campaign.notFoundHint')}</p>
        {back}
      </div>
    )

  if (!campaign.data)
    return (
      <div className="flex flex-col gap-3" data-campaign-page={campaignId}>
        {back}
        <ErrorBanner className="p-3" message={apiErrorMessage(campaign.error, t('campaign.failed'))} />
      </div>
    )

  const c: Campaign = campaign.data
  const profileName = profiles.data?.find((p) => p.profileId === c.profileId)?.name ?? null
  // 🚩 A failed jobs read draws no rows: a kept previous answer belongs to the filter before it.
  const shown = jobsRead.isError ? undefined : jobsRead.data
  const rows = shown ?? []

  return (
    <div className="flex min-w-0 flex-col gap-6" data-campaign-page={campaignId}>
      <ServiceBannerView />
      <div className="flex items-center gap-3">
        {back}
        {(campaign.isFetching || jobsRead.isFetching) && !jobsRead.isPending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('refreshing')}
          </span>
        )}
      </div>
      {campaign.isError && <ErrorBanner className="p-3" message={apiErrorMessage(campaign.error, t('campaign.failed'))} />}

      <CampaignHeader campaign={c} profileName={profileName} actions={headerActions} />
      <CreateWarningsNotice />

      <section className="flex min-w-0 flex-col gap-2" aria-labelledby="ds-jobs-heading" data-jobs="">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="ds-jobs-heading" className="me-auto text-sm font-semibold">
            {t('jobs.heading')}
          </h2>
          <select
            value={view.status ?? ''}
            onChange={(e) => update((v) => ({ ...v, status: (e.target.value || null) as JobStatus | null, page: 1 }))}
            aria-label={t('jobs.status')}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm"
            data-job-status-filter=""
          >
            <option value="">{t('jobs.statusAny')}</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`jobStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>

        {jobsRead.isError && <ErrorBanner className="p-3" message={apiErrorMessage(jobsRead.error, t('jobs.failed'))} />}

        {jobsRead.isPending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('jobs.loading')}
          </div>
        ) : (
          shown && (
            <div className="overflow-hidden rounded-md border border-border/60">
              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground" data-jobs-empty="">
                  {t(view.page > 1 ? 'jobs.emptyPage' : view.status ? 'jobs.emptyFiltered' : 'jobs.empty')}
                </p>
              ) : (
                <div className="h-[28rem]" data-jobs-grid="">
                  <AgGridReact<Job>
                    theme={omsGridTheme}
                    rowData={rows}
                    columnDefs={columns}
                    defaultColDef={DATA_SYNC_DEFAULT_COL_DEF}
                    getRowId={jobId}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
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
                  busy={jobsRead.isPlaceholderData}
                  onPage={(page) => update((v) => ({ ...v, page }))}
                />
              )}
            </div>
          )
        )}
      </section>

      {view.job && (
        <JobDrawer
          key={view.job}
          campaignId={campaignId}
          jobId={view.job}
          refetchInterval={interval}
          onClose={closeJob}
          footer={jobDrawerFooter}
        />
      )}
    </div>
  )
}
