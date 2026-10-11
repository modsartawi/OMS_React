/**
 * The SAP export console's wire shapes (BackOffice spec 2579, ticket 461) — the ONE model
 * file of the feature. 461 lands the WHOLE contract, so 462–465 only consume it.
 *
 * 🔑 **The door contract is the only source** —
 * `C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md`. Every
 * type below mirrors it field for field, camelCase, its enums as string unions spelled as
 * the contract spells them (`byDesign`, `heldForInventory`, `legacyUploader`, `L2a`, `U`). A
 * shape change goes to the contract first, then here.
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with **no
 * offset** (`no-utc-time`); a business day is `"yyyy-MM-dd"`; an absent time is `null`.
 * They stay strings: format them through `@/core/util/date-format`, never append a `Z`.
 *
 * 🚩 The console is **read-only**. The one write door (`POST SapExport/Recompute`)
 * recomputes the console's own rollup and never touches export data.
 */

// ── Shared enums ────────────────────────────────────────────────────────────────

/** Where a transaction stands on its way to SAP (BackOffice 2576). */
export type Label = 'exported' | 'byDesign' | 'waiting' | 'heldForInventory' | 'behind' | 'stuck'

/** Every `Label`, in the contract's order. */
export const LABELS: readonly Label[] = ['exported', 'byDesign', 'waiting', 'heldForInventory', 'behind', 'stuck']

/** Which export rail a transaction took. */
export type Rail = 'legacy' | 'new'

export const RAILS: readonly Rail[] = ['legacy', 'new']

/** The ladder's states (BackOffice 2574): legacy L1–L10 (with L2a/L2b), new rail N1–N11, and `U`. */
export type StateCode =
  | 'L1'
  | 'L2a'
  | 'L2b'
  | 'L3'
  | 'L4'
  | 'L5'
  | 'L6'
  | 'L7'
  | 'L8'
  | 'L9'
  | 'L10'
  | 'N1'
  | 'N2'
  | 'N3'
  | 'N4'
  | 'N5'
  | 'N6'
  | 'N7'
  | 'N8'
  | 'N9'
  | 'N10'
  | 'N11'
  | 'U'

/** Every `StateCode`, legacy first, then the new rail, then unclassified — the legend's order. */
export const STATE_CODES: readonly StateCode[] = [
  'L1',
  'L2a',
  'L2b',
  'L3',
  'L4',
  'L5',
  'L6',
  'L7',
  'L8',
  'L9',
  'L10',
  'N1',
  'N2',
  'N3',
  'N4',
  'N5',
  'N6',
  'N7',
  'N8',
  'N9',
  'N10',
  'N11',
  'U',
]

/**
 * A cross-rail or legacy flag beside the state. X1 double-sent · X1p double-send pending ·
 * X2 processed but stamped legacy · X3 legacy-sent, stamped new · X4 NULL version.
 */
export type Flag = 'X1' | 'X1p' | 'X2' | 'X3' | 'X4' | 'legacyResend' | 'failClosedNoDetail'

export const FLAGS: readonly Flag[] = ['X1', 'X1p', 'X2', 'X3', 'X4', 'legacyResend', 'failClosedNoDetail']

/** A store-day's export-accounting verdict. Flags never change it. */
export type Accounting = 'agrees' | 'breaks'

export type RunnerKey = 'legacyUploader' | 'idocProcessing' | 'idocBatching' | 'idocExport' | 'censusRollup'

export const RUNNER_KEYS: readonly RunnerKey[] = ['legacyUploader', 'idocProcessing', 'idocBatching', 'idocExport', 'censusRollup']

export type Liveness = 'up' | 'idle' | 'down'

/** A runner's last cycle. `none` = it never ran. */
export type CycleOutcome = 'moved' | 'idle' | 'faulted' | 'none'

export type IdentityBreakKind = 'duplicateKey' | 'orphanUploadDetail' | 'orphanSkipRow' | 'orphanEntry' | 'orphanDocument'

export const IDENTITY_BREAK_KINDS: readonly IdentityBreakKind[] = [
  'duplicateKey',
  'orphanUploadDetail',
  'orphanSkipRow',
  'orphanEntry',
  'orphanDocument',
]

/** `GET SapExport/Fleet`'s `sort`; `worst` is the door's default. */
export type FleetSort = 'worst' | 'oldestBehind' | 'mostStuck' | 'code'

export const FLEET_SORTS: readonly FleetSort[] = ['worst', 'oldestBehind', 'mostStuck', 'code']

/** `RetailTrx.IDocExportVersion`; `null` is a pre-column legacy row (flag X4 in the window). */
export type ExportVersion = 'L' | 'N'

// ── Shared shapes ───────────────────────────────────────────────────────────────

/** The contract's paged `data`. */
export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Every key present, zeros included. */
export type LabelCounts = Record<Label, number>
/** Only the non-zero codes present. */
export type StateCounts = Partial<Record<StateCode, number>>
/** Every key present. */
export type FlagCounts = Record<Flag, number>

/** A fleet list item, and the head of the store page. */
export interface FleetStoreRow {
  code: string
  description: string
  /** Transactions in the window. */
  total: number
  labels: LabelCounts
  states: StateCounts
  flags: FlagCounts
  railMix: { legacy: number; new: number }
  /** Hours past the end of the oldest behind day. */
  oldestBehindHours: number | null
  /** Store-days whose accounting breaks. */
  breakDays: number
  legacyStalled: boolean
  legacyInventoryGated: boolean
  /** The oldest `ComputedAt` among the store's rollup rows. */
  computedAt: string | null
}

// ── Access probe (2580) ─────────────────────────────────────────────────────────

/** `GET SapExport/Access` — cookie only, no grant. Drives the menu's `accessProbe`. */
export interface SapExportAccess {
  screenAllowed: boolean
}

// ── Store-day, live (2580; reasons 2581/2582; flags and verdict 2583) ──────────

/** A held document's hold (N1 only, 2582). */
export interface HeldDetail {
  held: number
  of: number
  missingRows: boolean
}

export interface StoreDayRow {
  trxNumber: string
  machineCode: string
  /** The business day. */
  trxDate: string
  counter: number
  rail: Rail
  state: StateCode
  label: Label
  version: ExportVersion | null
  trxType: number
  documentType: number
  customerId: string | null
  /** Plain text; `''` when the state needs none. */
  reason: string
  /** Set for waiting / behind / heldForInventory. */
  hoursPastDayEnd: number | null
  /** N1 only (2582). */
  held: HeldDetail | null
  /** 2583; `[]` before. */
  flags: Flag[]
  /** Legacy rows: the store's counter watermark. */
  watermark: number | null
}

/** `GET SapExport/StoreDay?code=&day=&label=&state=&page=&pageSize=`. */
export interface StoreDay {
  code: string
  day: string
  /** The classification time. */
  asOf: string
  total: number
  labels: LabelCounts
  states: StateCounts
  flags: FlagCounts
  /** `agrees` until 2583 fills the checks. */
  accounting: Accounting
  /** Worst label first (`stuck`, `behind`, `heldForInventory`, `waiting`, then the rest), then `trxNumber`. */
  rows: Paged<StoreDayRow>
}

// ── Double sends and identity breaks (2583) ─────────────────────────────────────

/** `GET SapExport/DoubleSends?code=&flag=&page=&pageSize=` → `Paged<DoubleSendRow>`, X1p first. */
export interface DoubleSendRow {
  flag: 'X1' | 'X1p'
  code: string
  trxNumber: string
  day: string
  version: ExportVersion | null
  state: StateCode
  legacyFile: string | null
  legacyUploadedAt: string | null
  documents: number
  documentsExported: number
}

/** `GET SapExport/IdentityBreaks?code=&page=&pageSize=` → `Paged<IdentityBreakRow>`. */
export interface IdentityBreakRow {
  kind: IdentityBreakKind
  code: string
  trxNumber: string
  /** `duplicateKey` only. */
  machineCode: string | null
  /** The evidence row's date where it carries one. */
  day: string | null
}

// ── Fleet, store and recompute, from the rollup (2584) ──────────────────────────

/** `GET SapExport/Fleet/Summary`. */
export interface FleetSummary {
  /** 30. */
  windowDays: number
  /** The oldest `ComputedAt` across the fleet's rows. */
  computedAt: string | null
  /** Stores with at least one rollup row. */
  stores: number
  tiles: {
    storesBehind: number
    storesStuck: number
    storesHeldForInventory: number
    /** X1 transactions. */
    doubleSent: number
    /** X1p transactions. */
    doubleSendPending: number
    /** Store-days that break. */
    accountingBreaks: number
    /** Stores. */
    legacyStalled: number
  }
}

/** `GET SapExport/Store?code=` — a fleet row and the store's export facts. */
export interface StoreExportFacts {
  /** Has a DistributionLocation under the SAP father. */
  underSap: boolean
  sapLocations: number
  hasCounterRow: boolean
  watermark: number | null
  openDate: string | null
  closed: boolean
  inventoryDate: string | null
}

export type StoreDetail = FleetStoreRow & { facts: StoreExportFacts }

/** One day of the store's window (`GET SapExport/Store/Days`). */
export interface StoreDaySummary {
  day: string
  /** `true` = never computed; every count 0, `worst` null. */
  noData: boolean
  total: number
  /** The worst label present that day. */
  worst: Label | null
  labels: LabelCounts
  states: StateCounts
  flags: FlagCounts
  accounting: Accounting | null
  oldestBehindHours: number | null
  computedAt: string | null
}

/** `GET SapExport/Store/Days?code=` → one item per day of the window, **oldest first**. */
export interface StoreDays {
  items: StoreDaySummary[]
}

/** `POST SapExport/Recompute` body. Without `day`, every day of the window. One store per request. */
export interface RecomputeRequest {
  code: string
  day?: string
}

/** Writes only the rollup. */
export interface RecomputeResponse {
  code: string
  days: number
  computedAt: string
}

// ── Runners (2585) ──────────────────────────────────────────────────────────────

export interface Runner {
  key: RunnerKey
  liveness: Liveness
  /** `false` = no heartbeat row yet: inferred from activity (2575). */
  fromHeartbeat: boolean
  host: string | null
  lastCycleStartedAt: string | null
  lastCycleEndedAt: string | null
  lastOutcome: CycleOutcome
  /** The count the last moving cycle handled. */
  lastMoved: number | null
  /** The fault text, clamped server-side. */
  lastMessage: string | null
  lastNonIdleAt: string | null
  /** What makes "down" possible; 0 = idle. */
  dueBacklog: number
  /** max(3 ticks, 15). */
  downAfterMinutes: number
}

/** `GET SapExport/Runners` → not paged, in `RunnerKey` order. */
export interface Runners {
  items: Runner[]
}
