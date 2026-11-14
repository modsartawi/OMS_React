import { describe, expect, it } from 'vitest'
import { canStepForward, formatAge, normalizeStores, stepDay } from './shared'

describe('formatAge', () => {
  it('draws a feed age in whole seconds as h:mm:ss, hours uncapped', () => {
    expect(formatAge(0)).toBe('0:00:00')
    expect(formatAge(59)).toBe('0:00:59')
    expect(formatAge(3_725)).toBe('1:02:05')
    expect(formatAge(90_061)).toBe('25:01:01')
  })

  it('draws no age (null, negative, not a number) as blank, never as zero', () => {
    expect(formatAge(null)).toBe('')
    expect(formatAge(undefined)).toBe('')
    expect(formatAge(-1)).toBe('')
    expect(formatAge(Number.NaN)).toBe('')
  })
})

describe('stepping a day', () => {
  it('moves a day back or forward across a month and a year end', () => {
    expect(stepDay('2026-11-01', -1)).toBe('2026-10-31')
    expect(stepDay('2025-12-31', 1)).toBe('2026-01-01')
    expect(stepDay('', 1)).toBe('')
  })

  it('goes forward only up to today: no refusal is logged tomorrow', () => {
    const NOW = new Date(2026, 10, 14, 0, 30)
    expect(canStepForward('2026-11-13', NOW)).toBe(true)
    expect(canStepForward('2026-11-14', NOW)).toBe(false)
    expect(canStepForward('', NOW)).toBe(false)
  })
})

describe('normalizeStores', () => {
  it('splits on commas, semicolons or spaces, upper-cases and de-duplicates, as the door does', () => {
    expect(normalizeStores(' p001, P002  p001;p003 ')).toBe('P001,P002,P003')
    expect(normalizeStores('   ')).toBe('')
  })
})
