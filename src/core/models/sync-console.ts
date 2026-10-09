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
 * page calls. The store page, command, audit and onboarding shapes join with the
 * slice that first reads them.
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
