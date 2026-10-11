/**
 * The store sync console's server calls (spec 444; ticket 445 lands the access probe
 * and the Fleet page's reads, 446–449 add theirs here).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the envelope,
 * the error taxonomy and 401 are that module's. The shapes are the door contract's
 * (`@/core/models/sync-console`).
 *
 * The doors are built (BackOffice 2539–2542) and every call here was checked against
 * them door by door (ticket 450). The stubbed drives (`tools/sync-console-*-drive.mjs`)
 * stay the screens' regression; `tools/sync-console-live-drive.mjs` is their live twin.
 *
 * Spec 2563 (ticket 456) added the mirror lane to five of these reads. Its doors are built
 * (BackOffice 2564–2572) and were checked against the client in ticket 460; each of those
 * reads still fills a member an older door leaves out (`./wire`), so the console keeps
 * working on a host not yet redeployed.
 */
import { api, apiErrorCode } from '@/core/api'
import type {
  AgreementRecheckRequest,
  AgreementRecheckResponse,
  AuditedWriteResponse,
  CancelCommandsRequest,
  CancelCommandsResponse,
  CreateLocationsRequest,
  CreateLocationsResponse,
  DeadLetterActionRequest,
  DeadLetterActionResponse,
  DismissPendingRequest,
  EditLocationRequest,
  EditStoreRequest,
  FleetLastHour,
  FleetSummary,
  OnboardRequest,
  OnboardResponse,
  Paged,
  PendingStore,
  PassDetail,
  RePushRequest,
  RePushResponse,
  StoreAgreement,
  StoreCounters,
  StoreDetail,
  StoreHours,
  StoreLocation,
  StoreMirror,
  StorePass,
  StoreRow,
  StoreControlRequest,
  StoreControlResponse,
  StoreScripts,
  SyncAudit,
  SyncCommand,
  SyncCommandRequest,
  SyncCommandResponse,
  SyncConsoleAccess,
  SyncWorkers,
} from '@/core/models/sync-console'
import { COMMANDS_PAGE_SIZE, commandsQuery, type CommandsFilter } from './command-helpers'
import { auditQuery, type AuditFilter } from './control-helpers'
import { FLEET_REFRESH_MS, fleetQuery, type FleetFilter } from './helpers'
import { PASSES_PAGE_SIZE, agreementQuery, mirrorQuery, type MirrorFilter, type StoreTab } from './store-helpers'
import {
  normaliseFleet,
  normaliseLastHour,
  normaliseStoreHours,
  normaliseWorkers,
  withMirrorLane,
  type WireLastHour,
  type WireStoreDetail,
  type WireStoreHours,
  type WireStoreRow,
  type WireWorkers,
} from './wire'

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

  /** `GET ActionSync/Workers` → the store worker's and the mirror roles' heartbeats, not paged. */
  workers(): Promise<SyncWorkers> {
    return api.get<WireWorkers>('ActionSync/Workers').then(normaliseWorkers)
  },

  /** `GET ActionSync/Fleet/Summary` → the tile counts and the "as of" stamp. */
  fleetSummary(): Promise<FleetSummary> {
    return api.get<FleetSummary>('ActionSync/Fleet/Summary')
  },

  /** `GET ActionSync/Fleet/LastHour` → the current and previous hour's totals. */
  fleetLastHour(): Promise<FleetLastHour> {
    return api.get<WireLastHour>('ActionSync/Fleet/LastHour').then(normaliseLastHour)
  },

  /** `GET ActionSync/Fleet?state=&host=&q=&sort=&page=&pageSize=` → one page of stores. */
  fleet(filter: FleetFilter): Promise<Paged<StoreRow>> {
    return api.get<Paged<WireStoreRow>>('ActionSync/Fleet', fleetQuery(filter)).then(normaliseFleet)
  },

  // ── The store page (ticket 446) ──

  /** `GET ActionSync/Store?code=` → the header. An unknown code is a 404 `NO_STORE`. */
  store(code: string): Promise<StoreDetail> {
    return api
      .get<WireStoreDetail>('ActionSync/Store', { code })
      .then(withMirrorLane)
  },

  /** `GET ActionSync/Store/Hours?code=&hours=24` → the strip, oldest hour first. */
  storeHours(code: string): Promise<StoreHours> {
    return api
      .get<WireStoreHours>('ActionSync/Store/Hours', { code, hours: STRIP_HOURS })
      .then(normaliseStoreHours)
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

  /**
   * `GET ActionSync/Store/Mirror?code=&stage=&reason=&includeAcknowledged=&page=&pageSize=`
   * (spec 2563, ticket 457) → the lane, the inbox by entity type and one page of dead
   * letters, newest last seen first. 🚩 No payload: the door never returns one.
   */
  storeMirror(code: string, filter: MirrorFilter, page: number): Promise<StoreMirror> {
    return api.get<StoreMirror>('ActionSync/Store/Mirror', mirrorQuery(code, filter, page))
  },

  /**
   * `POST ActionSync/Mirror/DeadLetters/Retry` or `…/Acknowledge` (ticket 458) — one
   * store, 1–50 dead letters, one audit row. A whole refusal (`BAD_REQUEST`,
   * `REASON_REQUIRED`, `TOO_MANY`, `NO_STORE`) throws; a per-row one (`PULL_STAGE`,
   * `ACKNOWLEDGED`, `NOT_DEAD_LETTER`, `NOT_FOUND`) comes back in `results[].error`.
   */
  deadLetters(action: 'Retry' | 'Acknowledge', body: DeadLetterActionRequest): Promise<DeadLetterActionResponse> {
    return api.post<DeadLetterActionResponse>(`ActionSync/Mirror/DeadLetters/${action}`, body)
  },

  /**
   * `GET ActionSync/Store/Agreement?code=&day=&page=&pageSize=` (spec 2563, ticket 459) →
   * the judged days (D-1..D-7, newest first; a day with no NewPos receipt is absent) and
   * one page of gaps, narrowed to `day` when one is picked.
   */
  storeAgreement(code: string, day: string | null, page: number): Promise<StoreAgreement> {
    return api.get<StoreAgreement>('ActionSync/Store/Agreement', agreementQuery(code, day, page))
  },

  /**
   * `POST ActionSync/Agreement/Recheck` (ticket 459) — one store, one listed day, one
   * audit row. `day: null` in the answer = no NewPos receipt that day (its verdict removed),
   * or a sink that cannot be judged (nothing removed).
   * A refusal (`BAD_REQUEST`, `REASON_REQUIRED`, `BAD_DATE`, `NO_STORE`) throws.
   */
  recheckAgreement(body: AgreementRecheckRequest): Promise<AgreementRecheckResponse> {
    return api.post<AgreementRecheckResponse>('ActionSync/Agreement/Recheck', body)
  },

  // ── Controls and the audit feed (ticket 447) ──

  /**
   * `POST ActionSync/Stores/Control` → one audit row and a result per store. A whole
   * refusal (`TOO_MANY_STORES`, `NO_STORES`, `REASON_REQUIRED`) throws; a per-row one
   * (`NOT_ON_WORKER`, `NO_STORE`) comes back in `results[].error`.
   */
  control(body: StoreControlRequest): Promise<StoreControlResponse> {
    return api.post<StoreControlResponse>('ActionSync/Stores/Control', body)
  },

  /** `GET ActionSync/Audit?from=&to=&who=&code=&page=&pageSize=` → one page, newest first. */
  audit(filter: AuditFilter, page: number): Promise<Paged<SyncAudit>> {
    return api.get<Paged<SyncAudit>>('ActionSync/Audit', auditQuery(filter, page))
  },

  // ── The one-shot commands (ticket 448) ──

  /** `GET ActionSync/Commands?status=&batch=&code=&kind=&page=&pageSize=` → one page, newest first. */
  commands(filter: CommandsFilter, page: number): Promise<Paged<SyncCommand>> {
    return api.get<Paged<SyncCommand>>('ActionSync/Commands', commandsQuery(filter, page))
  },

  /** `GET ActionSync/Commands?batch=` → every command of one batch (a batch holds at most 50). */
  batch(batchId: string): Promise<Paged<SyncCommand>> {
    return api.get<Paged<SyncCommand>>('ActionSync/Commands', { batch: batchId, page: 1, pageSize: COMMANDS_PAGE_SIZE })
  },

  /**
   * `POST ActionSync/Commands` → a batch id and a result per store. Per-row refusals
   * (`NOT_ON_WORKER`, `DUPLICATE_PENDING`) come back in `results[].error`.
   */
  sendCommand(body: SyncCommandRequest): Promise<SyncCommandResponse> {
    return api.post<SyncCommandResponse>('ActionSync/Commands', body)
  },

  /** `POST ActionSync/Commands/RePush` — `preview: true` writes nothing and only counts. */
  rePush(body: RePushRequest): Promise<RePushResponse> {
    return api.post<RePushResponse>('ActionSync/Commands/RePush', body)
  },

  /** `POST ActionSync/Commands/Cancel` → a result per command; `NOT_PENDING` per row. */
  cancelCommands(body: CancelCommandsRequest): Promise<CancelCommandsResponse> {
    return api.post<CancelCommandsResponse>('ActionSync/Commands/Cancel', body)
  },

  // ── Onboarding (ticket 449) ──

  /**
   * `GET ActionSync/Commands?kind=ConnectionTest` → the newest connection tests, at the
   * door's largest page. The location door names each new row's test by command id but
   * not its batch, and the commands door has no id filter, so the wizard reads the
   * newest tests and picks its own out (at most 50 of them).
   */
  connectionTests(): Promise<Paged<SyncCommand>> {
    return api.get<Paged<SyncCommand>>('ActionSync/Commands', { kind: 'ConnectionTest', page: 1, pageSize: CONNECTION_TESTS_PAGE_SIZE })
  },

  /** `GET ActionSync/PendingStores?page=&pageSize=` → store masters with no sync location, one page. */
  pendingStores(page: number): Promise<Paged<PendingStore>> {
    return api.get<Paged<PendingStore>>('ActionSync/PendingStores', { page, pageSize: PENDING_PAGE_SIZE })
  },

  /** `POST ActionSync/PendingStores/Dismiss` → one audit row for 1–50 codes. */
  dismissPending(body: DismissPendingRequest): Promise<AuditedWriteResponse> {
    return api.post<AuditedWriteResponse>('ActionSync/PendingStores/Dismiss', body)
  },

  /**
   * `POST ActionSync/Locations` — step 2 alone. `preview: true` writes nothing; a real
   * call queues a connection test per created row. Per-row refusals (`BAD_CODE`,
   * `NO_STORE`, `LOCATION_EXISTS`, `NO_TEMPLATE`, `DUPLICATE_IN_BATCH`) come back in
   * `results[].error`.
   */
  createLocations(body: CreateLocationsRequest): Promise<CreateLocationsResponse> {
    return api.post<CreateLocationsResponse>('ActionSync/Locations', body)
  },

  /** `POST ActionSync/Locations/Edit` — description, IP, instance and database only. */
  editLocation(body: EditLocationRequest): Promise<AuditedWriteResponse> {
    return api.post<AuditedWriteResponse>('ActionSync/Locations/Edit', body)
  },

  /** `POST Store/Onboard/Preview` (writes nothing) or `POST Store/Onboard` — step 1, then step 2. */
  onboard(body: OnboardRequest, preview: boolean): Promise<OnboardResponse> {
    return api.post<OnboardResponse>(preview ? 'Store/Onboard/Preview' : 'Store/Onboard', body)
  },

  /** `POST Store/Edit` — the store master's address fields. */
  editStore(body: EditStoreRequest): Promise<AuditedWriteResponse> {
    return api.post<AuditedWriteResponse>('Store/Edit', body)
  },
}

/** The door's largest page (200): the connection-test read must reach the wizard's own tests. */
const CONNECTION_TESTS_PAGE_SIZE = 200

/** The pending list pages at 50, as every console table does. */
export const PENDING_PAGE_SIZE = 50

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

/**
 * The Mirror tab's read (ticket 457), under the tab's own prefix (`storeTabKey`), so
 * the tab's Refresh and a store-wide invalidation both re-read it. Read when opened.
 */
export const storeMirrorQuery = (code: string, filter: MirrorFilter, page: number) => ({
  queryKey: [...storeKey(code), 'mirror', mirrorQuery(code, filter, page)] as const,
  queryFn: () => syncConsoleApi.storeMirror(code, filter, page),
})

/**
 * The Agreement tab's read (ticket 459), under the tab's own prefix (`storeTabKey`), so
 * the tab's Refresh and a store-wide invalidation both re-read it. Read when opened.
 */
export const storeAgreementQuery = (code: string, day: string | null, page: number) => ({
  queryKey: [...storeKey(code), 'agreement', agreementQuery(code, day, page)] as const,
  queryFn: () => syncConsoleApi.storeAgreement(code, day, page),
})

// ── The audit feed (ticket 447) ──

/** Every audit read — the fleet-wide page and each store's tab — shares this prefix. */
export const AUDIT_KEY = ['sync-console', 'audit'] as const

/** Read when opened and after a control; the feed is history, so it does not poll. */
export const auditQueryOptions = (filter: AuditFilter, page: number) => ({
  queryKey: [...AUDIT_KEY, auditQuery(filter, page)] as const,
  queryFn: () => syncConsoleApi.audit(filter, page),
})

// ── The Commands feed (ticket 448) ──

/** Every commands read — the fleet-wide page and each store's tab — shares this prefix. */
export const COMMANDS_KEY = ['sync-console', 'commands'] as const

/**
 * Commands move on their own (Pending → Running → Done), so the feed rides the
 * console's 30 s refresh, and is refetched at once after a command or a cancel.
 */
export const commandsQueryOptions = (filter: CommandsFilter, page: number) => ({
  queryKey: [...COMMANDS_KEY, commandsQuery(filter, page)] as const,
  queryFn: () => syncConsoleApi.commands(filter, page),
  ...refresh,
})

// ── A store tab's Refresh ──

/**
 * The reads one store tab draws, as a prefix: its Refresh refetches them without
 * touching the others. Audit and Commands are the fleet-wide feeds narrowed to the
 * store, so their whole prefix is asked; only the mounted (this store's) page refetches.
 */
export function storeTabKey(code: string, tab: StoreTab): readonly string[] {
  if (tab === 'audit') return AUDIT_KEY
  if (tab === 'commands') return COMMANDS_KEY
  return [...storeKey(code), tab]
}

// ── Sync pending (ticket 449) ──

/** The pending list's reads share this prefix, so a dismiss or a new location refreshes it. */
export const PENDING_KEY = ['sync-console', 'pending'] as const

/** Read when opened and after a write; the list changes only by someone's hand, so it does not poll. */
export const pendingStoresQuery = (page: number) => ({
  queryKey: [...PENDING_KEY, page] as const,
  queryFn: () => syncConsoleApi.pendingStores(page),
})
