/**
 * The Restore panel and the side copies as the page reads them (oms 919; BackOffice spec 4016 D16, door 4038). Pure —
 * pinned by `restore-helpers.test.ts`. The live database is never replaced from here: a restore only ever creates a
 * new `POS_Restore_yyyymmdd` side copy, and only such a copy may be dropped.
 */
import type { StoreDbBackupFile } from '@/core/models/store-database'

/** Why a backup cannot be restored here (`storeDb.restore.why.<why>`). */
export type RestoreRefusal = 'newerEngine' | 'unreadable' | 'unknownEngine' | 'notFull'

/** A backup's file name: the last part of the full path the door sends (`D:\SQLBackup\P104\POS_full.bak` → `POS_full.bak`). */
export const backupFileName = (file: string): string => file.split(/[\\/]/).pop() ?? file

export type RestoreChoice = { ok: true } | { ok: false; why: RestoreRefusal }

/** `major.minor` of an engine version (`10.50.6000.34` → `[10, 50]`); `null` when it does not read as one. */
function engineOf(version: string | null | undefined): [number, number] | null {
  const m = /^\s*(\d+)\.(\d+)/.exec(version ?? '')
  return m ? [Number(m[1]), Number(m[2])] : null
}

/**
 * Whether a backup Browse found can be restored into a side copy (BO 4038 refuses a newer-engine backup "with that
 * reason"). The server's `newerThanStore` verdict wins; without one, the backup's engine is compared to the store's by
 * `major.minor` — a later build of the same engine (a service pack) is not newer, 2008 R2 (10.50) onto 2008 (10.0)
 * is. A file the engine could not read, one that is not a full backup (`backupType` ≠ 1, refused `NOT_A_FULL_BACKUP`),
 * or one that cannot be judged, cannot be chosen.
 */
export function restoreChoice(file: StoreDbBackupFile, storeEngineVersion: string | null): RestoreChoice {
  if (file.error) return { ok: false, why: 'unreadable' }
  if (file.backupType != null && file.backupType !== 1) return { ok: false, why: 'notFull' }
  if (file.newerThanStore === true) return { ok: false, why: 'newerEngine' }
  if (file.newerThanStore === false) return { ok: true }
  const backup = engineOf(file.engineVersion)
  const store = engineOf(storeEngineVersion)
  if (!backup || !store) return { ok: false, why: 'unknownEngine' }
  const newer = backup[0] > store[0] || (backup[0] === store[0] && backup[1] > store[1])
  return newer ? { ok: false, why: 'newerEngine' } : { ok: true }
}

const SIDE_COPY_PREFIX = 'POS_Restore_'

/**
 * The side copy a restore will create (spec D16): `POS_Restore_yyyymmdd`, with `_2`, `_3` … when that name is taken
 * on the store. `day` is a local `yyyy-MM-dd`. Names compare case-insensitively, as the store's CI collation does.
 * The server names the copy when the job runs (`SideCopyJobs`), so a job left for tonight's window that runs after
 * midnight takes the next day's name: this is the name as of the day asked for, shown as a forecast.
 */
export function sideCopyName(day: string, taken: readonly string[]): string {
  const base = `${SIDE_COPY_PREFIX}${day.replace(/-/g, '')}`
  const names = new Set(taken.map((n) => n.toLowerCase()))
  if (!names.has(base.toLowerCase())) return base
  let n = 2
  while (names.has(`${base}_${n}`.toLowerCase())) n++
  return `${base}_${n}`
}

/** Drop is offered only for a side copy (`POS_Restore_` and its day); the door refuses any other name too (BO 4038). */
export const canDropCopy = (name: string): boolean => /^POS_Restore_\d{8}(_\d+)?$/i.test(name)
