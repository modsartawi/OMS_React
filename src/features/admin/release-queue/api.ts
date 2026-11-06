/**
 * The release download queue's server calls (BackOffice spec 3396, ticket 3401; oms-react ticket 791).
 *
 * Doors under `PosReleaseQueue/` (`Services/SIS.Api/Endpoints/Pos/DownloadSlotAdminEndpoints.cs`): `Access` is cookie
 * only and answers `{ canView, canManage }`; every read door needs a cookie session plus `PosRelease.Queue.View`
 * (`BackOfficeScreen[PosReleaseQueue, 03]`) and is a bare 403 without it. Read-only here — the Manage doors
 * (`PUT Pool`, `POST Slots/{leaseId}/Free`) and `Audit` are ticket 792's.
 */
import { keepPreviousData } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  LiveSlot,
  ReleaseQueueAccess,
  SlotConvergence,
  SlotHistoryPage,
  SlotPool,
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
export const historyQuery = (filter: HistoryFilter) => ({
  queryKey: [...RELEASE_QUEUE_KEY, 'history', filter] as const,
  queryFn: () => releaseQueueApi.history(filter),
  // A new filter or page keeps the last answer on screen until HQ answers.
  placeholderData: keepPreviousData,
  ...live,
})
