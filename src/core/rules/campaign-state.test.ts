import { describe, expect, it } from 'vitest'

// 🚩 Pinned east of UTC, so the "across a UTC midnight" cases bite on any machine: under UTC the
// local and the UTC day never differ and those cases would pass without proving anything. Set
// before any Date is built (vitest isolates each file in its own worker).
process.env.TZ = 'Asia/Riyadh'
import type { RuleCampaignSchedule, RuleCampaignStatus } from '@/core/models/rule-campaign'
import { CAMPAIGN_STATES, campaignState, daysBetween, scheduleRelative } from './campaign-state'

const window = (from: string | null, until: string | null): RuleCampaignSchedule => ({
  from,
  until,
  days: [],
  hoursFrom: null,
  hoursTo: null,
})

/** A local wall-clock moment — the parts are local, as the reader's clock is. */
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

// The pin above only bites in a worker that honours a runtime TZ (vitest's `forks` pool does, a
// `threads` worker does not). Prove it took, so a pool change fails here instead of letting the
// cross-midnight cases pass vacuously (501 review).
it('runs east of UTC, so a local early morning is still the previous UTC day', () => {
  expect(at(2026, 10, 16, 1, 30).getUTCDate()).toBe(15)
})

const OCT16 = at(2026, 10, 16, 18, 30)

const of = (status: RuleCampaignStatus, schedule = window('2026-10-01', '2026-12-31')) => ({ status, schedule })

describe('campaignState_derivesScheduledRunningExpired_fromLocalNow', () => {
  it('a live campaign inside its window is running', () => {
    expect(campaignState(of('live'), OCT16)).toBe('running')
  })

  it('a live campaign before its start is scheduled, and running from the start day on', () => {
    expect(campaignState(of('live', window('2026-10-19', null)), OCT16)).toBe('scheduled')
    expect(campaignState(of('live', window('2026-10-16', null)), at(2026, 10, 16, 0, 0))).toBe('running')
    expect(campaignState(of('live', window('2026-10-17', null)), at(2026, 10, 16, 23, 59))).toBe('scheduled')
  })

  it('a live campaign is expired ON its end day — the end date is exclusive', () => {
    expect(campaignState(of('live', window('2026-08-27', '2026-09-04')), OCT16)).toBe('expired')
    expect(campaignState(of('live', window('2026-10-01', '2026-10-16')), at(2026, 10, 16, 0, 0))).toBe('expired')
    expect(campaignState(of('live', window('2026-10-01', '2026-10-17')), at(2026, 10, 16, 23, 59))).toBe('running')
  })

  it('a live campaign with no schedule runs with no time limit', () => {
    expect(campaignState(of('live', window(null, null)), OCT16)).toBe('running')
  })

  it('the stored states pass through, whatever the schedule says', () => {
    expect(campaignState(of('draft', window('2026-08-27', '2026-09-04')), OCT16)).toBe('draft')
    expect(campaignState(of('waitingForApproval'), OCT16)).toBe('waitingForApproval')
    expect(campaignState(of('disabled', window('2026-10-19', null)), OCT16)).toBe('disabled')
  })

  it('🚩 reads the LOCAL day: 01:30 local on the 16th is the 16th, though UTC may still say the 15th', () => {
    // Under Asia/Riyadh (UTC+3) this moment is 2026-10-15T22:30Z — a UTC reading would call it
    // scheduled. The local reading is the only one; under any zone the answer is the same.
    expect(campaignState(of('live', window('2026-10-16', null)), at(2026, 10, 16, 1, 30))).toBe('running')
  })

  it('a status HQ has not agreed with us reads as a draft, never as live', () => {
    expect(campaignState({ status: 'archived' as RuleCampaignStatus, schedule: window(null, null) }, OCT16)).toBe('draft')
  })

  it('a malformed day is read as absent rather than as a date', () => {
    expect(campaignState(of('live', window('16/10/2026', 'soon')), OCT16)).toBe('running')
  })

  it('every derived state has a tile, in the ticket’s order', () => {
    expect(CAMPAIGN_STATES).toEqual(['draft', 'waitingForApproval', 'scheduled', 'running', 'expired', 'disabled'])
  })
})

describe('scheduleRelative_saysStartsInNDays_inLocalDays', () => {
  it('"starts in 3 days" counts local calendar days, whatever the hour', () => {
    expect(scheduleRelative(window('2026-10-19', '2026-12-31'), at(2026, 10, 16, 0, 5))).toEqual({ kind: 'startsIn', days: 3 })
    expect(scheduleRelative(window('2026-10-19', '2026-12-31'), at(2026, 10, 16, 23, 55))).toEqual({ kind: 'startsIn', days: 3 })
  })

  it('🚩 across a UTC midnight: 02:30 local on the 16th still counts from the 16th', () => {
    // Under UTC+3 this is 23:30Z on the 15th; a UTC count would say 4 days.
    expect(scheduleRelative(window('2026-10-19', null), at(2026, 10, 16, 2, 30))).toEqual({ kind: 'startsIn', days: 3 })
  })

  it('a running campaign says how many days until its (exclusive) end', () => {
    expect(scheduleRelative(window('2026-10-01', '2026-12-31'), OCT16)).toEqual({ kind: 'endsIn', days: 76 })
    expect(scheduleRelative(window('2026-10-01', '2026-10-17'), OCT16)).toEqual({ kind: 'endsIn', days: 1 })
  })

  it('an ended campaign says how long ago, and "today" on its end day', () => {
    expect(scheduleRelative(window('2026-08-27', '2026-09-04'), OCT16)).toEqual({ kind: 'endedAgo', days: 42 })
    expect(scheduleRelative(window('2026-10-01', '2026-10-16'), OCT16)).toEqual({ kind: 'endedToday' })
  })

  it('no end is open-ended, and no schedule at all is no time limit', () => {
    expect(scheduleRelative(window('2026-01-01', null), OCT16)).toEqual({ kind: 'noEnd' })
    expect(scheduleRelative(window(null, null), OCT16)).toEqual({ kind: 'noLimit' })
    expect(scheduleRelative(window(null, '2026-12-31'), OCT16)).toEqual({ kind: 'endsIn', days: 76 })
  })
})

describe('daysBetween', () => {
  it('counts calendar days, not 24-hour spans', () => {
    expect(daysBetween('2026-10-16', '2026-10-19')).toBe(3)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-10-19', '2026-10-16')).toBe(-3)
  })
})
