/**
 * The Store database doors' shapes (BackOffice spec 4016, doors 4030–4039; oms 915–919).
 *
 * Reconciled to the real doors on BackOffice `pricing2` (merge fa2759e8f): every name below is the camelCase of a
 * server DTO (`Sartawi.Retail.Data/Modules/StoreDatabase/*.cs`, ASP.NET Core web JSON defaults). Sizes are KB (`…Kb`,
 * spec D6); a drive's free space of `-1` means the drive was not matched (draw it as unknown). DB-sourced times are local
 * wall-clock `yyyy-MM-ddTHH:mm:ss[.fffffff]` with no zone (spec D4); the on-demand looks (Live, Health, Blitz, Check
 * now) stamp `DateTime.Now`, which carries the server's offset (`…+03:00`).
 *
 * One section per ticket, so the tickets that run side by side append inside their own block.
 */

// ── Shared ──────────────────────────────────────────────────────────────────────

/** A store database's state as the server judged it (thresholds are server config — never re-judged here). */
export type StoreDbState = 'Ok' | 'Watch' | 'Critical' | 'DiskLow' | 'NotChecked'

export const STORE_DB_STATES: readonly StoreDbState[] = ['Ok', 'Watch', 'Critical', 'DiskLow', 'NotChecked']

/** The job kinds of the write rail (spec D12, `StoreDatabaseJobKind`). */
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

/**
 * The engine labels the server names a store's SQL Server by (`StoreDatabaseSizeCap.EngineLabel`): a release name, or
 * `SQL Server <version>` for one it has no name for, `""` with no version, `null` when the store was never read.
 */
export const STORE_DB_ENGINES = [
  'SQL Server 2005',
  'SQL Server 2008',
  'SQL Server 2008 R2',
  'SQL Server 2012',
  'SQL Server 2014',
  'SQL Server 2016',
  'SQL Server 2017',
  'SQL Server 2019',
  'SQL Server 2022',
] as const

/** `"x64"` or `"x86"`. */
export type StoreDbBitness = 'x64' | 'x86'

/** One row of `GET StoreDatabase/Fleet` (`StoreDatabaseFleetRow`, BO 4030/4031). */
export interface StoreDbFleetRow {
  code: string
  name: string
  /** A label of `STORE_DB_ENGINES`, or one this bundle does not know; `null` when never read. */
  engine: string | null
  productVersion: string | null
  edition: string | null
  /** `"x64"` / `"x86"`; `null` when never read. */
  bitness: string | null
  usedKb: number | null
  /** The size cap; `0` = none, `null` = never read. */
  capKb: number | null
  /** Used of cap, `0..100` to one decimal; `null` with no cap or no reading. */
  usedPercent: number | null
  /** `-1` = the drive was not matched. */
  driveFreeKb: number | null
  state: string
  /** Days until the cap at the recent growth rate; `null` = no forecast (BO 4031). */
  daysToCap: number | null
  growthKbPerDay: number | null
  /** The latest reading of ANY kind. */
  takenAt: string | null
  succeeded: boolean | null
  /** Why the latest reading failed; `""` when it succeeded. */
  error: string | null
}

// ── 916 Store ───────────────────────────────────────────────────────────────────

/** A reading as the store page shows it (`StoreDatabaseReadingView`, spec D5). */
export interface StoreDbReading {
  /** `GET StoreDatabase/Reading?code=&id=` reads it again (story 14). */
  id: string
  takenAt: string
  /** The engine label (`SQL Server 2008 R2`, …). */
  engine: string | null
  productVersion: string | null
  productLevel: string | null
  edition: string | null
  /** `"x64"` / `"x86"`. */
  bitness: string | null
  /** The size cap; `0` = none. */
  capKb: number
  /** Data used / allocated. */
  usedKb: number | null
  allocatedKb: number | null
  /** Allocated less used: what a data shrink could give back. */
  freeInsideFileKb?: number | null
  /** Free on the data drive; `-1` = the drive was not matched. */
  driveFreeKb: number | null
  logAllocatedKb: number | null
  logUsedKb: number | null
  recoveryModel: string | null
  cpuCount?: number | null
  physicalMemoryKb?: number | null
  /** When SQL Server last started (uptime = the reading's time − this); `null` = absent. */
  sqlStartedAt: string | null
  /** The longest open transaction's age at reading time, in seconds; `0` = none open. */
  longestOpenTransactionSeconds?: number | null
  blockedSessions?: number | null
  /** The last full backup; `null` = never backed up. */
  lastFullBackupAt: string | null
  isAutoShrinkOn?: boolean
  isAutoCloseOn?: boolean
  pageVerify?: string | null
  compatibilityLevel?: number | null
  collation?: string | null
}

/** One of the reading's largest tables (`StoreDatabaseReadingTable`, the 10 largest). */
export interface StoreDbTable {
  id?: string
  readingId?: string
  position?: number
  tableName: string
  tableRows: number | null
  reservedKb: number | null
  dataKb: number | null
  indexKb: number | null
}

/** One of the reading's data and log files (`StoreDatabaseReadingFile`, spec D5 per file). */
export interface StoreDbReadingFile {
  id?: string
  readingId?: string
  logicalName: string
  /** `Data` or `Log`. */
  fileType: string
  physicalPath: string
  /** The drive the file sits on (`D:`). */
  drive: string
  allocatedKb: number
  usedKb: number
}

/** One fixed drive of the reading's machine (`StoreDatabaseReadingDrive`). */
export interface StoreDbReadingDrive {
  id?: string
  readingId?: string
  drive: string
  freeKb: number
}

/** One day of the store's kept history (`StoreDatabaseHistoryPoint`): the day's last successful reading. */
export interface StoreDbHistoryDay {
  /** A local day as a `DateTime` (`2026-11-18T00:00:00`). */
  day: string
  readingId?: string
  takenAt?: string
  usedKb: number | null
  allocatedKb: number | null
  logAllocatedKb: number | null
  logUsedKb: number | null
  /** `-1` = the drive was not matched. */
  driveFreeKb: number | null
}

/** A side copy restored beside the live database (`POS_Restore_yyyymmdd[_n]`, `StoreDatabaseSideCopyView`, BO 4038). */
export interface StoreDbSideCopy {
  name: string
  sizeKb: number | null
  createdAt: string | null
}

/** `GET StoreDatabase/Store?code=` (`StoreDatabaseStorePage`, BO 4031; side copies BO 4038). */
export interface StoreDbStore {
  code: string
  name: string
  state: string
  /** Used of cap, `0..100`. */
  usedPercent?: number | null
  /** Days until the cap at the recent growth rate; `null` = no forecast. */
  daysToCap: number | null
  /** The growth rate behind `daysToCap`, KB a day (negative = shrinking). */
  growthKbPerDay: number | null
  /** The reading the growth is measured from (to the latest reading's `takenAt`). */
  growthFrom: string | null
  /** The latest reading of ANY kind: when, whether it succeeded, why not (`""` when it did). */
  lastTakenAt: string | null
  lastSucceeded: boolean | null
  lastError: string | null
  /** The latest SUCCESSFUL reading; `null` when the store has never been read. */
  reading: StoreDbReading | null
  largestTables: StoreDbTable[]
  files: StoreDbReadingFile[]
  drives: StoreDbReadingDrive[]
  history: StoreDbHistoryDay[]
  sideCopies: StoreDbSideCopy[]
}

// ── 917 Live + Health ───────────────────────────────────────────────────────────

/** `POST StoreDatabase/CheckNow` (`StoreDatabaseCheckNowRequest`, BO 4032) — Act, audited. */
export interface StoreDbCheckNowBody {
  code: string
  reason: string
}

/**
 * What Check now took (`StoreDatabaseCheckNowAnswer`): a reading RESULT, not a store page. A failed read is not a
 * refusal — it is stored and answered `succeeded: false` with its error.
 */
export interface StoreDbCheckNowAnswer {
  code: string
  takenAt: string
  succeeded: boolean
  /** `""` when it succeeded. */
  error: string | null
  /** `null` when it failed. */
  reading: StoreDbReading | null
  largestTables: StoreDbTable[]
  auditId: string | null
}

/** A request running on the store as the look found it (`StoreDatabaseRunningRequest`, spec D11). */
export interface StoreDbRunningRequest {
  sessionId: number
  /** The session blocking this one; `0` = none. */
  blockedBy: number
  seconds: number
  status: string
  command: string
  waitType: string | null
  waitSeconds: number | null
  waitResource: string | null
  hostName: string | null
  programName: string | null
  loginName: string | null
  openTransactions: number
  cpuTime: number | null
  logicalReads: number | null
  statementText: string | null
  batchText: string | null
}

/** A session blocking others while not blocked itself (`StoreDatabaseHeadBlocker`). */
export interface StoreDbHeadBlocker {
  sessionId: number
  status: string
  hostName: string | null
  programName: string | null
  loginName: string | null
  lastRequestStartTime: string | null
  lastRequestEndTime: string | null
  idleSeconds: number | null
  blocksCount: number
  openTransactions: number
  lastSql: string | null
}

/** One of the sync worker's own sessions on the store (`StoreDatabaseWorkerSession`). */
export interface StoreDbWorkerSession {
  sessionId: number
  status: string
  loginTime: string | null
  lastRequestStartTime: string | null
  command: string | null
  waitType: string | null
  blockedBy: number | null
  runningSeconds: number | null
  openTransactions: number
  sqlText: string | null
}

/** A transaction open longer than 30 s (`StoreDatabaseLongTransaction`). */
export interface StoreDbLongTransaction {
  sessionId: number
  hostName: string | null
  programName: string | null
  status: string
  transactionBeginTime: string | null
  transactionSeconds: number
  lastSql: string | null
}

/** `GET StoreDatabase/LiveActivity?code=` (`StoreDatabaseLiveActivity`, BO 4032): four result sets of one look. */
export interface StoreDbLiveActivity {
  code?: string
  /** When the look was taken (server's local clock, with its offset); `null` if absent. */
  takenAt: string | null
  /** The machine the look was taken from. */
  workerHost?: string | null
  running: StoreDbRunningRequest[]
  headBlockers: StoreDbHeadBlocker[]
  workerSessions: StoreDbWorkerSession[]
  longTransactions: StoreDbLongTransaction[]
}

/** A finding's level (`StoreDatabaseFinding.Level`); a check that failed to run is `CheckFailed`. */
export type StoreDbHealthLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info' | 'CheckFailed'

/** One finding of the health check (`StoreDatabaseFinding`): a check that faults is a finding too (BO 4032). */
export interface StoreDbHealthFinding {
  /** `1` Critical … `5` Info; a faulted check is `3`. */
  priority: number
  /** `Critical`, `High`, `Medium`, `Low`, `Info`, or `CheckFailed`. */
  level: string
  /** The check's stable name (`AutoShrinkOn`, `NoFullBackup`, …); the server's word when it has no label here. */
  check: string
  /** Server text: what was found (for a faulted check, why it could not run). */
  detail: string
  /** Server text: the plain-language fix; `""` / `null` = none. */
  fix: string | null
}

/** `GET StoreDatabase/HealthCheck?code=` (`StoreDatabaseHealthReport`, BO 4032). */
export interface StoreDbHealthCheck {
  code?: string
  takenAt: string | null
  /** How many checks ran (a faulted one included). */
  checksRun?: number | null
  findings: StoreDbHealthFinding[]
}

// ── 918 Jobs + Space + Backup ───────────────────────────────────────────────────

/** A job's state (`StoreDatabaseJobState`, BO 4034). */
export type StoreDbJobState = 'Waiting' | 'Running' | 'Retrying' | 'Done' | 'Failed'

/** One row of `GET StoreDatabase/Jobs?code=` (`StoreDatabaseJobView`, BO 4034), newest first, at most 200. */
export interface StoreDbJob {
  /** A ULID. */
  jobId: string
  code: string
  /** A string: a door newer than this bundle may send a kind it does not know. */
  kind: string
  /** What the kind acts on (a restore's `.bak`, a dropped side copy); `""` for the others. */
  target?: string | null
  reason: string
  requestedBy: string
  requestedAt: string
  /** The night window's start, or the request time on Run now. */
  notBefore: string
  /** `StoreDbJobState`; a string, as a newer door may send a word this bundle does not know. */
  state: string
  runNow?: boolean
  /** `AttemptsCount` — at most 3. */
  attempts: number
  /** When its latest attempt started; `null` = never. */
  startedAt: string | null
  /** `ProcessedTime`. */
  finishedAt: string | null
  /** The result text (before/after sizes, the file, the counts). */
  result: string | null
  /** `ErrorMessage`: why the runner refused or failed it. */
  error: string | null
}

/** `POST StoreDatabase/Jobs` / `RestoreJobs` (`StoreDatabaseJobRequest`). `runNow: false` = the night window. */
export interface StoreDbJobRequest {
  code: string
  kind: StoreDbJobKind
  reason: string
  runNow: boolean
  /** What the kind acts on: the `.bak`'s full path (RestoreSideCopy), the side copy's name (DropSideCopy). */
  target?: string
}

/** What the job doors queued (`StoreDatabaseJobQueued`). `warning` is `""` for most kinds (4036: a data shrink). */
export interface StoreDbJobAccepted {
  jobId: string
  code: string
  kind: string
  notBefore: string
  runNow: boolean
  auditId: string
  warning: string | null
}

/** A backup schedule's frequency (spec D15: off / daily / weekly with a weekday). */
export type StoreDbBackupFrequency = 'Off' | 'Daily' | 'Weekly'

export interface StoreDbScheduleSetting {
  frequency: string
  /** The day's NAME (`Friday`, .NET `DayOfWeek`); `null` unless weekly. */
  weekday: string | null
}

/** `GET StoreDatabase/BackupSchedule?code=` (`StoreDatabaseBackupScheduleView`): the store's EFFECTIVE schedule. */
export interface StoreDbBackupSchedule extends StoreDbScheduleSetting {
  /** The store, or `*` for the fleet default. */
  code: string
  /** `Store` (its own row), `Fleet` (follows the fleet default's row) or `Default` (nothing set anywhere: Off). */
  source: string
  /** The backup folder on the store machine; `""` = the SQL instance's default. */
  folder: string | null
  /** The fleet default, flat. */
  fleetFrequency: string
  fleetWeekday: string | null
  updatedBy: string | null
  updatedAt: string | null
  /** The PUT's audit row; `null` on a GET. */
  auditId: string | null
}

/** `PUT StoreDatabase/BackupSchedule` (`StoreDatabaseBackupScheduleRequest`); `fleet: true` sets the fleet default. */
export interface StoreDbScheduleRequest {
  code: string | null
  fleet: boolean
  /** `Off` / `Daily` / `Weekly`; for a store also `Fleet` (drop its own row and follow the fleet default). */
  frequency: string
  weekday: string | null
  reason: string
}

// ── 919 Restore + Blitz ─────────────────────────────────────────────────────────

/** One file inside a backup (`StoreDatabaseBackupFileItem`, `RESTORE FILELISTONLY`). */
export interface StoreDbBackupFileItem {
  logicalName: string
  physicalName: string
  /** `D` data, `L` log, `F` full-text, `S` filestream. */
  type: string
  fileId: number
  sizeKb: number
}

/** One `.bak` file Browse found, read with `RESTORE HEADERONLY` (`StoreDatabaseBackupFile`, BO 4038). */
export interface StoreDbBackupFile {
  /** The full path on the store's SQL machine — what a restore is asked for (its `target`). */
  file: string
  /** The engine could not read the file: it is listed with this error; `""` when readable. */
  error: string | null
  position?: number
  /** The database the backup was taken of. */
  databaseName: string | null
  /** `1` full, `2` log, `5` differential — only a full backup restores (`NOT_A_FULL_BACKUP`). */
  backupType?: number | null
  backupStartedAt: string | null
  backupFinishedAt: string | null
  backupSizeKb: number | null
  /** The engine that took it (`major.minor.build`). */
  engineVersion: string | null
  engineMajor?: number
  engineMinor?: number
  engineBuild?: number
  /** The server judged it newer than the store's engine (a restore is refused `NEWER_ENGINE`). */
  newerThanStore?: boolean | null
  files?: StoreDbBackupFileItem[]
  /** The space a restore allocates (the files' sizes). */
  restoreSizeKb?: number | null
  readable?: boolean
}

/** `GET StoreDatabase/Backups?code=&folder=` (`StoreDatabaseBackupFolder`, BO 4038) — View. */
export interface StoreDbBackups {
  code?: string
  /** The folder actually read (the backup folder when none was typed). */
  folder: string
  /** The store engine's version, to judge "newer" by when a file carries no verdict. */
  storeEngineVersion: string | null
  files: StoreDbBackupFile[]
  /** More `.bak` files than the browse limit: only the first are listed. */
  truncated: boolean
}

/**
 * sp_Blitz's install state on one store. BO 4039 is still open: NO read carries it (the Store door does not), so the
 * client has none and reads it as unknown. Kept for the day 4039's close-out adds a state read.
 */
export interface StoreDbBlitzState {
  installed: boolean
  version: string | null
}

/** One row of sp_Blitz's own output (`StoreDatabaseBlitzFinding`, BO 4039). */
export interface StoreDbBlitzFinding {
  /** sp_Blitz's priority: `1` = most urgent; 200+ informational. */
  priority: number
  findingsGroup: string | null
  finding: string
  databaseName: string | null
  details: string | null
  url: string | null
  checkId?: number
}

/** `GET StoreDatabase/Blitz?code=` (`StoreDatabaseBlitzReport`, BO 4039) — View; refused `BLITZ_NOT_INSTALLED` when absent. */
export interface StoreDbBlitz {
  code?: string
  takenAt?: string | null
  /** HQ's record of the installed build; `""` = no HQ record. */
  installedVersion?: string | null
  installedAt?: string | null
  findings: StoreDbBlitzFinding[]
}
