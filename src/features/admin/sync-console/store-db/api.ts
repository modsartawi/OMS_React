/**
 * The Store database tab's server calls (oms 915–919, BackOffice spec 4016, doors 4030–4039).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`). 🚩 The doors are not built yet: paths are
 * spelled by the BO tickets, the shapes (`@/core/models/store-database`) are GUESSED — built stubbed, driven by
 * `tools/store-db-*-drive.mjs` over `tools/store-db-stubs.mjs`.
 *
 * One section per ticket, so the tickets that run side by side append inside their own block. Every query key nests
 * under `STORE_DB_KEY`; every one-store panel under `storeDbStoreKey(code)`, so Check now or a job can refresh one
 * store at once.
 */
import { api } from '@/core/api'
import type {
  StoreDbCheckNowBody,
  StoreDbFleetRow,
  StoreDbHealthCheck,
  StoreDbLiveActivity,
  StoreDbStore,
} from '@/core/models/store-database'
import { healthCheckOf } from './health-helpers'
import { liveActivityOf } from './live-helpers'

/** The root of every Store database read. */
export const STORE_DB_KEY = ['sync-console', 'store-db'] as const

/** One store's reads: its page and every panel nest under this. */
export const storeDbStoreKey = (code: string) => [...STORE_DB_KEY, 'store', code] as const

/** The readings are taken by the worker on its own cadence, not live: a minute is fresh enough. */
export const STORE_DB_STALE_MS = 60_000

/**
 * GUESSED: the Fleet door answers a bare array (unpaged — the fleet is a few hundred rows). A `{ rows }` wrapper is
 * read the same way, so either shape BO picks works.
 */
type WireFleet = StoreDbFleetRow[] | { rows?: StoreDbFleetRow[] } | null
const fleetRows = (data: WireFleet): StoreDbFleetRow[] => (Array.isArray(data) ? data : (data?.rows ?? []))

/**
 * Tolerant read of the Store door: a list the door leaves out (side copies before BO 4038) is an empty list. Fills a
 * MISSING member only — nothing is derived.
 */
const storeOf = (data: StoreDbStore): StoreDbStore => ({
  ...data,
  reading: data.reading ?? null,
  lastAttempt: data.lastAttempt ?? null,
  largestTables: data.largestTables ?? [],
  history: data.history ?? [],
  sideCopies: data.sideCopies ?? [],
})

export const storeDbApi = {
  // ── 915 Fleet ─────────────────────────────────────────────────────────────────

  /** `GET StoreDatabase/Fleet` (BO 4030; sorted + `daysToCap` BO 4031) — View. */
  fleet: async (): Promise<StoreDbFleetRow[]> => fleetRows(await api.get<WireFleet>('StoreDatabase/Fleet')),

  // ── 916 Store ─────────────────────────────────────────────────────────────────

  /** `GET StoreDatabase/Store?code=` (BO 4031) — View. The latest reading, largest tables, history, side copies. */
  store: async (code: string): Promise<StoreDbStore> => storeOf(await api.get<StoreDbStore>('StoreDatabase/Store', { code })),

  // ── 917 Live + Health ─────────────────────────────────────────────────────────

  /** `GET StoreDatabase/LiveActivity?code=` (BO 4032) — View. One look: running, head blockers, worker sessions, long trans. */
  liveActivity: async (code: string): Promise<StoreDbLiveActivity> =>
    liveActivityOf(await api.get<Partial<StoreDbLiveActivity> | null>('StoreDatabase/LiveActivity', { code })),

  /** `GET StoreDatabase/HealthCheck?code=` (BO 4032) — View. Findings with priority, check, detail and fix. */
  healthCheck: async (code: string): Promise<StoreDbHealthCheck> =>
    healthCheckOf(await api.get<Partial<StoreDbHealthCheck> | null>('StoreDatabase/HealthCheck', { code })),

  /**
   * `POST StoreDatabase/CheckNow` (BO 4032) — Act, reason, audited. Synchronous (~30 s at most, spec D3). GUESSED: it
   * answers the store as `GET StoreDatabase/Store` does, so the page's read is replaced by it. A failed read is not a
   * refusal: it comes back as a failed `lastAttempt`.
   */
  checkNow: async (body: StoreDbCheckNowBody): Promise<StoreDbStore> =>
    storeOf(await api.post<StoreDbStore>('StoreDatabase/CheckNow', body)),

  // ── 918 Jobs + Space + Backup ─────────────────────────────────────────────────

  // ── 919 Restore + Blitz ───────────────────────────────────────────────────────
}

// ── 915 Fleet ───────────────────────────────────────────────────────────────────

export const STORE_DB_FLEET_KEY = [...STORE_DB_KEY, 'fleet'] as const

export const storeDbFleetQuery = () => ({
  queryKey: STORE_DB_FLEET_KEY,
  queryFn: storeDbApi.fleet,
  staleTime: STORE_DB_STALE_MS,
})

// ── 916 Store ───────────────────────────────────────────────────────────────────

/**
 * The store's page read. Its key IS `storeDbStoreKey(code)`: a Check now (917) may `setQueryData` the fresh answer
 * there, and invalidating that key refreshes the page and every open panel nested under it.
 */
export const storeDbStoreQuery = (code: string) => ({
  queryKey: storeDbStoreKey(code),
  queryFn: () => storeDbApi.store(code),
  staleTime: STORE_DB_STALE_MS,
  enabled: code !== '',
})

// ── 917 Live + Health ───────────────────────────────────────────────────────────

/** One store's live look. Nested under the store, so the strip's Refresh takes a new look too. */
export const storeDbLiveKey = (code: string) => [...storeDbStoreKey(code), 'live'] as const

/**
 * The live look is taken when the panel opens and on Refresh — never polled, never re-taken on window focus: each
 * look runs DMV queries on a till's database, and the agent decides when to take the next.
 */
export const storeDbLiveQuery = (code: string) => ({
  queryKey: storeDbLiveKey(code),
  queryFn: () => storeDbApi.liveActivity(code),
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: false,
  enabled: code !== '',
})

/** One store's health check. Nested under the store: Refresh and Check now re-run it. */
export const storeDbHealthKey = (code: string) => [...storeDbStoreKey(code), 'health'] as const

export const storeDbHealthQuery = (code: string) => ({
  queryKey: storeDbHealthKey(code),
  queryFn: () => storeDbApi.healthCheck(code),
  staleTime: STORE_DB_STALE_MS,
  refetchOnWindowFocus: false,
  enabled: code !== '',
})

// ── 918 Jobs + Space + Backup ───────────────────────────────────────────────────

// ── 919 Restore + Blitz ─────────────────────────────────────────────────────────
