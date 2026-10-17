import { describe, expect, it } from 'vitest'
import { formToWindow, scheduleProblems, windowToForm, type ScheduleForm } from './schedule'

const form = (o: Partial<ScheduleForm> = {}): ScheduleForm => ({ from: '', until: '', days: [], hoursFrom: '', hoursTo: '', ...o })

describe('window local ↔ wire', () => {
  it('schedule_roundTripsLocalDateTime_withNoUtcShift', () => {
    // Midnight-adjacent values are where a UTC round trip moves the day (Riyadh is UTC+3).
    const w = { from: '2026-10-16', until: '2027-01-01', days: ['thu' as const, 'fri' as const], hours: { from: '00:30', until: '23:59' } }
    const f = windowToForm(w)
    expect(f).toEqual({ from: '2026-10-16', until: '2027-01-01', days: ['thu', 'fri'], hoursFrom: '00:30', hoursTo: '23:59' })
    const back = formToWindow(f)
    expect(back).toEqual(w)
    for (const v of [back.from, back.until, back.hours?.from, back.hours?.until]) expect(v).not.toMatch(/Z|T|[+-]\d{2}:\d{2}$/)
  })

  it('keeps hours that cross midnight, as the contract allows', () => {
    expect(formToWindow(form({ hoursFrom: '22:00', hoursTo: '02:00' }))).toEqual({ hours: { from: '22:00', until: '02:00' } })
    expect(scheduleProblems(form({ hoursFrom: '22:00', hoursTo: '02:00' }))).toEqual([])
  })

  it('reads a moment on the wire as its local day, and seconds as the minute, never shifting them', () => {
    const f = windowToForm({ from: '2026-10-16T00:00:00', until: '2026-10-20T02:15:00', hours: { from: '00:00:00', until: '16:45:59' } })
    expect(f).toMatchObject({ from: '2026-10-16', until: '2026-10-20', hoursFrom: '00:00', hoursTo: '16:45' })
  })

  it('reads a day written with a Z or an offset as written, so a Save never erases it', () => {
    expect(windowToForm({ from: '2026-10-01T00:00:00Z', until: '2026-11-01T00:00:00+03:00' })).toMatchObject({ from: '2026-10-01', until: '2026-11-01' })
  })

  it('an empty field is left out of the wire: no start is immediately, no end open-ended, no hours all day', () => {
    expect(formToWindow(form())).toEqual({})
    expect(windowToForm({})).toEqual(form())
    expect(windowToForm(undefined)).toEqual(form())
  })

  it('sends the weekdays once each, Sunday first; every day is no days at all', () => {
    expect(formToWindow(form({ days: ['sat', 'sun', 'thu', 'sat'] })).days).toEqual(['sun', 'thu', 'sat'])
    expect(formToWindow(form({ days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] })).days).toBeUndefined()
  })

  it('reads a malformed value as empty rather than guessing', () => {
    expect(windowToForm({ from: '16/10/2026', hours: { from: '4pm', until: '18:00' } })).toMatchObject({ from: '', hoursFrom: '' })
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

  it('refuses hours that are not a pair, or that end when they start', () => {
    expect(scheduleProblems(form({ hoursFrom: '16:00' }))).toEqual(['hoursIncomplete'])
    expect(scheduleProblems(form({ hoursTo: '22:00' }))).toEqual(['hoursIncomplete'])
    expect(scheduleProblems(form({ hoursFrom: '16:00', hoursTo: '16:00' }))).toEqual(['hoursSame'])
    expect(scheduleProblems(form({ hoursFrom: '16:00', hoursTo: '23:00' }))).toEqual([])
  })
})
