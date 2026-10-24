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
import type { Campaign, DataSyncAccess, DataSyncHealth, SyncProfile } from '@/core/models/data-sync'
import { CAMPAIGNS_REFRESH_MS, campaignsQuery, type CampaignsFilter } from './helpers'

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
