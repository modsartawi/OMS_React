/**
 * The backup schedule as the Backup panel edits it (oms 918; BackOffice 4035, spec D15): off, daily, or weekly on a
 * weekday — for one store, or (the owner) the fleet default. Pure — pinned by `schedule-helpers.test.ts`.
 */
import type { StoreDbBackupFrequency, StoreDbScheduleRequest, StoreDbScheduleSetting } from '@/core/models/store-database'
import type { Permissions } from '@/core/permissions'
import { canActStoreDb, canRestoreStoreDb } from '../access'

export const BACKUP_FREQUENCIES: readonly StoreDbBackupFrequency[] = ['Off', 'Daily', 'Weekly']

/** `0` = Sunday … `6` = Saturday (.NET `DayOfWeek`, GUESSED). */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

export interface ScheduleDraft {
  frequency: StoreDbBackupFrequency
  weekday: number | null
}

const isFrequency = (f: string): f is StoreDbBackupFrequency => (BACKUP_FREQUENCIES as readonly string[]).includes(f)

/** A schedule as the form holds it: an unknown frequency reads Off; a weekday only beside Weekly. */
export function scheduleDraft(setting: StoreDbScheduleSetting): ScheduleDraft {
  const frequency = isFrequency(setting.frequency) ? setting.frequency : 'Off'
  return { frequency, weekday: frequency === 'Weekly' ? setting.weekday : null }
}

/** Weekly needs a weekday (0–6); off and daily are always ready. */
export const scheduleReady = (d: ScheduleDraft): boolean =>
  d.frequency !== 'Weekly' || (d.weekday != null && (WEEKDAYS as readonly number[]).includes(d.weekday))

/** The `PUT StoreDatabase/BackupSchedule` body; `code: null` is the fleet default. */
export function scheduleRequest(code: string | null, d: ScheduleDraft, reason: string): StoreDbScheduleRequest {
  return { code, frequency: d.frequency, weekday: d.frequency === 'Weekly' ? d.weekday : null, reason }
}

/** Whether the form differs from the schedule the door sent (Save waits for a change). */
export function scheduleChanged(d: ScheduleDraft, current: StoreDbScheduleSetting): boolean {
  const c = scheduleDraft(current)
  return d.frequency !== c.frequency || (d.frequency === 'Weekly' && d.weekday !== c.weekday)
}

/**
 * The fleet default is the owner's (oms 918 "for the owner, the fleet default"). 🚩 GUESSED: BO names no owner
 * grant — the owner is the holder of Restore (spec D9 "for me or a DBA"), so the fleet default is shown to Act AND
 * Restore. The door itself checks Act only (BO 4035); reconcile when BO rules.
 */
export const fleetDefaultVisible = (p: Permissions): boolean => canActStoreDb(p) && canRestoreStoreDb(p)
