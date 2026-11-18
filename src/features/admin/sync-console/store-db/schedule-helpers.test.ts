import { describe, expect, it } from 'vitest'
import type { StoreDbBackupSchedule } from '@/core/models/store-database'
import scheduleFixture from './__fixtures__/backup-schedule.json'
import { scheduleChanged, scheduleDraft, scheduleReady, scheduleRequest } from './schedule-helpers'

/** Oms 918 (BackOffice 4035): a backup schedule is off, daily, or weekly on a weekday — for a store or the fleet. */
describe('a backup schedule', () => {
  const schedule = scheduleFixture as StoreDbBackupSchedule

  it('reads the store’s effective schedule into the form', () => {
    expect(scheduleDraft(schedule)).toEqual({ frequency: 'Weekly', weekday: 5 })
    expect(scheduleDraft(schedule.fleetDefault)).toEqual({ frequency: 'Off', weekday: null })
  })

  it('a frequency this bundle does not know reads as Off, and a weekday only beside Weekly', () => {
    expect(scheduleDraft({ frequency: 'Monthly', weekday: 3 })).toEqual({ frequency: 'Off', weekday: null })
    expect(scheduleDraft({ frequency: 'Daily', weekday: 3 })).toEqual({ frequency: 'Daily', weekday: null })
  })

  it('weekly needs a weekday before it can be saved', () => {
    expect(scheduleReady({ frequency: 'Weekly', weekday: null })).toBe(false)
    expect(scheduleReady({ frequency: 'Weekly', weekday: 7 })).toBe(false)
    expect(scheduleReady({ frequency: 'Weekly', weekday: 0 })).toBe(true)
    expect(scheduleReady({ frequency: 'Off', weekday: null })).toBe(true)
  })

  it('sends a weekday only for weekly, and null as the code for the fleet default', () => {
    expect(scheduleRequest('P104', { frequency: 'Daily', weekday: 2 }, 'Busy store')).toEqual({ code: 'P104', frequency: 'Daily', weekday: null, reason: 'Busy store' })
    expect(scheduleRequest(null, { frequency: 'Weekly', weekday: 4 }, 'Fleet on Thursdays')).toEqual({ code: null, frequency: 'Weekly', weekday: 4, reason: 'Fleet on Thursdays' })
  })

  it('Save waits for a change', () => {
    expect(scheduleChanged({ frequency: 'Weekly', weekday: 5 }, schedule)).toBe(false)
    expect(scheduleChanged({ frequency: 'Weekly', weekday: 1 }, schedule)).toBe(true)
    expect(scheduleChanged({ frequency: 'Off', weekday: null }, schedule)).toBe(true)
  })
})
