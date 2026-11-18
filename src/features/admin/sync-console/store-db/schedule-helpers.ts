/**
 * The backup schedule as the Backup panel edits it (oms 918; BackOffice 4035, spec D15): off, daily, or weekly on a
 * weekday — for one store, or the fleet default (both with Act, spec D9). Pure — pinned by `schedule-helpers.test.ts`.
 */
import type { TFunction } from 'i18next'
import type { StoreDbBackupFrequency, StoreDbScheduleRequest, StoreDbScheduleSetting } from '@/core/models/store-database'

export const BACKUP_FREQUENCIES: readonly StoreDbBackupFrequency[] = ['Off', 'Daily', 'Weekly']

/** `0` = Sunday … `6` = Saturday (.NET `DayOfWeek`, GUESSED). */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

/** The weekday the form offers when a schedule is turned Weekly without one: Friday (`5`). */
export const DEFAULT_WEEKDAY = 5

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

/** A schedule in words: "Off", "Daily", "Weekly on Friday". */
export function scheduleWords(t: TFunction, setting: StoreDbScheduleSetting): string {
  const d = scheduleDraft(setting)
  return d.frequency === 'Weekly' && d.weekday != null
    ? t('storeDb.backup.weeklyOn', { weekday: t(`storeDb.backup.weekdays.${d.weekday}`) })
    : t(`storeDb.backup.frequencies.${d.frequency}`)
}
