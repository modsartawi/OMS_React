/**
 * The store sync console's server calls (spec 444; ticket 445 lands the access probe
 * and the Fleet page's reads, 446–449 add theirs here).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the envelope,
 * the error taxonomy and 401 are that module's. The shapes are the door contract's
 * (`@/core/models/sync-console`).
 *
 * ⚠️ **No door here has been met.** BackOffice 2539–2542 are open and unbuilt, so
 * every call is proven against stubs of the contract (`tools/sync-console-*-drive.mjs`).
 */
import { api } from '@/core/api'
import type {
  FleetLastHour,
  FleetSummary,
  Paged,
  StoreRow,
  SyncConsoleAccess,
  SyncWorkers,
} from '@/core/models/sync-console'
import { FLEET_REFRESH_MS, fleetQuery, type FleetFilter } from './helpers'

/**
 * The ONE cache key the Admin menu leaf and the console's own in-page gate share, so
 * the probe costs one call — exported rather than re-spelled, because a typo would
 * silently split the entry and let the nav and the screen disagree.
 */
export const SYNC_CONSOLE_ACCESS_KEY = ['sync-console', 'access'] as const

/**
 * …and the one set of options every reader passes. `retry: false` because a refusal
 * is an answer, not an outage; `staleTime: Infinity` because a grant does not change
 * inside a page life.
 */
export function syncConsoleAccessQuery() {
  return {
    queryKey: SYNC_CONSOLE_ACCESS_KEY,
    queryFn: () => syncConsoleApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The probe's one predicate, read by BOTH the nav leaf and the page's gate. `=== true`
 * and nothing looser, so a malformed answer is a denial.
 */
export const canOpenSyncConsole = (r: SyncConsoleAccess | null | undefined): boolean =>
  r?.screenAllowed === true

/** The Fleet page's four reads share this prefix, so one invalidation refreshes them all. */
export const FLEET_KEY = ['sync-console', 'fleet'] as const

export const syncConsoleApi = {
  /**
   * `GET ActionSync/Access` → `{ screenAllowed, canOperate, canOnboard }`.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch, on the IDoc Inspector precedent and
   * unlike `Bby/Access`: this screen controls the whole fleet's sync and its door is
   * not deployed anywhere yet. The shell already hides a leaf whose probe is pending
   * or errored, so failing closed is the absence of a catch, not code.
   */
  access(): Promise<SyncConsoleAccess> {
    return api.get<SyncConsoleAccess>('ActionSync/Access')
  },

  /** `GET ActionSync/Workers` → the worker heartbeat rows, not paged. */
  workers(): Promise<SyncWorkers> {
    return api.get<SyncWorkers>('ActionSync/Workers')
  },

  /** `GET ActionSync/Fleet/Summary` → the tile counts and the "as of" stamp. */
  fleetSummary(): Promise<FleetSummary> {
    return api.get<FleetSummary>('ActionSync/Fleet/Summary')
  },

  /** `GET ActionSync/Fleet/LastHour` → the current and previous hour's totals. */
  fleetLastHour(): Promise<FleetLastHour> {
    return api.get<FleetLastHour>('ActionSync/Fleet/LastHour')
  },

  /** `GET ActionSync/Fleet?state=&host=&q=&sort=&page=&pageSize=` → one page of stores. */
  fleet(filter: FleetFilter): Promise<Paged<StoreRow>> {
    return api.get<Paged<StoreRow>>('ActionSync/Fleet', fleetQuery(filter))
  },
}

/**
 * The refresh every Fleet read rides: 30 s while the tab is visible. A hidden tab
 * pauses (react-query's default) and catches up on focus; the "as of" stamp says
 * how fresh the numbers are either way.
 */
const refresh = { refetchInterval: FLEET_REFRESH_MS } as const

export const workersQuery = () => ({
  queryKey: [...FLEET_KEY, 'workers'] as const,
  queryFn: () => syncConsoleApi.workers(),
  ...refresh,
})

export const fleetSummaryQuery = () => ({
  queryKey: [...FLEET_KEY, 'summary'] as const,
  queryFn: () => syncConsoleApi.fleetSummary(),
  ...refresh,
})

export const fleetLastHourQuery = () => ({
  queryKey: [...FLEET_KEY, 'last-hour'] as const,
  queryFn: () => syncConsoleApi.fleetLastHour(),
  ...refresh,
})

export const fleetStoresQuery = (filter: FleetFilter) => ({
  queryKey: [...FLEET_KEY, 'stores', fleetQuery(filter)] as const,
  queryFn: () => syncConsoleApi.fleet(filter),
  ...refresh,
})
