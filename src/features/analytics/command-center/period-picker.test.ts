/**
 * oms 948, 949 (BO 4177/4178): the period picker's choices, and the URL each moves the page to. A chip applies the rolling
 * 4 weeks or year-to-date at once; dates apply on Apply, once both ends are typed and in order.
 */
import { describe, expect, it } from 'vitest'
import { withPeriod } from '@/core/command-center-routes'
import { chipChoice, datesChoice, periodKey } from './period-picker'

describe('the period picker', () => {
  it('a chip applies at once, except dates, which wait for their ends', () => {
    expect(chipChoice('ytd')).toEqual({ period: 'ytd' })
    expect(chipChoice('rolling4')).toEqual({ period: 'rolling4' })
    expect(chipChoice('dates')).toBeNull()
  })

  it('Apply with both ends moves the URL to the dates, the language and the narrowing kept', () => {
    const picked = datesChoice('2026-10-01', '2026-10-14')
    expect(picked).toEqual({ period: 'dates', from: '2026-10-01', to: '2026-10-14' })
    expect(withPeriod(new URLSearchParams('lang=ar&scope=region&region=WEST&period=ytd'), picked!).toString()).toBe(
      'lang=ar&scope=region&region=WEST&period=dates&from=2026-10-01&to=2026-10-14',
    )
    // The rolling 4 weeks are the default and name nothing.
    expect(withPeriod(new URLSearchParams('period=dates&from=2026-10-01&to=2026-10-14&lang=en'), chipChoice('rolling4')!).toString()).toBe('lang=en')
  })

  it('Apply has nothing to apply with an end missing or the ends reversed', () => {
    expect(datesChoice('2026-10-01', '')).toBeNull()
    expect(datesChoice('', '2026-10-14')).toBeNull()
    expect(datesChoice('2026-10-14', '2026-10-01')).toBeNull()
  })

  it('the picker remounts on a new period', () => {
    expect(periodKey({ period: 'dates', from: '2026-10-01', to: '2026-10-14' })).not.toBe(periodKey({ period: 'dates', from: '2026-10-01', to: '2026-10-15' }))
    expect(periodKey({ period: 'ytd' })).not.toBe(periodKey({ period: 'rolling4' }))
  })
})
