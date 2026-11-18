/**
 * The Data sync screen's server calls (spec 558; ticket 559 lands the gate and the
 * campaigns page's reads, 560–565 add theirs here).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`) as a bare `DataSync/…`
 * path: in production IIS on the SIS.Api host proxies `/DataSync/*` to the DataSync service (same
 * origin, so the session cookie and `X-Web-Client` travel); in dev `vite.config.ts` sends
 * `/api/DataSync` to `DATASYNC_API`. The shapes are `@/core/models/data-sync`'s.
 */
import { api, isBareDenial, type ApiEnvelope } from '@/core/api'
import type {
  Campaign,
  ControlRequest,
  ChangeManifestRow,
  CreateCampaignRequest,
  DataSyncHealth,
  Job,
  RerunOffer,
  SyncProfile,
} from '@/core/models/data-sync'
import type { Paged, StoreControlRequest, StoreControlResponse, StoreRow } from '@/core/models/sync-console'
import type { Permissions } from '@/core/permissions'
import { readReadinessFleet, type FleetPageQuery, type ReadinessRow } from './apply-helpers'
import type { ControlAction } from './control-helpers'
import { changesQuery, isManifestPruned, type ChangesView } from './changes-helpers'
import { CAMPAIGNS_REFRESH_MS, campaignsQuery, type CampaignsFilter } from './helpers'
import { isDataSyncNotFound, jobsQuery, type JobsFilter } from './job-helpers'

/**
 * `DataSync.View` (`DataSyncConsole:03`, oms 909 / BackOffice spec 4002 row 46): the nav leaf and every gate. Read off
 * the one permissions answer: the DataSync service's own `GET /Access` is no longer called, so a granted user sees the
 * leaf even where the service is not deployed, and the page's `DataSync/Health` banner says it is unreachable.
 */
export const canOpenDataSync = (p: Permissions): boolean => p.has('DataSyncConsole:03')

/** `DataSync.Operate` (`DataSyncConsole:06`): every action and the Changes view. Absent, not disabled, without it. */
export const canOperateDataSync = (p: Permissions): boolean => p.has('DataSyncConsole:06')

/** Every campaigns-list read shares this prefix, so one invalidation refreshes them. */
export const CAMPAIGNS_KEY = ['data-sync', 'campaigns'] as const

export const dataSyncApi = {
  /**
   * `GET DataSync/Health` (anonymous). ⚠ A 503 (state DB unreachable) is an enveloped
   * `success:false` with no error code, so `core/api` throws a `server` ApiError with status 503
   * and drops its data — `serviceBanner` reads the error, not the data.
   */
  health(): Promise<DataSyncHealth> {
    return api.get<DataSyncHealth>('DataSync/Health')
  },

  /** `GET DataSync/Profiles` → the enabled profiles, by name. Not paged. */
  profiles(): Promise<SyncProfile[]> {
    return api.get<SyncProfile[]>('DataSync/Profiles')
  },

  /** `GET DataSync/Campaigns?status=&page=&pageSize=` → a plain array, newest first, no total. */
  campaigns(filter: CampaignsFilter): Promise<Campaign[]> {
    return api.get<Campaign[]>('DataSync/Campaigns', { ...campaignsQuery(filter) })
  },

  /** `GET DataSync/Campaigns/{id}` → one campaign with its rollup. 404 `DATASYNC_CAMPAIGN_NOT_FOUND`. */
  campaign(campaignId: string): Promise<Campaign> {
    return api.get<Campaign>(`DataSync/Campaigns/${encodeURIComponent(campaignId)}`)
  },

  /**
   * `GET DataSync/Campaigns/{id}/Jobs?status=&store=&failureReason=&page=&pageSize=` → a plain array
   * (creation order, no total), each job WITH its table tasks; the filters AND together. 400
   * `DATASYNC_INVALID_REQUEST` for an unknown status or failure reason; 404 `DATASYNC_CAMPAIGN_NOT_FOUND`.
   */
  campaignJobs(campaignId: string, filter: JobsFilter): Promise<Job[]> {
    return api.get<Job[]>(`DataSync/Campaigns/${encodeURIComponent(campaignId)}/Jobs`, { ...jobsQuery(filter) })
  },

  /** `GET DataSync/Jobs/{id}` → one job with its table tasks (the drawer). 404 `DATASYNC_JOB_NOT_FOUND`. */
  job(jobId: string): Promise<Job> {
    return api.get<Job>(`DataSync/Jobs/${encodeURIComponent(jobId)}`)
  },

  /**
   * `POST DataSync/Campaigns/{id}/{Pause|Resume|Cancel|Retry}` (tickets 563, 866) → the campaign AFTER
   * the move and its settle (Pause → Pausing or Paused; Cancel → Cancelling or Cancelled; Retry → a
   * Completed campaign is Running again). 409 `DATASYNC_INVALID_STATE` (for Retry: nothing retryable,
   * or cancelling / cancelled), 404 `DATASYNC_CAMPAIGN_NOT_FOUND`; a bare 403 without Operate.
   */
  controlCampaign(campaignId: string, action: ControlAction, body: ControlRequest): Promise<Campaign> {
    return api.post<Campaign>(`DataSync/Campaigns/${encodeURIComponent(campaignId)}/${action}`, body)
  },

  /**
   * `POST DataSync/Jobs/{id}/{Pause|Resume|Cancel|Retry}` (tickets 563, 866) → the job after the move
   * (a Retry: Queued, resuming from its checkpoints). 409 `DATASYNC_INVALID_STATE`; an apply job's
   * Resume or Retry re-checks its store: 409 `DATASYNC_STORE_BUSY` /
   * `DATASYNC_STORE_WPF_HOSTED`. 404 `DATASYNC_JOB_NOT_FOUND`; a bare 403 without Operate.
   */
  controlJob(jobId: string, action: ControlAction, body: ControlRequest): Promise<Job> {
    return api.post<Job>(`DataSync/Jobs/${encodeURIComponent(jobId)}/${action}`, body)
  },

  /**
   * `GET DataSync/Jobs/{id}/Changes?table=&kind=&page=&pageSize=` (ticket 562, **Operate**) → a
   * report-only job's manifest rows, a plain array with no total. 410 `DATASYNC_MANIFEST_PRUNED`
   * once past retention; a bare 403 without Operate. 🚩 Rows may hold personal data: never logged.
   */
  changes(jobId: string, view: ChangesView): Promise<ChangeManifestRow[]> {
    return api.get<ChangeManifestRow[]>(`DataSync/Jobs/${encodeURIComponent(jobId)}/Changes`, { ...changesQuery(view) })
  },

  // ── Create and Start (ticket 561) ──

  /**
   * `POST DataSync/Campaigns` → **201** with the campaign, created `Ready`. The whole envelope comes
   * back because an Apply create (564) carries per-store warnings in `errors[]` on a SUCCESS
   * (`DATASYNC_STORE_BUSY` / `DATASYNC_STORE_WPF_HOSTED`). Refusals throw: 404, 422×5, 400, 409.
   */
  createCampaign(body: CreateCampaignRequest): Promise<ApiEnvelope<Campaign>> {
    return api.postEnvelope<Campaign>('DataSync/Campaigns', body)
  },

  /** `POST DataSync/Campaigns/{id}/Start` → the campaign, Running. 409 `DATASYNC_INVALID_STATE`, 404. */
  startCampaign(campaignId: string): Promise<Campaign> {
    return api.post<Campaign>(`DataSync/Campaigns/${encodeURIComponent(campaignId)}/Start`, {})
  },

  // ── Re-run (spec 863, ticket 864) ──

  /**
   * `GET DataSync/Campaigns/{id}/RerunTargets` (View) → the failed stores Retry cannot help
   * (`TableFailures` / `Error` / `StoreWpfHosted`), each with its unfinished tables, and their union
   * in profile order. 404 `DATASYNC_CAMPAIGN_NOT_FOUND`. A create with `rerunOf` uses it.
   */
  rerunTargets(campaignId: string): Promise<RerunOffer> {
    return api.get<RerunOffer>(`DataSync/Campaigns/${encodeURIComponent(campaignId)}/RerunTargets`)
  },
}

export function healthQuery() {
  return {
    queryKey: ['data-sync', 'health'] as const,
    queryFn: () => dataSyncApi.health(),
    refetchInterval: CAMPAIGNS_REFRESH_MS,
    // A 503 is the answer the banner needs, not an outage to retry through.
    retry: false,
  } as const
}

export function profilesQuery() {
  return {
    queryKey: ['data-sync', 'profiles'] as const,
    queryFn: () => dataSyncApi.profiles(),
    staleTime: 5 * 60_000,
  } as const
}

export function campaignsListQuery(filter: CampaignsFilter) {
  return {
    queryKey: [...CAMPAIGNS_KEY, filter] as const,
    queryFn: () => dataSyncApi.campaigns(filter),
    refetchInterval: CAMPAIGNS_REFRESH_MS,
  } as const
}

// ── The campaign page (ticket 560) ──────────────────────────────────────────────

/**
 * Every read of ONE campaign — itself, its jobs pages, its jobs — sits under this prefix, so a
 * control (563) or a hand-back (565) refreshes the whole page with one
 * `invalidateQueries({ queryKey: campaignKey(id) })`.
 */
export const campaignKey = (campaignId: string) => ['data-sync', 'campaign', campaignId] as const

export const campaignSummaryKey = (campaignId: string) => [...campaignKey(campaignId), 'summary'] as const
export const campaignJobsKey = (campaignId: string, filter: JobsFilter) =>
  [
    ...campaignKey(campaignId),
    'jobs',
    { status: filter.status, store: filter.store?.trim() || null, failureReason: filter.failureReason ?? null, page: filter.page },
  ] as const

/** A not-found is an answer (the page says so), not an outage: never retried. Anything else once. */
const retryUnlessNotFound = (count: number, err: unknown) => !isDataSyncNotFound(err) && count < 1

/** `refetchInterval` is the page's `pollInterval(campaign, jobs)`, passed in so every read stops together. */
export function campaignQuery(campaignId: string, refetchInterval: number | false) {
  return {
    queryKey: campaignSummaryKey(campaignId),
    queryFn: () => dataSyncApi.campaign(campaignId),
    refetchInterval,
    retry: retryUnlessNotFound,
  } as const
}

export function campaignJobsQuery(
  campaignId: string,
  filter: JobsFilter,
  refetchInterval: number | false,
) {
  return {
    queryKey: campaignJobsKey(campaignId, filter),
    queryFn: () => dataSyncApi.campaignJobs(campaignId, filter),
    refetchInterval,
    retry: retryUnlessNotFound,
  } as const
}

/** The drawer's job. Keyed under its campaign when that is known, so the page's invalidation reaches it. */
export function jobQuery(campaignId: string, jobId: string, refetchInterval: number | false) {
  return {
    queryKey: [...campaignKey(campaignId), 'job', jobId] as const,
    queryFn: () => dataSyncApi.job(jobId),
    refetchInterval,
    retry: retryUnlessNotFound,
  } as const
}

// ── ActionSync doors for the Apply flow (ticket 564; 565's hand-back reuses them) ──
//
// SIS.Api doors the sync console also calls. Features never import features, so the three calls
// are written again here (spec 558) with the sync console's types from `@/core/models/sync-console`.

export const actionSyncApi = {
  /**
   * Every store ActionSync lists, all pages (`GET ActionSync/Fleet?page=&pageSize=200`), then the
   * disabled view (`disabled=only`, BackOffice 3914) so a disabled store reads as disabled rather
   * than missing. The door has no exact-codes filter, so picked stores are matched against the
   * whole fleet. Only the readiness fields are kept (`readReadinessFleet`). `withDisabled: false`
   * (the acknowledgement poll) reads the default fleet alone.
   */
  fleet(opts?: { withDisabled?: boolean }): Promise<ReadinessRow[]> {
    return readReadinessFleet((q: FleetPageQuery) => api.get<Paged<StoreRow>>('ActionSync/Fleet', q), opts)
  },

  /**
   * `POST ActionSync/Stores/Control` — 1–50 codes and a reason → per-store results on a 200
   * (`NOT_ON_WORKER`, `NO_STORE`). 400 `TOO_MANY_STORES` / `NO_STORES` / `REASON_REQUIRED`; a bare 403
   * without `ActionSync.Operate`. Batch through `storeControlBatches` + `runStoreControl`.
   */
  control(body: StoreControlRequest): Promise<StoreControlResponse> {
    return api.post<StoreControlResponse>('ActionSync/Stores/Control', body)
  },
}

/** `ActionSync.Operate` (`ActionSyncConsole:06`) — the pause (564) and the hand-back (565), off the one permissions answer. */
export const canOperateActionSync = (p: Permissions): boolean => p.has('ActionSyncConsole:06')

/** The fleet's apply readiness, read fresh each time the dialog asks (it changes as people pause stores). */
export function actionSyncFleetQuery() {
  return {
    queryKey: ['data-sync', 'action-sync-fleet'] as const,
    queryFn: () => actionSyncApi.fleet(),
    staleTime: 0,
    retry: false,
  } as const
}

// ── The Changes view (ticket 562) ───────────────────────────────────────────────

/**
 * The Changes view's own read of its job (the table filter, the truncated flags, the way back),
 * keyed apart from the campaign page: it is not polled, and the view does not know the campaign
 * before it has read the job.
 */
export function changesJobQuery(jobId: string) {
  return {
    queryKey: ['data-sync', 'changes', jobId, 'job'] as const,
    queryFn: () => dataSyncApi.job(jobId),
    retry: retryUnlessNotFound,
  } as const
}

/**
 * One page of a job's changes. 🚩 `gcTime: 0`: the rows (possibly personal data) stay in memory
 * only while the view shows them and are dropped when it closes. A prune, a not-found or a bare
 * refusal is an answer, never retried.
 */
export function changesListQuery(jobId: string, view: ChangesView) {
  return {
    queryKey: ['data-sync', 'changes', jobId, 'rows', { table: view.table, kind: view.kind, page: view.page }] as const,
    queryFn: () => dataSyncApi.changes(jobId, view),
    gcTime: 0,
    retry: (count: number, err: unknown) => !isManifestPruned(err) && !isDataSyncNotFound(err) && !isBareDenial(err) && count < 1,
  } as const
}
