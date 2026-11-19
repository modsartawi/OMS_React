/**
 * The backup schedule as the Backup panel edits it (oms 918; BackOffice 4035, spec D15): off, daily, or weekly on a
 * weekday — for one store (which may instead follow the fleet default), or the fleet default (both with Act, spec D9).
 * The wire is `StoreDatabaseBackupSchedules` (pricing2 fa2759e8f): the weekday is a .NET `DayOfWeek` NAME, the fleet
 * default is set with `fleet: true` and read flat as `fleetFrequency` / `fleetWeekday`. Pure — pinned by
 * `schedule-helpers.test.ts`.
 */
import type { TFunction } from 'i18next'
import type { StoreDbBackupFrequency, StoreDbBackupSchedule, StoreDbScheduleRequest, StoreDbScheduleSetting } from '@/core/models/store-database'

export const BACKUP_FREQUENCIES: readonly StoreDbBackupFrequency[] = ['Off', 'Daily', 'Weekly']

/** A store's form also offers Fleet: drop its own schedule and follow the fleet default (the PUT's `Fleet`). */
export const STORE_FREQUENCIES: readonly ScheduleFrequency[] = ['Fleet', ...BACKUP_FREQUENCIES]

export type ScheduleFrequency = StoreDbBackupFrequency | 'Fleet'

/** The days as the server names them (`DayOfWeek`); digits are refused (`BAD_SCHEDULE`). */
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** The weekday the form offers when a schedule is turned Weekly without one. */
export const DEFAULT_WEEKDAY = 'Friday'

export interface ScheduleDraft {
  frequency: ScheduleFrequency
  weekday: string | null
}

const isFrequency = (f: string): f is StoreDbBackupFrequency => (BACKUP_FREQUENCIES as readonly string[]).includes(f)

/** A schedule as the form holds it: an unknown frequency reads Off; a weekday only beside Weekly. */
export function scheduleDraft(setting: StoreDbScheduleSetting): ScheduleDraft {
  const frequency = isFrequency(setting.frequency) ? setting.frequency : 'Off'
  return { frequency, weekday: frequency === 'Weekly' ? setting.weekday : null }
}

/** A store's form: its own schedule (`source: Store`), else Fleet — it follows the fleet default (`Fleet` / `Default`). */
export const storeScheduleDraft = (view: StoreDbBackupSchedule): ScheduleDraft =>
  view.source === 'Store' ? scheduleDraft(view) : { frequency: 'Fleet', weekday: null }

/** The fleet default, from the GET's flat fields. */
export const fleetSetting = (view: StoreDbBackupSchedule): StoreDbScheduleSetting => ({
  frequency: view.fleetFrequency ?? 'Off',
  weekday: view.fleetWeekday ?? null,
})

/** Weekly needs a day name; off, daily and follow-the-fleet are always ready. */
export const scheduleReady = (d: ScheduleDraft): boolean =>
  d.frequency !== 'Weekly' || (d.weekday != null && (WEEKDAYS as readonly string[]).includes(d.weekday))

/** The `PUT StoreDatabase/BackupSchedule` body; `code: null` is the fleet default (`fleet: true`). */
export function scheduleRequest(code: string | null, d: ScheduleDraft, reason: string): StoreDbScheduleRequest {
  return { code, fleet: code === null, frequency: d.frequency, weekday: d.frequency === 'Weekly' ? d.weekday : null, reason }
}

/** Whether the form differs from what the door sent (Save waits for a change). */
export function scheduleChanged(d: ScheduleDraft, current: ScheduleDraft): boolean {
  return d.frequency !== current.frequency || (d.frequency === 'Weekly' && d.weekday !== current.weekday)
}

/** A schedule in words: "Off", "Daily", "Weekly on Friday". */
export function scheduleWords(t: TFunction, setting: StoreDbScheduleSetting): string {
  const d = scheduleDraft(setting)
  return d.frequency === 'Weekly' && d.weekday != null && (WEEKDAYS as readonly string[]).includes(d.weekday)
    ? t('storeDb.backup.weeklyOn', { weekday: t(`storeDb.backup.weekdays.${d.weekday}`) })
    : t(`storeDb.backup.frequencies.${d.frequency}`)
}
