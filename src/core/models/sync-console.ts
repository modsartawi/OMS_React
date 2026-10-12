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
  // The mirror rail's (spec 2563, ticket 456) — the lane's four…
  | 'mirrorOffline'
  | 'mirrorBehind'
  | 'deadLetters'
  | 'deferredTooLong'
  // …and rail agreement's, which belongs to the `agreement`, not to the lane (2571).
  | 'railsDisagree'

/** Every `StoreState`, in the contract's order — the order the tiles and the query use. */
export const STORE_STATES: readonly StoreState[] = [
  'onWorker',
  'onWpf',
  'paused',
  'offline',
  'behind',
  'erroring',
  'controlPending',
  'mirrorOffline',
  'mirrorBehind',
  'deadLetters',
  'deferredTooLong',
  'railsDisagree',
]

/** The mirror lane's states, in the contract's order. `railsDisagree` is NOT one: it is agreement's. */
export const MIRROR_STATES = ['mirrorOffline', 'mirrorBehind', 'deadLetters', 'deferredTooLong'] as const satisfies readonly StoreState[]

export type MirrorState = (typeof MIRROR_STATES)[number]

/** Which worker a `Workers` item is (2563): the store sync worker, or one of the two mirror roles. */
export type Rail = 'store' | 'mirrorPull' | 'mirrorApply'

/** A mirror role's last tick. `None` = it never ticked. */
export type MirrorTickOutcome = 'Swept' | 'Applied' | 'SkippedLockHeld' | 'SkippedBackpressure' | 'Faulted' | 'None'

export type DeadLetterStage = 'pull' | 'apply'

/** `orphaned` = deferred past the cutoff; `poison` is the pull stage's. */
export type DeadLetterReason = 'errorCap' | 'orphaned' | 'unmapped' | 'poison'

/** A store's rail agreement over the judged window (2571). */
export type Agreement = 'agree' | 'disagree' | 'notJudged'

export type AgreementGapKind = 'missingAtCounter' | 'missingAtMirror' | 'totalMismatch'

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
  // The mirror rail and rail agreement (2563).
  | 'MirrorRetry'
  | 'MirrorAcknowledge'
  | 'AgreementRecheck'
  // Today's transactions (2586): one audited view of a receipt's snapshot (2589).
  | 'TransactionSnapshotView'
  // Receipt replay (spec 470): one row per push, naming the target store.
  | 'ReceiptReplay'
export type HourCell = 'work' | 'idle' | 'passErrors' | 'connectFailOnly' | 'noData'

/**
 * `ActionSync/Fleet`'s `sort` — `mostBehind` is the door's default. 2563 adds
 * `largestBacklog` (till backlog) and `mostDeadLetters`.
 */
export type FleetSort = 'mostBehind' | 'longestOffline' | 'newestError' | 'code' | 'largestBacklog' | 'mostDeadLetters'

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
  /**
   * The store's mirror lane (2563). 🚩 NESTED — never flattened onto the row. A WPF
   * store still has one: the rails are independent (ADR 0073).
   */
  mirror: MirrorLane
  /** Rail agreement over the judged window (2571). */
  agreement: Agreement
}

/**
 * A store's mirror rail (2564, 2565). `onMirror: false` (no swept location) ⇒ every
 * field below is `null`/`0` and the row carries no mirror state.
 *
 * ⚠️ `tillBacklogOldestAt` and `oldestDeferredAt` carry the **till's** clock, shown as is.
 */
export interface MirrorLane {
  onMirror: boolean
  lastPullAt: string | null
  lastPullOkAt: string | null
  lastConnectOkAt: string | null
  lastConnectFailAt: string | null
  lastConnectError: string | null
  /** `null` = never measured (no good connect yet) — not the same as `0`. */
  tillBacklogCount: number | null
  /** Till clock. */
  tillBacklogOldestAt: string | null
  /** Not yet applied, deferred excluded. */
  inboxPending: number
  inboxDeferred: number
  /** Till clock (`CreatedAt`). */
  oldestDeferredAt: string | null
  /** Both stages, unacknowledged. */
  openDeadLetters: number
}

// ── Access probe — `GET ActionSync/Access` ───────────────────────────────────────

export interface SyncConsoleAccess {
  /** `ActionSync.Health.View` — the menu leaf and every read. */
  screenAllowed: boolean
  /** `ActionSync.Operate` — every control. */
  canOperate: boolean
  /** `Store.Onboard` — the store-master step and Edit store. */
  canOnboard: boolean
  /** `ActionSync.Replay` (spec 470) — the Replay page. Independent of `canOperate`. */
  canReplay: boolean
}

// ── Read doors (`ActionSync.Health.View`) ──────────────────────────────────────

/** `GET ActionSync/Workers` → `{ items }`, not paged. The store sync worker's item (`rail: 'store'`). */
export interface SyncWorker {
  rail: 'store'
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

/** A mirror role's heartbeat (2566), one per (instance, role). */
export interface MirrorWorker {
  rail: 'mirrorPull' | 'mirrorApply'
  instance: string
  version: string
  startedAt: string | null
  lastTickAt: string | null
  lastTickOutcome: MirrorTickOutcome
  /** Clamped free text. */
  lastTickMessage: string | null
  /** `mirrorPull`: the inbox's pending rows as read at the backpressure gate. */
  inboxPending: number | null
  /** `mirrorPull`. */
  backpressureThreshold: number | null
  /** `lastTickAt` older than `MirrorWorkerStaleMinutes` — the door decides, not the console. */
  isStale: boolean
  settings: Record<string, string>
}

/** One `Workers` item: narrow on `rail`. */
export type WorkerItem = SyncWorker | MirrorWorker

export interface SyncWorkers {
  items: WorkerItem[]
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
  // The mirror rail's totals, from `PosSyncStoreHour` (2567).
  mirrorSweeps: number
  mirrorConnectFailures: number
  mirrorPulled: number
  mirrorApplied: number
  mirrorDeferred: number
  mirrorDeadLettered: number
}

/** The mirror rail's `HourTotals` (2567), in the order the last-hour panel reads them. */
export const MIRROR_HOUR_TOTALS = [
  'mirrorSweeps',
  'mirrorPulled',
  'mirrorApplied',
  'mirrorDeferred',
  'mirrorConnectFailures',
  'mirrorDeadLettered',
] as const satisfies readonly (keyof HourTotals)[]

export type MirrorHourTotal = (typeof MIRROR_HOUR_TOTALS)[number]

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
  /** The hour's Mirror line (2567) — a row-less hour is `noData` with zeros. */
  mirror: MirrorHour
}

/** The mirror rail's share of one hour of the strip. */
export interface MirrorHour {
  cell: HourCell
  sweeps: number
  connectFailures: number
  rowsPulled: number
  applied: number
  deferred: number
  errored: number
  deadLettered: number
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

// ── The mirror rail's store reads and writes (spec 2563; tickets 457, 458) ─────────

/** Every `DeadLetterStage`, in the contract's order. */
export const DEAD_LETTER_STAGES: readonly DeadLetterStage[] = ['pull', 'apply']

/** Every `DeadLetterReason`, in the contract's order. */
export const DEAD_LETTER_REASONS: readonly DeadLetterReason[] = ['errorCap', 'orphaned', 'unmapped', 'poison']

/** One entity type's inbox counts on `GET ActionSync/Store/Mirror`. */
export interface MirrorEntityCounts {
  entityType: string
  pending: number
  deferred: number
  deadLetters: number
}

/**
 * A mirror dead letter (2568), newest `lastSeenAt` first. 🚩 There is NO payload: no
 * door ever returns the event's payload, and none is added here.
 */
export interface DeadLetter {
  /** The inbox id (apply stage) or the outbox row id (pull stage). */
  id: string
  stage: DeadLetterStage
  reason: DeadLetterReason
  entityType: string
  entityId: string
  /** `null` on the pull stage. */
  action: string | null
  attempts: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  /** Clamped free text. */
  error: string | null
  /** Apply stage and unacknowledged — the door decides, not the console. */
  canRetry: boolean
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  acknowledgeReason: string | null
}

/** `GET ActionSync/Store/Mirror?code=&stage=&reason=&includeAcknowledged=&page=&pageSize=`. */
export interface StoreMirror {
  lane: MirrorLane
  byEntityType: MirrorEntityCounts[]
  deadLetters: Paged<DeadLetter>
}

/** One row a retry or an acknowledgement names. */
export interface DeadLetterRef {
  stage: DeadLetterStage
  id: string
}

/** `POST ActionSync/Mirror/DeadLetters/Retry` and `…/Acknowledge` — one store, 1–50 items. */
export interface DeadLetterActionRequest {
  code: string
  items: DeadLetterRef[]
  reason: string
}

/** One row's answer. `error` is a plain code (`PULL_STAGE`, `ACKNOWLEDGED`, `NOT_DEAD_LETTER`, `NOT_FOUND`). */
export interface DeadLetterActionResult {
  stage: DeadLetterStage
  id: string
  ok: boolean
  error: string | null
}

export interface DeadLetterActionResponse {
  /** `null` only on a sink split from HQ whose audit write failed after the rows were written (2569). */
  auditId: string | null
  results: DeadLetterActionResult[]
}

// ── Rail agreement (spec 2563; ticket 459) ───────────────────────────────────────

/** One judged business day of `GET ActionSync/Store/Agreement`. Money is a number with 3 decimals. */
export interface AgreementDay {
  /** `yyyy-MM-dd`. */
  businessDay: string
  judgedAt: string
  agrees: boolean
  mirrorCount: number
  counterCount: number
  mirrorTotal: number
  counterTotal: number
  missingAtCounter: number
  missingAtMirror: number
  totalMismatches: number
}

/** One receipt the rails disagree on. */
export interface AgreementGap {
  businessDay: string
  receiptNumber: string
  kind: AgreementGapKind
  mirrorTotal: number | null
  counterTotal: number | null
}

/**
 * `GET ActionSync/Store/Agreement?code=&day=&page=&pageSize=`. `days` is D-1..D-7, newest
 * first, and a day with no NewPos receipt is absent; `gaps` is filtered to `day` when given.
 */
export interface StoreAgreement {
  days: AgreementDay[]
  gaps: Paged<AgreementGap>
}

/** `POST ActionSync/Agreement/Recheck` — one store, one day within D-1..D-7. */
export interface AgreementRecheckRequest {
  code: string
  day: string
  reason: string
}

/**
 * `day: null` = no NewPos receipt that day (any previous verdict for it is removed), OR a sink
 * that cannot be judged (no agreement or sales tables; nothing removed). The wire does not
 * tell the two apart (2572).
 */
export interface AgreementRecheckResponse {
  /** `null` only on a sink split from HQ whose audit write failed after the verdict was written (2572). */
  auditId: string | null
  day: AgreementDay | null
}

// ── Today's transactions (spec 2586; tickets 467, 468) ───────────────────────────

/** `Store/Transactions`' `status`: the door's default is `COMPLETED`, and `all` is a value it is sent, not its default. */
export type TxStatusFilter = 'COMPLETED' | 'VOIDED' | 'all'

/** `Store/Transactions`' `kind`; `all` is the door's default. */
export type TxKindFilter = 'sale' | 'return' | 'all'

/** A receipt on the counter rail, judged live with the rail-agreement judge's keys, signs and tolerance. */
export type CounterFlag = 'arrived' | 'notYet' | 'mismatch'

/** Every `TxStatusFilter`, in the contract's order. */
export const TX_STATUS_FILTERS: readonly TxStatusFilter[] = ['COMPLETED', 'VOIDED', 'all']

/** Every `TxKindFilter`, in the contract's order. */
export const TX_KIND_FILTERS: readonly TxKindFilter[] = ['sale', 'return', 'all']

/** Every `CounterFlag`, in the contract's order. */
export const COUNTER_FLAGS: readonly CounterFlag[] = ['arrived', 'notYet', 'mismatch']

/**
 * One NewPos receipt as HQ's mirror holds it (2587). 🚩 The list never carries lines,
 * tenders or customer data — that is the snapshot's (468), behind `ActionSync.Operate`.
 */
export interface StoreTransaction {
  /** The key the snapshot door (468) is called with; not necessarily drawn. */
  transactionId: string
  receiptNumber: string
  registerId: string
  operatorId: string
  /** The header's status as stored (`COMPLETED`, `VOIDED`). */
  status: string
  isReturn: boolean
  /** Signed by the door (a return is negative, the judge's expression), 3 decimals. Never re-signed here. */
  total: number
  openedAt: string
  completedAt: string
  counter: CounterFlag
  /** `null` when the receipt is `notYet` on the counter rail. */
  counterTotal: number | null
}

/** The whole day's figures under the status and kind filters — never paged, never recomputed from a page. */
export interface StoreTransactionsSummary {
  sales: number
  returns: number
  /** Signed. */
  total: number
  lastCompletedAt: string | null
  notYet: number
  mismatches: number
}

/** `GET ActionSync/Store/Transactions?code=&day=&status=&kind=&counter=&receipt=&page=&pageSize=` (2587, 2588). */
export interface StoreTransactions {
  /** `false`: no `PosServer` connection, the sink unreachable, or a table missing. */
  available: boolean
  /** `yyyy-MM-dd`, the day the door served. */
  day: string
  summary: StoreTransactionsSummary
  /** `CompletedAt` DESC, then `receiptNumber` DESC; `pageSize` ≤ 50. */
  items: Paged<StoreTransaction>
}

/**
 * `GET ActionSync/Store/Transactions/Snapshot?code=&transactionId=` (2589, `ActionSync.Operate`).
 * Every served view is audited (`TransactionSnapshotView`). 🚩 Personal data: never logged, never stored.
 */
export interface StoreTransactionSnapshot {
  auditId: string
  receiptNumber: string
  loadedAt: string
  /** The engine's `PosTransactionSnapshot` as HQ's mirror holds it. */
  snapshot: unknown
}

// ── Receipt replay (spec 470; ticket 472) ────────────────────────────────────────
// 🚩 The contract is spec 470's PROPOSED one ("Contract (proposed; owned by the BackOffice
// spec)"); the BackOffice spec that owns these doors is not written yet, so every call is stubbed.

/** One register of the target store. */
export interface ReplayRegister {
  registerId: string
  name: string
}

/**
 * `GET ActionSync/Replay/Registers?code=` (`ActionSync.Replay`). Refusals: `NO_STORE`,
 * `NOT_NEWPOS_STORE`, `STORE_UNREACHABLE`.
 */
export interface ReplayRegisters {
  storeCode: string
  registers: ReplayRegister[]
}

/** `POST ActionSync/Replay`'s body. 🚩 `snapshot` is the PARSED object, never a string; never logged, never stored. */
export interface ReplayRequest {
  targetStoreCode: string
  registerId: string
  snapshot: Record<string, unknown>
}

/** Every external link the server can strip from a replay, in the contract's order. */
export const REPLAY_REMOVED = ['tenderCapture', 'loyaltyMember', 'insuranceClaim'] as const

export type ReplayRemoved = (typeof REPLAY_REMOVED)[number]

/**
 * `POST ActionSync/Replay`'s answer: the new sale at the target store. Refusals
 * (`success: false`): `NO_STORE`, `NOT_NEWPOS_STORE`, `STORE_UNREACHABLE`, `NO_REGISTER`,
 * `BAD_SNAPSHOT`, `NOT_A_SALE`, `NOT_COMPLETED`, `TRAINING`, `UNBALANCED`.
 */
export interface ReplayResult {
  storeCode: string
  registerId: string
  transactionId: string
  receiptNumber: string
  replayedAt: string
  replayOf: { storeCode: string; receiptNumber: string; transactionId: string }
  removed: ReplayRemoved[]
}

/**
 * One row of `GET ActionSync/Replays?page=&pageSize=` (`ActionSync.Replay`, ticket 475), newest
 * first: who replayed which source receipt into which store and register, and the new
 * receipt number. 🚩 Spec 470 writes the page as `{ rows, total }`; the console reads it as
 * its usual `Paged<T>` (`items`, `total`, `page`, `pageSize`) — a contract gap, logged for
 * the BackOffice spec.
 */
export interface ReplayRow {
  at: string
  who: string
  sourceStoreCode: string
  sourceReceiptNumber: string
  storeCode: string
  registerId: string
  receiptNumber: string
  transactionId: string
}
