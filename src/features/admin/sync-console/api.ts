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
import { api, apiErrorCode } from '@/core/api'
import type {
  FleetLastHour,
  FleetSummary,
  Paged,
  PassDetail,
  StoreCounters,
  StoreDetail,
  StoreHours,
  StoreLocation,
  StorePass,
  StoreRow,
  StoreScripts,
  SyncConsoleAccess,
  SyncWorkers,
} from '@/core/models/sync-console'
import { FLEET_REFRESH_MS, fleetQuery, type FleetFilter } from './helpers'
import { PASSES_PAGE_SIZE } from './store-helpers'

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

  // ── The store page (ticket 446) ──

  /** `GET ActionSync/Store?code=` → the header. An unknown code is a 404 `NO_STORE`. */
  store(code: string): Promise<StoreDetail> {
    return api.get<StoreDetail>('ActionSync/Store', { code })
  },

  /** `GET ActionSync/Store/Hours?code=&hours=24` → the strip, oldest hour first. */
  storeHours(code: string): Promise<StoreHours> {
    return api.get<StoreHours>('ActionSync/Store/Hours', { code, hours: STRIP_HOURS })
  },

  /** `GET ActionSync/Store/Counters?code=` → every counter of the store. */
  storeCounters(code: string): Promise<StoreCounters> {
    return api.get<StoreCounters>('ActionSync/Store/Counters', { code })
  },

  /** `GET ActionSync/Store/Passes?code=&from=&page=&pageSize=` → one page, newest first. */
  storePasses(code: string, from: string, page: number): Promise<Paged<StorePass>> {
    return api.get<Paged<StorePass>>('ActionSync/Store/Passes', { code, from, page, pageSize: PASSES_PAGE_SIZE })
  },

  /** `GET ActionSync/Store/PassDetail?processId=` → the rows of one pass. */
  passDetail(processId: string): Promise<PassDetail> {
    return api.get<PassDetail>('ActionSync/Store/PassDetail', { processId })
  },

  /** `GET ActionSync/Store/Scripts?code=` → the store's scripts. The SQL is never on the wire. */
  storeScripts(code: string): Promise<StoreScripts> {
    return api.get<StoreScripts>('ActionSync/Store/Scripts', { code })
  },

  /** `GET ActionSync/Store/Location?code=` → the sync location, never its credentials. */
  storeLocation(code: string): Promise<StoreLocation> {
    return api.get<StoreLocation>('ActionSync/Store/Location', { code })
  },
}

/** The strip's width: the last 24 hours (the door allows 1–168). */
export const STRIP_HOURS = 24

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

// ── The store page's queries (ticket 446) ──

/**
 * Every read of one store's page shares this prefix, so a later control can refresh
 * the page in one call. A pass's detail is keyed by its process id alone
 * (`passDetailQuery`): the pass is the door's key, and its detail is read afresh
 * each time it is opened.
 */
export const storeKey = (code: string) => ['sync-console', 'store', code] as const

/** A refusal that is an answer, not an outage: retrying a `NO_STORE` only delays the "no such store" state. */
const retryUnlessNoStore = (failures: number, err: unknown) => apiErrorCode(err) !== 'NO_STORE' && failures < 1

/**
 * The header and the strip ride the Fleet page's 30 s refresh — the worker's own
 * health-flush cadence — so a store being watched does not go stale on screen. The
 * tabs read once when opened.
 */
export const storeQuery = (code: string) => ({
  queryKey: [...storeKey(code), 'header'] as const,
  queryFn: () => syncConsoleApi.store(code),
  retry: retryUnlessNoStore,
  // A `NO_STORE` is the answer, not a blip: the page stops asking for a store that does not exist.
  refetchInterval: (query: { state: { error: unknown } }) =>
    apiErrorCode(query.state.error) === 'NO_STORE' ? false : FLEET_REFRESH_MS,
})

export const storeHoursQuery = (code: string) => ({
  queryKey: [...storeKey(code), 'hours'] as const,
  queryFn: () => syncConsoleApi.storeHours(code),
  ...refresh,
})

export const storeCountersQuery = (code: string) => ({
  queryKey: [...storeKey(code), 'counters'] as const,
  queryFn: () => syncConsoleApi.storeCounters(code),
})

export const storePassesQuery = (code: string, from: string, page: number) => ({
  queryKey: [...storeKey(code), 'passes', from, page] as const,
  queryFn: () => syncConsoleApi.storePasses(code, from, page),
})

export const passDetailQuery = (processId: string) => ({
  queryKey: ['sync-console', 'pass', processId] as const,
  queryFn: () => syncConsoleApi.passDetail(processId),
})

export const storeScriptsQuery = (code: string) => ({
  queryKey: [...storeKey(code), 'scripts'] as const,
  queryFn: () => syncConsoleApi.storeScripts(code),
})

export const storeLocationQuery = (code: string) => ({
  queryKey: [...storeKey(code), 'location'] as const,
  queryFn: () => syncConsoleApi.storeLocation(code),
})
