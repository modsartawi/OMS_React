/**
 * The Store database doors' shapes (BackOffice spec 4016, doors 4030–4039; oms 915–919).
 *
 * 🚩 GUESSED. No BackOffice brief exists for 4016 yet: every path is spelled by a BO ticket, but every field name and
 * type below is a guess from the ticket's words, built stubbed. Reconcile when BO writes
 * `assets/4016-oms-react-store-database-brief.md`. Sizes are KB (HQ keeps them as BIGINT, spec D6); times are local
 * wall-clock `yyyy-MM-ddTHH:mm:ss`, no `Z` (spec D4).
 *
 * One section per ticket, so the tickets that run side by side append inside their own block.
 */

// ── Shared ──────────────────────────────────────────────────────────────────────

/** A store database's state as the server judged it (thresholds are server config — never re-judged here). */
export type StoreDbState = 'Ok' | 'Watch' | 'Critical' | 'DiskLow' | 'NotChecked'

export const STORE_DB_STATES: readonly StoreDbState[] = ['Ok', 'Watch', 'Critical', 'DiskLow', 'NotChecked']

/** The job kinds of the write rail (spec D12, exact). */
export type StoreDbJobKind =
  | 'ShrinkLog'
  | 'ShrinkData'
  | 'Backup'
  | 'RestoreSideCopy'
  | 'DropSideCopy'
  | 'Cleanup'
  | 'InstallBlitz'
  | 'RemoveBlitz'

// ── 915 Fleet ───────────────────────────────────────────────────────────────────

/** The engine label the Fleet door sends (oms 915 lists exactly these four). GUESSED spelling. */
export type StoreDbEngine = '2008' | '2008 R2' | '2019' | 'other'

export const STORE_DB_ENGINES: readonly StoreDbEngine[] = ['2008', '2008 R2', '2019', 'other']

/** One row of `GET StoreDatabase/Fleet` (BO 4030; `daysToCap` and the sort BO 4031). */
export interface StoreDbFleetRow {
  code: string
  name: string
  /** A string: a door newer than this bundle may send a label it does not know. */
  engine: string
  productVersion: string | null
  edition: string | null
  is64Bit: boolean | null
  usedKb: number | null
  /** The size cap; `0` = none. */
  capKb: number
  /** Used of cap, `0..1`; `null` when there is no cap or no reading. */
  usedShare: number | null
  driveFreeKb: number | null
  state: string
  /** Days until the cap at the recent growth rate; `null` = no forecast (BO 4031). */
  daysToCap: number | null
  takenAt: string | null
}

// ── 916 Store ───────────────────────────────────────────────────────────────────

/** The latest full reading of one store database (BO 4031 / spec D5). GUESSED names. */
export interface StoreDbReading {
  takenAt: string
  /** The engine label, as on the fleet (`2008`, `2008 R2`, `2019`, `other`). */
  engine: string
  productVersion: string | null
  productLevel: string | null
  edition: string | null
  is64Bit: boolean | null
  /** The size cap; `0` = none. */
  capKb: number
  dataAllocatedKb: number | null
  dataUsedKb: number | null
  logAllocatedKb: number | null
  logUsedKb: number | null
  recoveryModel: string | null
  driveFreeKb: number | null
  /** The drive the data file sits on (`D:`), when sent. */
  dataDrive: string | null
  machineName: string | null
  /** When SQL Server last started (uptime = the reading's time − this). */
  sqlStartedAt: string | null
  lastFullBackupAt: string | null
  lastFullBackupSizeKb: number | null
}

/** The latest attempt to read the store, failed or not: a failed one keeps its error (BO 4031). */
export interface StoreDbAttempt {
  takenAt: string
  succeeded: boolean
  error: string | null
}

/** One of the store's largest tables (BO 4031: the 10 largest). */
export interface StoreDbTable {
  tableName: string
  rows: number | null
  reservedKb: number | null
  dataKb: number | null
  indexKb: number | null
}

/** One day of the store's kept history (BO 4031). A size the day did not read is `null`. */
export interface StoreDbHistoryDay {
  /** `yyyy-MM-dd` (a local day). */
  day: string
  usedKb: number | null
  allocatedKb: number | null
  logKb: number | null
  driveFreeKb: number | null
}

/** A side copy restored beside the live database (`POS_Restore_yyyymmdd[_n]`, BO 4038). */
export interface StoreDbSideCopy {
  name: string
  sizeKb: number | null
  createdAt: string | null
}

/** `GET StoreDatabase/Store?code=` (BO 4031; side copies BO 4038). */
export interface StoreDbStore {
  code: string
  name: string
  state: string
  /** Days until the cap at the recent growth rate; `null` = no forecast. */
  daysToCap: number | null
  /** The growth rate behind `daysToCap`, KB a day. */
  growthKbPerDay: number | null
  /** The window the rate is taken over (BO 4031: 14 days, configurable). */
  growthWindowDays: number | null
  /** The latest SUCCESSFUL reading; `null` when the store has never been read. */
  reading: StoreDbReading | null
  lastAttempt: StoreDbAttempt | null
  largestTables: StoreDbTable[]
  history: StoreDbHistoryDay[]
  /** `[]` until BO 4038 sends them. */
  sideCopies: StoreDbSideCopy[]
}

// ── 917 Live + Health ───────────────────────────────────────────────────────────

/** `POST StoreDatabase/CheckNow` (BO 4032) — Act, audited. GUESSED body; answered with the store's fresh `StoreDbStore`. */
export interface StoreDbCheckNowBody {
  code: string
  reason: string
}

/** A request running on the store as the look found it (`sys.dm_exec_requests`, BO 4032 / spec D11). GUESSED names. */
export interface StoreDbRunningRequest {
  sessionId: number
  /** The session blocking this one; `0` = none. */
  blockedBy: number
  secs: number
  status: string
  command: string
  waitType: string | null
  waitSecs: number | null
  waitResource: string | null
  hostName: string | null
  programName: string | null
  loginName: string | null
  openTran: number
  cpuTime: number | null
  logicalReads: number | null
  statementText: string | null
  batchText: string | null
}

/** A session blocking others while not blocked itself. GUESSED names. */
export interface StoreDbHeadBlocker {
  sessionId: number
  status: string
  hostName: string | null
  programName: string | null
  loginName: string | null
  lastRequestStartTime: string | null
  lastRequestEndTime: string | null
  idleSecs: number | null
  blocksCount: number
  openTran: number
  lastSql: string | null
}

/** One of the sync worker's own sessions on the store. GUESSED names. */
export interface StoreDbWorkerSession {
  sessionId: number
  status: string
  loginTime: string | null
  lastRequestStartTime: string | null
  command: string | null
  waitType: string | null
  blockedBy: number | null
  runningSecs: number | null
  openTran: number
  sqlText: string | null
}

/** A transaction open longer than 30 s. GUESSED names. */
export interface StoreDbLongTransaction {
  sessionId: number
  hostName: string | null
  programName: string | null
  status: string
  transactionBeginTime: string | null
  tranSecs: number
  lastSql: string | null
}

/** `GET StoreDatabase/LiveActivity?code=` (BO 4032): four result sets of one look at the store. GUESSED shape. */
export interface StoreDbLiveActivity {
  /** When the look was taken (server's local clock); `null` if the door leaves it out. */
  takenAt: string | null
  running: StoreDbRunningRequest[]
  headBlockers: StoreDbHeadBlocker[]
  workerSessions: StoreDbWorkerSession[]
  longTransactions: StoreDbLongTransaction[]
}

/** One finding of the health check: a check that faults is reported as a finding too (BO 4032). GUESSED names. */
export interface StoreDbHealthFinding {
  /** `1` = most urgent. */
  priority: number
  /** The check's machine name (`AutoShrinkOn`, `NoRecentBackup`, …); the server's word when it has no label here. */
  check: string
  /** Server text: what was found. */
  detail: string
  /** Server text: the plain-language fix, when there is one. */
  fix: string | null
  /** The check itself failed to run; `detail` says why. */
  faulted: boolean
}

/** `GET StoreDatabase/HealthCheck?code=` (BO 4032). GUESSED shape. */
export interface StoreDbHealthCheck {
  takenAt: string | null
  findings: StoreDbHealthFinding[]
}

// ── 918 Jobs + Space + Backup ───────────────────────────────────────────────────

/** A job's state as the door derives it from `IsProcessed` / `HasError` (BO 4034). GUESSED words. */
export type StoreDbJobState = 'Queued' | 'Running' | 'Done' | 'Failed' | 'Deferred'

/** One row of `GET StoreDatabase/Jobs?code=` (BO 4034), newest first. GUESSED names. */
export interface StoreDbJob {
  /** A ULID. */
  jobId: string
  code: string
  /** A string: a door newer than this bundle may send a kind it does not know. */
  kind: string
  reason: string
  requestedBy: string
  requestedAt: string
  /** The night window's start, or the request time on Run now. */
  notBefore: string
  state: string
  /** `AttemptsCount` — at most 3. */
  attempts: number
  /** ⚠ BO 4034 has no start column: likely `LastAttemptTime`. */
  startedAt: string | null
  /** `ProcessedTime`. */
  finishedAt: string | null
  /** The result text (before/after sizes, the file, the counts). */
  result: string | null
  /** `ErrorMessage`: why the runner refused or failed it. */
  error: string | null
}

/** `POST StoreDatabase/Jobs` (BO 4034): `{ code, kind, reason, runNow }`, plus the field a kind needs (GUESSED). */
export interface StoreDbJobRequest {
  code: string
  kind: StoreDbJobKind
  reason: string
  runNow: boolean
  /** `RestoreSideCopy`: the `.bak` to restore (full path, from Browse). GUESSED. */
  file?: string
  /** `DropSideCopy`: the side copy's name. GUESSED. */
  database?: string
}

/** The Jobs door's answer to a request. GUESSED — `warning` is 4036's "a data shrink blocks the till". */
export interface StoreDbJobAccepted {
  jobId: string
  notBefore: string
  warning: string | null
}

/** A backup schedule's frequency (spec D15: off / daily / weekly with a weekday). */
export type StoreDbBackupFrequency = 'Off' | 'Daily' | 'Weekly'

export interface StoreDbScheduleSetting {
  frequency: string
  /** `0` = Sunday … `6` = Saturday (.NET `DayOfWeek`, GUESSED); `null` unless weekly. */
  weekday: number | null
}

/** `GET StoreDatabase/BackupSchedule?code=` (BO 4035): the store's EFFECTIVE schedule. GUESSED shape. */
export interface StoreDbBackupSchedule extends StoreDbScheduleSetting {
  code: string | null
  /** Where the effective schedule comes from: the store's own row (`Store`), or the fleet default (`Fleet`). */
  source: string
  fleetDefault: StoreDbScheduleSetting
}

/** `PUT StoreDatabase/BackupSchedule` (BO 4035): `code: null` sets the fleet default. GUESSED body. */
export interface StoreDbScheduleRequest {
  code: string | null
  frequency: StoreDbBackupFrequency
  weekday: number | null
  reason: string
}

// ── 919 Restore + Blitz ─────────────────────────────────────────────────────────
