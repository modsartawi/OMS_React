/**
 * The release download queue's server calls (BackOffice spec 3396, ticket 3401; oms-react ticket 791).
 *
 * Doors under `PosReleaseQueue/` (`Services/SIS.Api/Endpoints/Pos/DownloadSlotAdminEndpoints.cs`): `Access` is cookie
 * only and answers `{ canView, canManage }`; every read door needs a cookie session plus `PosRelease.Queue.View`
 * (`BackOfficeScreen[PosReleaseQueue, 03]`) and is a bare 403 without it. Ticket 792 adds `Audit`
 * (View) and the Manage doors (`PUT Pool`, `POST Slots/{leaseId}/Free`, `PosRelease.Queue.Manage`).
 */
import { keepPreviousData, type QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  LiveSlot,
  ReleaseQueueAccess,
  SlotAuditPage,
  SlotConvergence,
  SlotFreeAnswer,
  SlotHistoryPage,
  SlotPool,
  SlotPoolSizeAnswer,
  SlotPoolSizeRequest,
  SlotQueue,
} from '@/core/models/release-queue'
import { HISTORY_PAGE_SIZE, historyParams, type HistoryFilter } from './helpers'

const BASE = 'PosReleaseQueue'

/** The ONE key the Admin menu leaf and the page's gate share, so the probe costs one call. */
export const RELEASE_QUEUE_ACCESS_KEY = ['release-queue', 'access'] as const

/** The probe's options, shared by every reader (a refusal is an answer, so no retry). */
export function releaseQueueAccessQuery() {
  return {
    queryKey: RELEASE_QUEUE_ACCESS_KEY,
    queryFn: () => releaseQueueApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** `PosRelease.Queue.View` — the nav leaf and the gate read this one predicate. `=== true`: malformed is a denial. */
export const canViewReleaseQueue = (r: ReleaseQueueAccess | null | undefined): boolean => r?.canView === true

/** How often the live panels re-read: a slot renews every 60 s, so 15 s keeps progress current without load. */
export const RELEASE_QUEUE_REFRESH_MS = 15_000

/** Every read shares this prefix. */
export const RELEASE_QUEUE_KEY = ['release-queue'] as const

export const releaseQueueApi = {
  /** `GET PosReleaseQueue/Access` → `{ canView, canManage }`. 🚩 Fails closed: no catch. */
  access(): Promise<ReleaseQueueAccess> {
    return api.get<ReleaseQueueAccess>(`${BASE}/Access`)
  },

  /** `GET PosReleaseQueue/Pool` — size (0 = paused), who/when last changed, slots in use. */
  pool(): Promise<SlotPool> {
    return api.get<SlotPool>(`${BASE}/Pool`)
  },

  /** `GET PosReleaseQueue/Slots` — the slots in use, oldest grant first. */
  slots(): Promise<LiveSlot[]> {
    return api.get<LiveSlot[]>(`${BASE}/Slots`)
  },

  /** `GET PosReleaseQueue/Queue` — the waiting tills in grant order. */
  queue(): Promise<SlotQueue> {
    return api.get<SlotQueue>(`${BASE}/Queue`)
  },

  /** `GET PosReleaseQueue/History?outcome=&store=&version=&skip=&take=` — finished leases, newest end first. */
  history(filter: HistoryFilter): Promise<SlotHistoryPage> {
    return api.get<SlotHistoryPage>(`${BASE}/History`, historyParams(filter, HISTORY_PAGE_SIZE))
  },

  /** `GET PosReleaseQueue/Convergence` — per package and to-version: downloaded, downloading, waiting. */
  convergence(): Promise<SlotConvergence[]> {
    return api.get<SlotConvergence[]>(`${BASE}/Convergence`)
  },

  /** `GET PosReleaseQueue/Audit?skip=&take=` (View) — the hand changes, newest first. The page reads one page. */
  audit(): Promise<SlotAuditPage> {
    return api.get<SlotAuditPage>(`${BASE}/Audit`, { skip: 0, take: AUDIT_PAGE_SIZE })
  },

  /**
   * `PUT PosReleaseQueue/Pool { poolSize }` (Manage, ticket 3402) — 0 pauses. Refusals are 400 envelopes:
   * `POSREL-SLOT-001` out of 0..500, `POSREL-SLOT-002` no signed-in user, `POSREL-SLOT-003` the pool is busy deciding a
   * grant (try again). The actor is the session's; nothing about who is sent.
   */
  setPoolSize(poolSize: number): Promise<SlotPoolSizeAnswer> {
    const body: SlotPoolSizeRequest = { poolSize }
    return api.put<SlotPoolSizeAnswer>(`${BASE}/Pool`, body)
  },

  /** `POST PosReleaseQueue/Slots/{leaseId}/Free` (Manage) — `{ freed: false }` when the slot had already ended. */
  freeSlot(leaseId: string): Promise<SlotFreeAnswer> {
    return api.post<SlotFreeAnswer>(`${BASE}/Slots/${encodeURIComponent(leaseId)}/Free`, {})
  },
}

/** Enough of the audit to find the last resize behind a burst of frees. */
export const AUDIT_PAGE_SIZE = 50

/** Every read a Manage change can move (never the access probe, which shares the prefix). */
export const MANAGED_READS = ['pool', 'slots', 'queue', 'history', 'convergence', 'audit'] as const

/** After a resize or a free: re-read everything it can have moved, so the page shows HQ's answer, not a guess. */
export function invalidateManagedReads(qc: QueryClient): void {
  for (const read of MANAGED_READS) void qc.invalidateQueries({ queryKey: [...RELEASE_QUEUE_KEY, read] })
}

const live = { refetchInterval: RELEASE_QUEUE_REFRESH_MS } as const

export const poolQuery = () => ({ queryKey: [...RELEASE_QUEUE_KEY, 'pool'] as const, queryFn: () => releaseQueueApi.pool(), ...live })
export const slotsQuery = () => ({ queryKey: [...RELEASE_QUEUE_KEY, 'slots'] as const, queryFn: () => releaseQueueApi.slots(), ...live })
export const queueQuery = () => ({ queryKey: [...RELEASE_QUEUE_KEY, 'queue'] as const, queryFn: () => releaseQueueApi.queue(), ...live })
export const convergenceQuery = () => ({
  queryKey: [...RELEASE_QUEUE_KEY, 'convergence'] as const,
  queryFn: () => releaseQueueApi.convergence(),
  ...live,
})
export const auditQuery = () => ({ queryKey: [...RELEASE_QUEUE_KEY, 'audit'] as const, queryFn: () => releaseQueueApi.audit(), ...live })
export const historyQuery =(filter: HistoryFilter) => ({
  queryKey: [...RELEASE_QUEUE_KEY, 'history', filter] as const,
  queryFn: () => releaseQueueApi.history(filter),
  // A new filter or page keeps the last answer on screen until HQ answers.
  placeholderData: keepPreviousData,
  ...live,
})
