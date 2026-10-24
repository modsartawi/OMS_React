/**
 * The Data sync screen's server calls (spec 558; ticket 559 lands the access probe and the
 * campaigns page's reads, 560–565 add theirs here).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`) as a bare `DataSync/…`
 * path: in production IIS on the SIS.Api host proxies `/DataSync/*` to the DataSync service (same
 * origin, so the session cookie and `X-Web-Client` travel); in dev `vite.config.ts` sends
 * `/api/DataSync` to `DATASYNC_API`. The shapes are `@/core/models/data-sync`'s.
 */
import { api } from '@/core/api'
import type { Campaign, DataSyncAccess, DataSyncHealth, Job, SyncProfile } from '@/core/models/data-sync'
import { CAMPAIGNS_REFRESH_MS, campaignsQuery, type CampaignsFilter } from './helpers'
import { isDataSyncNotFound, jobsQuery, type CampaignJobsView } from './job-helpers'

/**
 * The ONE cache key the Admin menu leaf and the page's own gate share, so the probe costs one
 * call. Exported rather than re-spelled: a typo would split the entry and let the nav and the
 * screen disagree.
 */
export const DATA_SYNC_ACCESS_KEY = ['data-sync', 'access'] as const

/**
 * …and the one set of options every reader passes. `retry: false` because a refusal is an answer,
 * not an outage; `staleTime: Infinity` because a grant does not change inside a page life.
 */
export function dataSyncAccessQuery() {
  return {
    queryKey: DATA_SYNC_ACCESS_KEY,
    queryFn: () => dataSyncApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The probe's one predicate (`DataSync.View`), read by BOTH the nav leaf and the gate. `=== true`, so a malformed answer is a denial. */
export const canOpenDataSync = (r: DataSyncAccess | null | undefined): boolean => r?.screenAllowed === true

/** `DataSync.Operate`: every action and the Changes view. Absent, not disabled, without it. */
export const canOperateDataSync = (r: DataSyncAccess | null | undefined): boolean => r?.canOperate === true

/** Every campaigns-list read shares this prefix, so one invalidation refreshes them. */
export const CAMPAIGNS_KEY = ['data-sync', 'campaigns'] as const

export const dataSyncApi = {
  /**
   * `GET DataSync/Access` → `{ screenAllowed, canOperate }`. Session only (no grant): a bare 401 is
   * `core/api`'s. 🚩 Fails closed — no catch; the shell hides a leaf whose probe is pending or errored.
   */
  access(): Promise<DataSyncAccess> {
    return api.get<DataSyncAccess>('DataSync/Access')
  },

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
   * `GET DataSync/Campaigns/{id}/Jobs?status=&page=&pageSize=` → a plain array (creation order, no
   * total), each job WITH its table tasks. 404 `DATASYNC_CAMPAIGN_NOT_FOUND`.
   */
  campaignJobs(campaignId: string, filter: Pick<CampaignJobsView, 'status' | 'page'>): Promise<Job[]> {
    return api.get<Job[]>(`DataSync/Campaigns/${encodeURIComponent(campaignId)}/Jobs`, { ...jobsQuery(filter) })
  },

  /** `GET DataSync/Jobs/{id}` → one job with its table tasks (the drawer). 404 `DATASYNC_JOB_NOT_FOUND`. */
  job(jobId: string): Promise<Job> {
    return api.get<Job>(`DataSync/Jobs/${encodeURIComponent(jobId)}`)
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
export const campaignJobsKey = (campaignId: string, filter: Pick<CampaignJobsView, 'status' | 'page'>) =>
  [...campaignKey(campaignId), 'jobs', { status: filter.status, page: filter.page }] as const

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
  filter: Pick<CampaignJobsView, 'status' | 'page'>,
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
