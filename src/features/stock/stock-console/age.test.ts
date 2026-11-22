import { describe, expect, it } from 'vitest'
import { ageView } from './age'

describe('an age as the console says it', () => {
  it('under a minute, or ahead of the reader’s clock, is "just now"', () => {
    expect(ageView(30)).toEqual({ key: 'age.justNow', values: {} })
    expect(ageView(-90)).toEqual({ key: 'age.justNow', values: {} })
  })

  it('minutes, hours and minutes, days and hours', () => {
    expect(ageView(12 * 60)).toEqual({ key: 'age.minutes', values: { m: 12 } })
    expect(ageView(3 * 3600 + 5 * 60)).toEqual({ key: 'age.hours', values: { h: 3, m: 5 } })
    expect(ageView(2 * 86400 + 4 * 3600)).toEqual({ key: 'age.days', values: { d: 2, h: 4 } })
  })

  it('with no figure is no answer — never "just now"', () => {
    expect(ageView(null)).toBeNull()
    expect(ageView(undefined)).toBeNull()
    expect(ageView(Number.NaN)).toBeNull()
  })
})
