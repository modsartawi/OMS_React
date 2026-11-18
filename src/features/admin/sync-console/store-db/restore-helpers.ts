/**
 * The Restore panel and the side copies as the page reads them (oms 919; BackOffice spec 4016 D16, door 4038). Pure —
 * pinned by `restore-helpers.test.ts`. The live database is never replaced from here: a restore only ever creates a
 * new `POS_Restore_yyyymmdd` side copy, and only such a copy may be dropped.
 */
import type { StoreDbBackupFile } from '@/core/models/store-database'
import type { Permissions } from '@/core/permissions'
import { canRestoreStoreDb } from '../access'

/** Restore to a side copy and Drop need the Restore key, beside View. Browse is a View read. */
export const restoreVisible = (p: Permissions): boolean => canRestoreStoreDb(p)

/** Why a backup cannot be restored here (`storeDb.restore.why.<why>`). */
export type RestoreRefusal = 'newerEngine' | 'unreadable' | 'unknownEngine'

export type RestoreChoice = { ok: true } | { ok: false; why: RestoreRefusal }

/** `major.minor` of an engine version (`10.50.6000.34` → `[10, 50]`); `null` when it does not read as one. */
function engineOf(version: string | null | undefined): [number, number] | null {
  const m = /^\s*(\d+)\.(\d+)/.exec(version ?? '')
  return m ? [Number(m[1]), Number(m[2])] : null
}

/**
 * Whether a backup Browse found can be restored into a side copy (BO 4038 refuses a newer-engine backup "with that
 * reason"). The server's `newerEngine` flag wins; without one, the backup's engine is compared to the store's by
 * `major.minor` — a later build of the same engine (a service pack) is not newer, 2008 R2 (10.50) onto 2008 (10.0)
 * is. A file the engine could not read, or one that cannot be judged, cannot be chosen.
 */
export function restoreChoice(file: StoreDbBackupFile, storeEngineVersion: string | null): RestoreChoice {
  if (file.error) return { ok: false, why: 'unreadable' }
  if (file.newerEngine === true) return { ok: false, why: 'newerEngine' }
  if (file.newerEngine === false) return { ok: true }
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
 * 🚩 GUESSED day: the day asked for; a job left for tonight's window may run (and be named) after midnight — the
 * server's own `nextSideCopyName` is shown instead when it sends one.
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
