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
import type { StoreDbFleetRow, StoreDbStore } from '@/core/models/store-database'

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

// ── 918 Jobs + Space + Backup ───────────────────────────────────────────────────

// ── 919 Restore + Blitz ─────────────────────────────────────────────────────────
