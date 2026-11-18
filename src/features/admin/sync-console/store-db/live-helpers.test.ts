import { describe, expect, it } from 'vitest'
import type { StoreDbLiveActivity } from '@/core/models/store-database'
import fixture from './__fixtures__/live-activity.json'
import { liveActivityOf, liveSections, lookTime } from './live-helpers'

const live = fixture as StoreDbLiveActivity

describe('liveSections', () => {
  it('draws the four result sets in the door\'s order, each with its rows', () => {
    expect(liveSections(live).map((s) => [s.key, s.rows.length])).toEqual([
      ['running', 2],
      ['headBlockers', 1],
      ['workerSessions', 2],
      ['longTransactions', 1],
    ])
  })
})

describe('liveActivityOf', () => {
  it('a result set the door leaves out is an empty table, not a crash', () => {
    expect(liveActivityOf({ running: live.running } as never)).toEqual({
      takenAt: null,
      running: live.running,
      headBlockers: [],
      workerSessions: [],
      longTransactions: [],
    })
  })
})

describe('lookTime', () => {
  it('is the server\'s time of the look when it sends one', () => {
    expect(lookTime(live, Date.parse('2026-11-18T10:45:00'))).toBe('2026-11-18T10:41:30')
  })

  it('is the moment the answer arrived when the server sends none (local wall-clock, no zone)', () => {
    expect(lookTime({ ...live, takenAt: null }, new Date(2026, 10, 18, 9, 5, 7).getTime())).toBe('2026-11-18T09:05:07')
  })

  it('is nothing before any answer', () => {
    expect(lookTime(undefined, 0)).toBeNull()
  })
})
