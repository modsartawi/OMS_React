/**
 * Ticket 666 — a promotion's start and end are Saudi local date + time (spec 3201 story 12): start
 * defaults to now, end to 23:59 of the day picked, and the wall time typed is what is sent — never
 * converted to UTC.
 */
import { describe, expect, it } from 'vitest'
import { defaultWindow, pickEndDay, windowFromLocal, windowProblem, windowToLocal } from './local-window'

// 2026-10-29 11:07:42 in Riyadh — 08:07:42 UTC.
const NOW = new Date('2026-10-29T08:07:42Z')

describe('localWindow', () => {
  it('start defaults to now, Saudi wall time, whatever the browser zone', () => {
    const w = defaultWindow(NOW)
    expect([w.startDate, w.startTime]).toEqual(['2026-10-29', '11:07'])
  })

  it('end defaults to 23:59 of that day', () => {
    const w = defaultWindow(NOW)
    expect([w.endDate, w.endTime]).toEqual(['2026-10-29', '23:59'])
  })

  it('near midnight UTC the Saudi day is already the next one', () => {
    expect(defaultWindow(new Date('2026-10-29T22:30:00Z')).startDate).toBe('2026-10-30')
  })

  it('picking an end day takes 23:59 of it', () => {
    const w = pickEndDay({ ...defaultWindow(NOW), endTime: '18:00' }, '2026-11-15')
    expect([w.endDate, w.endTime]).toEqual(['2026-11-15', '23:59'])
  })

  it('the value sent is the wall time typed, seconds zero, no offset, no conversion', () => {
    expect(windowToLocal({ startDate: '2026-11-01', startTime: '00:00', endDate: '2026-11-30', endTime: '23:59' })).toEqual({
      startAt: '2026-11-01T00:00:00',
      endAt: '2026-11-30T23:59:00',
    })
  })

  it('a saved window reads back into the boxes', () => {
    expect(windowFromLocal('2026-11-01T09:30:00', '2026-11-30T23:59:00')).toEqual({
      startDate: '2026-11-01',
      startTime: '09:30',
      endDate: '2026-11-30',
      endTime: '23:59',
    })
  })

  it('an end at or before the start is flagged', () => {
    const base = { startDate: '2026-11-01', startTime: '10:00', endDate: '2026-11-01' }
    expect(windowProblem({ ...base, endTime: '10:00' }, NOW)).toBe('endNotAfterStart')
    expect(windowProblem({ ...base, endTime: '09:59' }, NOW)).toBe('endNotAfterStart')
    expect(windowProblem({ ...base, endTime: '10:01' }, NOW)).toBeNull()
  })

  it('an end already past is flagged', () => {
    expect(windowProblem({ startDate: '2026-10-01', startTime: '00:00', endDate: '2026-10-29', endTime: '11:00' }, NOW)).toBe('endPast')
  })

  it('a box left empty is flagged', () => {
    expect(windowProblem({ startDate: '', startTime: '10:00', endDate: '2026-11-01', endTime: '23:59' }, NOW)).toBe('incomplete')
  })
})
