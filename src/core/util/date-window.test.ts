/**
 * Ticket 556 — the date-only search window of the delivery-rail monitors, graduated from the
 * Deliverect orders monitor (478) when the HungerStation monitor became its second reader: both
 * ends included, a ceiling in days, and (HungerStation) a floor and a ceiling on the dates.
 */
import { describe, expect, it } from 'vitest'
import { addDays, localToday, windowDays, windowProblem } from './date-window'

describe('localToday', () => {
  it('is the LOCAL calendar date, from its parts — never toISOString', () => {
    expect(localToday(new Date(2026, 9, 13, 0, 30))).toBe('2026-10-13')
  })
})

describe('addDays', () => {
  it('steps calendar days across a month end, a year end and a leap day', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('windowDays', () => {
  it('counts both ends', () => {
    expect(windowDays('2026-10-24', '2026-10-24')).toBe(1)
    expect(windowDays('2026-10-01', '2026-10-31')).toBe(31)
    expect(windowDays('x', '2026-10-31')).toBeNull()
  })
})

describe('windowProblem', () => {
  const rule = { maxDays: 31 }

  it('31 days pass, 32 are too long', () => {
    expect(windowProblem('2026-10-01', '2026-10-31', rule)).toBeNull()
    expect(windowProblem('2026-10-01', '2026-11-01', rule)).toBe('tooLong')
  })

  it('reversed and invalid', () => {
    expect(windowProblem('2026-10-12', '2026-10-11', rule)).toBe('reversed')
    for (const bad of ['', '2026-02-30', '12/10/2026']) expect(windowProblem(bad, '2026-10-12', rule)).toBe('invalid')
  })

  it('with bounds: from not before the earliest day, to not after the latest', () => {
    const bounded = { maxDays: 31, earliest: '2000-01-01', latest: '2026-10-25' }
    expect(windowProblem('2000-01-01', '2000-01-31', bounded)).toBeNull()
    expect(windowProblem('1999-12-31', '2000-01-01', bounded)).toBe('outOfBounds')
    expect(windowProblem('2026-10-24', '2026-10-25', bounded)).toBeNull()
    expect(windowProblem('2026-10-24', '2026-10-26', bounded)).toBe('outOfBounds')
  })

  it('no bounds named: any real date passes', () => {
    expect(windowProblem('1990-01-01', '1990-01-02', rule)).toBeNull()
  })
})
