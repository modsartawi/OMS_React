import { describe, expect, it } from 'vitest'
import { dayOf, windowDays } from './wire-days'

// Moved from the upload screens' report.test.ts (ticket 534) when the helper graduated to core.
describe('windowDays', () => {
  it('shows windowUntil as sent: the inclusive last day, never moved a day', () => {
    expect(windowDays('2026-10-09T00:00:00', '2026-10-15T00:00:00')).toBe('2026-10-09 – 2026-10-15')
    // A day-only value (the stored summary's) reads the same.
    expect(windowDays('2026-10-09', '2026-10-15')).toBe('2026-10-09 – 2026-10-15')
  })

  it('never parses the day through a Date, so no time zone moves it', () => {
    expect(dayOf('2026-10-15T23:59:59')).toBe('2026-10-15')
    expect(dayOf('2026-10-15T00:00:00')).toBe('2026-10-15')
  })

  it('gives no range when the window is null, or never set', () => {
    expect(windowDays(null, null)).toBeNull()
    expect(windowDays('0001-01-01T00:00:00', '0001-01-01T00:00:00')).toBeNull()
    expect(dayOf(undefined)).toBe('')
  })

  it('gives no range for a lone end, never a one-day window', () => {
    expect(windowDays('2026-10-09T00:00:00', null)).toBeNull()
    expect(windowDays('0001-01-01T00:00:00', '2026-10-15T00:00:00')).toBeNull()
  })
})
