import { describe, expect, it } from 'vitest'
import type { StoreDbBackupSchedule } from '@/core/models/store-database'
import scheduleFixture from './__fixtures__/backup-schedule.json'
import { fleetSetting, scheduleChanged, scheduleDraft, scheduleReady, scheduleRequest, storeScheduleDraft } from './schedule-helpers'

/**
 * Oms 918 (BackOffice 4035, `StoreDatabaseBackupSchedules`, pricing2 fa2759e8f): a backup schedule is off, daily, or
 * weekly on a named day — for a store (which may instead follow the fleet default) or the fleet default.
 */
describe('a backup schedule', () => {
  const schedule = scheduleFixture as StoreDbBackupSchedule

  it('reads the store’s own schedule into the form, and the fleet default from its flat fields', () => {
    expect(storeScheduleDraft(schedule)).toEqual({ frequency: 'Weekly', weekday: 'Friday' })
    expect(fleetSetting(schedule)).toEqual({ frequency: 'Off', weekday: null })
    expect(scheduleDraft(fleetSetting({ ...schedule, fleetFrequency: 'Weekly', fleetWeekday: 'Thursday' }))).toEqual({ frequency: 'Weekly', weekday: 'Thursday' })
  })

  it('a store with no schedule of its own reads as following the fleet default (source Fleet or Default)', () => {
    expect(storeScheduleDraft({ ...schedule, source: 'Fleet', frequency: 'Daily', weekday: null })).toEqual({ frequency: 'Fleet', weekday: null })
    expect(storeScheduleDraft({ ...schedule, source: 'Default', frequency: 'Off', weekday: null })).toEqual({ frequency: 'Fleet', weekday: null })
  })

  it('a frequency this bundle does not know reads as Off, and a weekday only beside Weekly', () => {
    expect(scheduleDraft({ frequency: 'Monthly', weekday: 'Tuesday' })).toEqual({ frequency: 'Off', weekday: null })
    expect(scheduleDraft({ frequency: 'Daily', weekday: 'Tuesday' })).toEqual({ frequency: 'Daily', weekday: null })
  })

  it('weekly needs a day name before it can be saved', () => {
    expect(scheduleReady({ frequency: 'Weekly', weekday: null })).toBe(false)
    expect(scheduleReady({ frequency: 'Weekly', weekday: '5' })).toBe(false)
    expect(scheduleReady({ frequency: 'Weekly', weekday: 'Sunday' })).toBe(true)
    expect(scheduleReady({ frequency: 'Off', weekday: null })).toBe(true)
    expect(scheduleReady({ frequency: 'Fleet', weekday: null })).toBe(true)
  })

  it('sends a store’s schedule by code, the weekday as its day name only for weekly', () => {
    expect(scheduleRequest('P104', { frequency: 'Daily', weekday: 'Monday' }, 'Busy store')).toEqual({ code: 'P104', fleet: false, frequency: 'Daily', weekday: null, reason: 'Busy store' })
    expect(scheduleRequest('P104', { frequency: 'Fleet', weekday: null }, 'Back to the fleet')).toEqual({ code: 'P104', fleet: false, frequency: 'Fleet', weekday: null, reason: 'Back to the fleet' })
  })

  it('sends the fleet default with fleet: true', () => {
    expect(scheduleRequest(null, { frequency: 'Weekly', weekday: 'Thursday' }, 'Fleet on Thursdays')).toEqual({ code: null, fleet: true, frequency: 'Weekly', weekday: 'Thursday', reason: 'Fleet on Thursdays' })
  })

  it('Save waits for a change', () => {
    const current = storeScheduleDraft(schedule)
    expect(scheduleChanged({ frequency: 'Weekly', weekday: 'Friday' }, current)).toBe(false)
    expect(scheduleChanged({ frequency: 'Weekly', weekday: 'Monday' }, current)).toBe(true)
    expect(scheduleChanged({ frequency: 'Fleet', weekday: null }, current)).toBe(true)
  })
})
