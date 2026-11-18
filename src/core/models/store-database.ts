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

// ── 918 Jobs + Space + Backup ───────────────────────────────────────────────────

// ── 919 Restore + Blitz ─────────────────────────────────────────────────────────
