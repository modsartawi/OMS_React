import { describe, expect, it } from 'vitest'
import type { RuleCampaignSchedule } from '@/core/models/rule-campaign'
import { formToSchedule, scheduleProblems, scheduleToForm, type ScheduleForm } from './schedule'

const wire = (o: Partial<RuleCampaignSchedule> = {}): RuleCampaignSchedule => ({
  from: null,
  until: null,
  days: [],
  hoursFrom: null,
  hoursTo: null,
  ...o,
})
const form = (o: Partial<ScheduleForm> = {}): ScheduleForm => ({ from: '', until: '', days: [], hoursFrom: '', hoursTo: '', ...o })

describe('schedule local ↔ wire', () => {
  it('schedule_roundTripsLocalDateTime_withNoUtcShift', () => {
    // Midnight-adjacent values are where a UTC round trip moves the day (Riyadh is UTC+3).
    const s = wire({ from: '2026-10-16', until: '2027-01-01', days: [4, 5], hoursFrom: '00:30', hoursTo: '23:59' })
    const f = scheduleToForm(s)
    expect(f).toEqual({ from: '2026-10-16', until: '2027-01-01', days: [4, 5], hoursFrom: '00:30', hoursTo: '23:59' })
    const back = formToSchedule(f)
    expect(back).toEqual(s)
    for (const v of [back.from, back.until, back.hoursFrom, back.hoursTo]) expect(v).not.toMatch(/Z|T|[+-]\d{2}:\d{2}$/)
  })

  it('reads a moment on the wire as its local day, and seconds as the minute, never shifting them', () => {
    const f = scheduleToForm(wire({ from: '2026-10-16T00:00:00', until: '2026-10-20T02:15:00', hoursFrom: '00:00:00', hoursTo: '16:45:59' }))
    expect(f).toMatchObject({ from: '2026-10-16', until: '2026-10-20', hoursFrom: '00:00', hoursTo: '16:45' })
  })

  it('reads a day written with a Z or an offset as written, so a Save never erases it', () => {
    expect(scheduleToForm(wire({ from: '2026-10-01T00:00:00Z', until: '2026-11-01T00:00:00+03:00' }))).toMatchObject({ from: '2026-10-01', until: '2026-11-01' })
  })

  it('an empty field is null on the wire: no start is immediately, no end is open-ended, no hours is all day', () => {
    expect(formToSchedule(form())).toEqual(wire())
    expect(scheduleToForm(wire())).toEqual(form())
  })

  it('sends the weekdays once each, in week order', () => {
    expect(formToSchedule(form({ days: [6, 0, 4, 6] })).days).toEqual([0, 4, 6])
  })

  it('reads a malformed value as empty rather than guessing', () => {
    expect(scheduleToForm(wire({ from: '16/10/2026', hoursFrom: '4pm' }))).toMatchObject({ from: '', hoursFrom: '' })
  })
})

describe('scheduleProblems', () => {
  it('accepts an empty schedule, a start alone, an end alone', () => {
    expect(scheduleProblems(form())).toEqual([])
    expect(scheduleProblems(form({ from: '2026-10-16' }))).toEqual([])
    expect(scheduleProblems(form({ until: '2026-10-16' }))).toEqual([])
  })

  it('refuses an end on or before the start (the end day is exclusive)', () => {
    expect(scheduleProblems(form({ from: '2026-10-16', until: '2026-10-16' }))).toEqual(['untilNotAfterFrom'])
    expect(scheduleProblems(form({ from: '2026-10-16', until: '2026-10-15' }))).toEqual(['untilNotAfterFrom'])
    expect(scheduleProblems(form({ from: '2026-10-16', until: '2026-10-17' }))).toEqual([])
  })

  it('refuses daily hours that end on or before they start; one end alone is fine', () => {
    expect(scheduleProblems(form({ hoursFrom: '16:00', hoursTo: '16:00' }))).toEqual(['hoursToNotAfterFrom'])
    expect(scheduleProblems(form({ hoursFrom: '22:00', hoursTo: '02:00' }))).toEqual(['hoursToNotAfterFrom'])
    expect(scheduleProblems(form({ hoursFrom: '16:00' }))).toEqual([])
    expect(scheduleProblems(form({ hoursTo: '22:00' }))).toEqual([])
  })
})
