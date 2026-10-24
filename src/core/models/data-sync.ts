/**
 * DataSync's wire shapes (spec 558; ticket 559 lands every one, later slices only add calls).
 *
 * The only source is the OpenAPI draft
 * `C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\docs\api\datasync-openapi.draft.yaml`
 * (v0.2.0), field for field, camelCase, enums as their names. Where the running service (master
 * `a13f972`) differs from the draft, this file models the UNION and says so with a `[CODE]` note:
 * `Job.target` is nullable, a job's failure reason may be `Error`, and `DATASYNC_CAMPAIGN_NOT_FOUND`
 * is a real code.
 *
 * ⚠ Times are **UTC with a `Z`** (`"2026-10-24T09:05:03Z"`), unlike ActionSync's local wall-clock
 * strings (`@/core/models/sync-console`). Show them through `@/core/util/date-format`, which reads
 * them as instants and draws them local — never `toISOString()`.
 *
 * Ids are ULID strings (26 chars, Crockford base 32).
 */

/** A ULID — opaque on the client. */
export type Ulid = string

// ── Enums (contract order) ──────────────────────────────────────────────────────

export type Mode = 'ReportOnly' | 'Apply'
export const MODES: readonly Mode[] = ['ReportOnly', 'Apply']

export type Strategy = 'Reconcile' | 'Seed'
export const STRATEGIES: readonly Strategy[] = ['Reconcile', 'Seed']

export type CampaignStatus = 'Ready' | 'Running' | 'Pausing' | 'Paused' | 'Cancelling' | 'Cancelled' | 'Completed'
export const CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  'Ready',
  'Running',
  'Pausing',
  'Paused',
  'Cancelling',
  'Cancelled',
  'Completed',
]

export type JobStatus =
  | 'Queued'
  | 'Running'
  | 'Pausing'
  | 'Paused'
  | 'Cancelling'
  | 'Succeeded'
  | 'Failed'
  | 'Cancelled'
export const JOB_STATUSES: readonly JobStatus[] = [
  'Queued',
  'Running',
  'Pausing',
  'Paused',
  'Cancelling',
  'Succeeded',
  'Failed',
  'Cancelled',
]

/** Only while Running: report-only jobs compare, apply jobs reconcile. */
export type JobPhase = 'Comparing' | 'Reconciling'
export const JOB_PHASES: readonly JobPhase[] = ['Comparing', 'Reconciling']

/** No `Skipped`: a failed table does not stop the job's others. */
export type TableTaskStatus = 'Pending' | 'Running' | 'Paused' | 'Succeeded' | 'Failed'
export const TABLE_TASK_STATUSES: readonly TableTaskStatus[] = ['Pending', 'Running', 'Paused', 'Succeeded', 'Failed']

export type Disposition = 'Applied' | 'ReportedOnly'
export const DISPOSITIONS: readonly Disposition[] = ['Applied', 'ReportedOnly']

/** Only while Queued. `BackingOff` comes with `notBefore`. */
export type WaitReason = 'WaitingForPause' | 'BackingOff'
export const WAIT_REASONS: readonly WaitReason[] = ['WaitingForPause', 'BackingOff']

/** Only while Paused: a person paused it, or its store became busy. */
export type HoldReason = 'Operator' | 'StoreBusy'
export const HOLD_REASONS: readonly HoldReason[] = ['Operator', 'StoreBusy']

export type ChangeKind = 'SourceOnly' | 'Different' | 'TargetOnly'
export const CHANGE_KINDS: readonly ChangeKind[] = ['SourceOnly', 'Different', 'TargetOnly']

/** A job's failure reason. [CODE] the service also sends `Error` (a non-transient fault outside a table). */
export type JobFailureReason = 'TableFailures' | 'StoreUnreachable' | 'StoreWpfHosted' | 'TargetUnresolved' | 'Error'
export const JOB_FAILURE_REASONS: readonly JobFailureReason[] = [
  'TableFailures',
  'StoreUnreachable',
  'StoreWpfHosted',
  'TargetUnresolved',
  'Error',
]

/** A table task's failure code — the LEADING code of "a code plus detail" (no separator is specified). */
export type TableFailureCode = 'SchemaMismatch' | 'InvalidKey' | 'ConstraintViolation' | 'Error'
export const TABLE_FAILURE_CODES: readonly TableFailureCode[] = [
  'SchemaMismatch',
  'InvalidKey',
  'ConstraintViolation',
  'Error',
]

/** Every refusal / warning code the doors send ([CODE] `Refusal.cs`). */
export type DataSyncErrorCode =
  | 'DATASYNC_INVALID_REQUEST'
  | 'DATASYNC_PROFILE_NOT_FOUND'
  | 'DATASYNC_JOB_NOT_FOUND'
  | 'DATASYNC_CAMPAIGN_NOT_FOUND' // [CODE] — missing from the draft's code list
  | 'DATASYNC_REASON_REQUIRED'
  | 'DATASYNC_PROFILE_NO_APPLY_TABLES'
  | 'DATASYNC_TABLE_NOT_IN_PROFILE'
  | 'DATASYNC_UNKNOWN_STORE'
  | 'DATASYNC_SOURCE_UNAVAILABLE'
  | 'DATASYNC_INVALID_STATE'
  | 'DATASYNC_STORE_BUSY'
  | 'DATASYNC_STORE_WPF_HOSTED'
  | 'DATASYNC_MANIFEST_PRUNED'

// ── Read models ─────────────────────────────────────────────────────────────────

export interface ServerRef {
  server: string
  database: string
}

/** HQ `DistributionLocation`'s key. Both required today (spec 558 Ask A would make `client` optional). */
export interface StoreRef {
  client: string
  code: string
}

export interface TableSpec {
  /** `schema.table`, e.g. `dbo.Product`. */
  table: string
  /** [CODE] omitted when null (defaults to the primary key). */
  matchKeys?: string[] | null
  /** The compare window, e.g. `IsActive = 1`; `null` = the whole table. */
  where: string | null
  includeColumns: string[] | null
  excludeColumns: string[] | null
  applyAllowed: boolean
  strategy: Strategy
  deletesAllowed: boolean
  caseInsensitiveCompare: boolean
}

export interface SyncProfile {
  profileId: Ulid
  name: string
  source: ServerRef
  tableSet: TableSpec[]
  /** Any table `applyAllowed`. */
  allowsApply: boolean
}

/** [CODE] `running` counts Running + Pausing + Cancelling; there is no pausing/cancelling bucket. */
export interface JobsByState {
  queued: number
  running: number
  paused: number
  succeeded: number
  failed: number
  cancelled: number
}
export const JOBS_BY_STATE_KEYS: readonly (keyof JobsByState)[] = [
  'queued',
  'running',
  'paused',
  'succeeded',
  'failed',
  'cancelled',
]

export interface Campaign {
  campaignId: Ulid
  profileId: Ulid
  name: string | null
  mode: Mode
  source: ServerRef
  /** The tables this campaign actually runs (a subset or the whole profile). */
  tableSet: TableSpec[]
  status: CampaignStatus
  totalJobs: number
  jobsByState: JobsByState
  /** Apply only. */
  reason: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  asOf: string
}

export interface TableTask {
  tableTaskId: Ulid
  table: string
  status: TableTaskStatus
  phase: JobPhase | null
  disposition: Disposition
  strategy: Strategy
  rowsCompared: number
  toInsert: number
  toUpdate: number
  toDelete: number
  rowsApplied: number
  chunksDone: number
  /** `null` until the table is sized. */
  chunksTotal: number | null
  /** "A code plus detail" — `TableFailureCode` leads. */
  failureReason: string | null
  manifestTruncated: boolean
}

export interface Job {
  jobId: Ulid
  campaignId: Ulid
  store: StoreRef
  /** [CODE] nullable (the draft implies not); `database` may be `""` when the server is known. */
  target: ServerRef | null
  status: JobStatus
  phase: JobPhase | null
  /** Target-catalog FK order, parents first. */
  tableTasks: TableTask[]
  startedAt: string | null
  finishedAt: string | null
  /** `JobFailureReason` (a raw string, so an unknown reason still shows). */
  failureReason: string | null
  /** Transient attempts used (max 3). */
  attemptCount: number
  waitReason: WaitReason | null
  /** Only with `BackingOff`. */
  notBefore: string | null
  holdReason: HoldReason | null
  /** Apply jobs only; false for report-only. */
  actionSyncResumable: boolean
}

/** A JSON scalar as a manifest carries it. `null` and `""` are different values. */
export type ManifestValue = string | number | boolean | null

export interface ChangeManifestRow {
  table: string
  kind: ChangeKind
  /** Match-key column → value. */
  key: Record<string, ManifestValue>
  /** `null` for TargetOnly; on Different only the differing columns. */
  sourceValues: Record<string, ManifestValue> | null
  /** `null` for SourceOnly. */
  targetValues: Record<string, ManifestValue> | null
  capturedAt: string
}

export type StateDbHealth = 'Ok' | 'Unreachable'

export interface DataSyncHealth {
  stateDb: StateDbHealth
  workerEnabled: boolean
  lastWorkerTick: string | null
}

export interface DataSyncAccess {
  /** `DataSync.View`. */
  screenAllowed: boolean
  /** `DataSync.Operate` — every action and the Changes view. */
  canOperate: boolean
}

// ── Requests ────────────────────────────────────────────────────────────────────

/** Exactly ONE of the two ([CODE] 400 otherwise). `fleet: 'all'` is the only selector in v1. */
export type Targets = { storeCodes: StoreRef[]; fleet?: never } | { fleet: 'all'; storeCodes?: never }

export interface CreateCampaignRequest {
  profileId: Ulid
  mode: Mode
  targets: Targets
  /** A subset of the profile's tables; omitted = the whole profile. */
  tables?: string[] | null
  name?: string | null
  /** Apply: trimmed, ≥ 10 characters. Ignored for ReportOnly. */
  reason?: string | null
}

/** The optional note on a control; blank is sent as nothing. */
export interface ControlRequest {
  reason?: string | null
}

// ── Query parameters ────────────────────────────────────────────────────────────

/** The doors' page size bounds ([CODE] clamped, not refused). The screen asks for 50. */
export const DATA_SYNC_PAGE_SIZE = 50

export interface CampaignsQuery {
  status?: CampaignStatus | null
  page: number
  pageSize: number
}

export interface JobsQuery {
  status?: JobStatus | null
  page: number
  pageSize: number
}

export interface ChangesQuery {
  table?: string | null
  kind?: ChangeKind | null
  page: number
  pageSize: number
}
