/**
 * The store sync console's wire shapes (spec 444, ticket 445) — the ONE model file
 * of the feature, which 446–449 extend rather than duplicate.
 *
 * 🔑 **The door contract is the only source** —
 * `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. Every
 * type below mirrors it field for field, camelCase, its enums as string unions. A
 * shape change goes to the contract first, then here.
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with **no
 * offset** (`no-utc-time`), and an absent one is `null`. They stay strings: format
 * them through `@/core/util/date-format`, never append a `Z` or `toISOString()` one.
 *
 * Ticket 445 lands the shared enums, the shared shapes and the read doors the Fleet
 * page calls; ticket 446 adds the store page's reads, 447 and 448 the controls and commands,
 * and 449 the onboarding doors.
 */

// ── Shared enums ────────────────────────────────────────────────────────────────

/** Who runs a store's sync. `None` is wire-only, on dismissed pending masters. */
export type SyncHost = 'Worker' | 'Wpf' | 'None'

/**
 * A store's door-derived states (2522 §3) — a store can be in several at once.
 * 🚩 The console never derives one of these itself; it only labels them.
 */
export type StoreState =
  | 'onWorker'
  | 'onWpf'
  | 'paused'
  | 'offline'
  | 'behind'
  | 'erroring'
  | 'controlPending'

/** Every `StoreState`, in the contract's order — the order the tiles and the query use. */
export const STORE_STATES: readonly StoreState[] = [
  'onWorker',
  'onWpf',
  'paused',
  'offline',
  'behind',
  'erroring',
  'controlPending',
]

export type PassOutcome = 'Ok' | 'Partial' | 'Failed' | 'Skipped' | 'None'
export type SyncLoop = 'push' | 'pull'
export type CommandKind = 'RetryNow' | 'RePush' | 'ConnectionTest'
export type CommandStatus = 'Pending' | 'Running' | 'Done' | 'Failed' | 'Cancelled' | 'Expired'
export type ControlAction = 'Move' | 'HandBack' | 'Pause' | 'Resume'
export type AuditAction =
  | ControlAction
  | 'RePush'
  | 'RetryNow'
  | 'ConnectionTest'
  | 'CancelCommand'
  | 'CreateLocation'
  | 'EditLocation'
  | 'DismissPending'
  | 'OnboardStore'
  | 'EditStore'
export type HourCell = 'work' | 'idle' | 'passErrors' | 'connectFailOnly' | 'noData'

/** `ActionSync/Fleet`'s `sort` — `mostBehind` is the door's default. */
export type FleetSort = 'mostBehind' | 'longestOffline' | 'newestError' | 'code'

// ── Shared shapes ───────────────────────────────────────────────────────────────

/** The contract's paged `data`. */
export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface LoopHealth {
  lastPassAt: string | null
  lastPassOutcome: PassOutcome
  lastErrorAt: string | null
  lastError: string | null
}

/**
 * A fleet list item, and the store header. A **WPF store** has no health row: every
 * health field is `null` or `0`, and `states` contains `onWpf`.
 */
export interface StoreRow {
  code: string
  description: string
  host: 'Worker' | 'Wpf'
  isPaused: boolean
  /** `appliedVersion < controlVersion` — the "pending" badge reads this. */
  controlPending: boolean
  states: StoreState[]
  lastConnectOkAt: string | null
  lastConnectFailAt: string | null
  lastConnectError: string | null
  backoffUntil: string | null
  push: LoopHealth
  pull: LoopHealth
  /** 0 for a WPF store (no health row). */
  pendingActions: number
  oldestPendingActionAt: string | null
  lastTrxPulledAt: string | null
  /** `null` = no health row (a WPF store). */
  healthUpdatedAt: string | null
}

// ── Access probe — `GET ActionSync/Access` ───────────────────────────────────────

export interface SyncConsoleAccess {
  /** `ActionSync.Health.View` — the menu leaf and every read. */
  screenAllowed: boolean
  /** `ActionSync.Operate` — every control. */
  canOperate: boolean
  /** `Store.Onboard` — the store-master step and Edit store. */
  canOnboard: boolean
}

// ── Read doors (`ActionSync.Health.View`) ──────────────────────────────────────

/** `GET ActionSync/Workers` → `{ items }`, not paged. */
export interface SyncWorker {
  instance: string
  version: string
  gateOn: boolean
  pushWidth: number
  pullWidth: number
  pushInFlight: number
  pullInFlight: number
  lastFlushAt: string | null
  /** `lastFlushAt` older than 2 × the flush interval — the door decides, not the console. */
  isStale: boolean
  /** Read-only display: chunk size, budget, intervals… */
  settings: Record<string, string>
}

export interface SyncWorkers {
  items: SyncWorker[]
}

/** `GET ActionSync/Fleet/Summary`. */
export interface FleetSummary {
  asOf: string
  total: number
  counts: Record<StoreState | 'all', number>
}

export interface HourTotals {
  hour: string
  pushPasses: number
  pullPasses: number
  connectFailures: number
  chunksPushed: number
  actionsPushed: number
  trxPulled: number
  errors: number
}

/** `GET ActionSync/Fleet/LastHour`. */
export interface FleetLastHour {
  current: HourTotals
  previous: HourTotals
}

// ── The store page's reads (ticket 446) ─────────────────────────────────────────

/** Every `HourCell`, in the strip legend's order. */
export const HOUR_CELLS: readonly HourCell[] = ['work', 'idle', 'passErrors', 'connectFailOnly', 'noData']

/**
 * `GET ActionSync/Store?code=` — the store header: a fleet row plus its control
 * versions. An unknown code is a 404 with code `NO_STORE`.
 */
export interface StoreDetail extends StoreRow {
  controlVersion: number
  appliedVersion: number
  appliedAt: string | null
}

/** One hour of `GET ActionSync/Store/Hours?code=&hours=` — a row-less hour is `noData` with zeros. */
export interface StoreHour {
  hour: string
  cell: HourCell
  pushPasses: number
  pullPasses: number
  connectFailures: number
  actionsPushed: number
  trxPulled: number
  errors: number
}

/** `GET ActionSync/Store/Hours` → `{ items }`, oldest first. */
export interface StoreHours {
  items: StoreHour[]
}

/** A counter's direction: `Out` is pushed to the store, `In` is pulled from it. */
export type CounterBound = 'Out' | 'In'

/** The contract's `Counter`, one of `GET ActionSync/Store/Counters?code=`. */
export interface StoreCounter {
  objectId: string
  bound: CounterBound
  lineNumber: number
  counter: number
  /** `MAX(ActionNo)` in the 41-day window — push only. */
  logHead: number | null
  lag: number | null
  oldestPendingAt: string | null
}

export interface StoreCounters {
  items: StoreCounter[]
}

/** The contract's `Pass`, one of `GET ActionSync/Store/Passes?code=&from=&page=&pageSize=`, newest first. */
export interface StorePass {
  processId: string
  loop: SyncLoop
  /** `null` only when the process row holds no usable start time (contract, met in 450). */
  startOn: string | null
  finishOn: string | null
  /** `Ok`, `Failed` or `None` in practice: `Partial` and `Skipped` are loop outcomes only. */
  status: PassOutcome
  actionsCount: number
  errorMessage: string | null
}

export type PassLineStatus = 'Ok' | 'Error'

/** One row of `GET ActionSync/Store/PassDetail?processId=`. */
export interface PassDetailLine {
  lineNumber: number
  objectId: string
  identifiers: string
  actionType: string
  counter: number
  lineStatus: PassLineStatus
  startOn: string | null
  finishOn: string | null
  errorMessage: string | null
}

export interface PassDetail {
  items: PassDetailLine[]
}

/** One of `GET ActionSync/Store/Scripts?code=`. 🚩 The SQL text is never on the wire. */
export interface StoreScript {
  scriptId: string
  /** Always `null` for now: HQ records no creation time for a script (2539). */
  createdAt: string | null
  isExecuted: boolean
  lastAttempt: string | null
  errorMessage: string | null
}

export interface StoreScripts {
  items: StoreScript[]
}

/** `GET ActionSync/Store/Location?code=`. 🚩 Never `userId` or `password` — none is added here. */
export interface StoreLocation {
  code: string
  description: string
  ip: string
  instance: string
  dbName: string
  groupId: string
  father: string
  isPosSyncEnabled: boolean
}

// ── The control door and the audit feed (ticket 447) ─────────────────────────────

/** Every `ControlAction`, in the contract's order. */
export const CONTROL_ACTIONS: readonly ControlAction[] = ['Move', 'HandBack', 'Pause', 'Resume']

/** `POST ActionSync/Stores/Control` — 1–50 codes and a reason that is not blank. */
export interface StoreControlRequest {
  action: ControlAction
  codes: string[]
  reason: string
}

/** One store's answer. `error` is a plain code (`NOT_ON_WORKER`, `NO_STORE`), `null` on success. */
export interface StoreControlResult {
  code: string
  ok: boolean
  error: string | null
  controlVersion: number
}

export interface StoreControlResponse {
  auditId: string
  results: StoreControlResult[]
}

/** One entry of `GET ActionSync/Audit?from=&to=&who=&code=&page=&pageSize=`, newest first. */
export interface SyncAudit {
  id: string
  at: string
  who: string
  action: AuditAction
  codes: string[]
  batchId: string | null
  before: string | null
  after: string | null
  reason: string
}

// ── The command doors (ticket 448) ───────────────────────────────────────────────

/** Every `CommandStatus`, in the contract's order. */
export const COMMAND_STATUSES: readonly CommandStatus[] = ['Pending', 'Running', 'Done', 'Failed', 'Cancelled', 'Expired']

/** Every `CommandKind`, in the contract's order. */
export const COMMAND_KINDS: readonly CommandKind[] = ['RetryNow', 'RePush', 'ConnectionTest']

/** One of `GET ActionSync/Commands?status=&batch=&code=&kind=&page=&pageSize=`, newest first. */
export interface SyncCommand {
  id: string
  batchId: string
  code: string
  kind: CommandKind
  objectId: string | null
  fromDate: string | null
  status: CommandStatus
  /** The worker's clamped result message — free text, `null` until it has one. */
  result: string | null
  requestedBy: string
  requestedAt: string
  finishedAt: string | null
}

/** `POST ActionSync/Commands` — the two one-shot commands that carry no inputs of their own. */
export interface SyncCommandRequest {
  kind: 'RetryNow' | 'ConnectionTest'
  codes: string[]
  reason: string
}

/** One store's answer. `error` is a plain code (`NOT_ON_WORKER`, `DUPLICATE_PENDING`), `null` on success. */
export interface SyncCommandResult {
  code: string
  ok: boolean
  commandId: string | null
  error: string | null
}

export interface SyncCommandResponse {
  batchId: string
  auditId: string
  results: SyncCommandResult[]
}

/** `POST ActionSync/Commands/RePush`. `objectIds: null` = every push object. */
export interface RePushRequest {
  codes: string[]
  objectIds: string[] | null
  fromDate: string
  reason: string
  preview: boolean
}

export interface RePushStoreResult {
  code: string
  actions: number
  ok: boolean
  error: string | null
  commandId: string | null
}

/** The re-push answer. A preview writes nothing: its `batchId` and `auditId` are `null`. */
export interface RePushResponse {
  preview: boolean
  /** The date the door will replay from, after clamping to the 41-day window. */
  effectiveFromDate: string
  totalActions: number
  perStore: RePushStoreResult[]
  batchId: string | null
  auditId: string | null
}

/** `POST ActionSync/Commands/Cancel`. */
export interface CancelCommandsRequest {
  commandIds: string[]
  reason: string
}

/** One command's answer; `error` is a plain code (`NOT_PENDING`). */
export interface CancelCommandResult {
  commandId: string
  ok: boolean
  error: string | null
}

export interface CancelCommandsResponse {
  results: CancelCommandResult[]
}

// ── Onboarding: the pending list, the location doors and the store master (ticket 449) ──

/** One of `GET ActionSync/PendingStores?page=&pageSize=` — a store master with no sync location yet. */
export interface PendingStore {
  code: string
  description: string
  city: string
  createdAt: string | null
}

/** One row of `POST ActionSync/Locations`. 🚩 No credentials: the server copies them from the template. */
export interface LocationRowInput {
  code: string
  description: string
  ip: string
}

/** `POST ActionSync/Locations` — 1–200 rows (the console sends at most 50, ruled). */
export interface CreateLocationsRequest {
  templateCode: string
  rows: LocationRowInput[]
  reason: string
  preview: boolean
}

/**
 * One row's answer. `error` is a plain code (`BAD_CODE`, `NO_STORE`, `LOCATION_EXISTS`,
 * `NO_TEMPLATE`, `DUPLICATE_IN_BATCH`), `null` on success.
 */
export interface CreateLocationResult {
  code: string
  ok: boolean
  error: string | null
  host: SyncHost | null
  /** The connection test queued for a created row (non-preview only); its failure is only a warning. */
  connectionTestCommandId: string | null
}

export interface CreateLocationsResponse {
  results: CreateLocationResult[]
}

/** `POST ActionSync/Locations/Edit`. 🚩 Never a credential. */
export interface EditLocationRequest {
  code: string
  description: string
  ip: string
  instance: string
  dbName: string
  reason: string
}

/** The answer of the audited single-write doors (Edit location, Dismiss, Edit store). */
export interface AuditedWriteResponse {
  auditId: string
}

/** `POST ActionSync/PendingStores/Dismiss` — 1–50 codes. */
export interface DismissPendingRequest {
  codes: string[]
  reason: string
}

/** One store master row of `Store/Onboard`. `ip` is required when the location is created too. */
export interface StoreInput {
  code: string
  description: string
  city: string
  area: string
  address: string
  phone: string
  cr: string
  ip: string | null
}

/** `POST Store/Onboard/Preview` and `POST Store/Onboard`. */
export interface OnboardRequest {
  templateStore: string
  rows: StoreInput[]
  reason: string
  alsoCreateLocation: boolean
  locationTemplateCode: string | null
}

/**
 * One row's answer. A store that already exists is **skipped** (`storeSkipped`) and
 * continues to step 2. `error` is a plain code (`BAD_CODE`, `STORE_EXISTS`,
 * `NO_TEMPLATE`, or a location refusal); `warning` is shown as a warning only.
 */
export interface OnboardResult {
  code: string
  storeCreated: boolean
  storeSkipped: boolean
  locationCreated: boolean
  ok: boolean
  error: string | null
  warning: string | null
}

export interface OnboardResponse {
  results: OnboardResult[]
}

/** `POST Store/Edit` — the store master's address fields. */
export interface EditStoreRequest {
  code: string
  description: string
  city: string
  area: string
  address: string
  phone: string
  cr: string
  reason: string
}
