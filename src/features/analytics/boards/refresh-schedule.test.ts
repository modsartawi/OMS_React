import { describe, expect, it } from 'vitest'
import { boardRefresh, nextDueAt, panelOffsets, readRefresh, refreshChoices, refreshFloorMs, startSchedule, tick } from './refresh-schedule'

describe('refresh schedule', () => {
  it('staggers the panels evenly across one interval, in board order', () => {
    expect(panelOffsets(['a', 'b', 'c', 'd'], 60_000)).toEqual({ a: 0, b: 15_000, c: 30_000, d: 45_000 })
    expect(panelOffsets(['only'], 30_000)).toEqual({ only: 0 })
    expect(panelOffsets([], 30_000)).toEqual({})
  })

  // Every minute, two panels: `a` re-asks on the minute, `b` on the half minute (wall-clock time, so
  // every screen on the board asks a panel at the same moment, inside the server's result cache).
  const start = () => startSchedule(['a', 'b'], 60_000, 1_000_000)

  it('asks nothing at start, then each panel at its own offset', () => {
    let s = start()
    expect(nextDueAt(s)).toBe(1_020_000)
    let r = tick(s, 1_019_999, false)
    expect(r.due).toEqual([])
    r = tick(r.schedule, 1_020_000, false)
    expect(r.due).toEqual(['a'])
    expect(nextDueAt(r.schedule)).toBe(1_050_000)
    r = tick(r.schedule, 1_050_000, false)
    expect(r.due).toEqual(['b'])
    s = r.schedule
    expect(nextDueAt(s)).toBe(1_080_000)
  })

  it('asks nothing while the tab is hidden, and one catch-up per panel when it is visible again', () => {
    let r = tick(start(), 1_050_000, false)
    for (const at of [1_080_000, 1_200_000, 1_399_999]) {
      r = tick(r.schedule, at, true)
      expect(r.due).toEqual([])
    }
    // Five intervals missed: each panel re-asks ONCE, then the schedule carries on from now.
    r = tick(r.schedule, 1_400_000, false)
    expect(r.due).toEqual(['a', 'b'])
    expect(tick(r.schedule, 1_400_000, false).due).toEqual([])
    expect(nextDueAt(r.schedule)).toBe(1_410_000)
  })

  it('keeps the panels in board order, even with ids that look like numbers', () => {
    const r = tick(startSchedule(['9', '2', '10'], 30_000, 0), 60_000, false)
    expect(r.due).toEqual(['9', '2', '10'])
  })

  it('reads the floor from config: 30 s by default, 1 min when 750 says so', () => {
    expect(refreshFloorMs(undefined)).toBe(30_000)
    expect(refreshFloorMs('')).toBe(30_000)
    expect(refreshFloorMs('60')).toBe(60_000)
    expect(refreshFloorMs('soon')).toBe(30_000)
    expect(refreshFloorMs('-5')).toBe(30_000)
  })

  it('offers Off and every interval at or above the floor', () => {
    expect(refreshChoices(30_000)).toEqual(['off', '30s', '1m', '5m', '15m'])
    expect(refreshChoices(60_000)).toEqual(['off', '1m', '5m', '15m'])
  })

  it('reads an interval from the permalink, lifting one under the floor to the floor', () => {
    expect(readRefresh('5m', 30_000)).toBe('5m')
    expect(readRefresh('off', 30_000)).toBe('off')
    expect(readRefresh('30s', 60_000)).toBe('1m')
    expect(readRefresh('2m', 30_000)).toBeNull()
    expect(readRefresh(null, 30_000)).toBeNull()
  })

  it("takes the permalink's interval, else the viewer's session choice, else the board's saved default, else Off", () => {
    expect(boardRefresh({ url: '30s', session: '5m', saved: '15m' }, 30_000)).toBe('30s')
    expect(boardRefresh({ url: null, session: '5m', saved: '15m' }, 30_000)).toBe('5m')
    expect(boardRefresh({ url: 'nonsense', session: null, saved: '15m' }, 30_000)).toBe('15m')
    expect(boardRefresh({ url: null, session: null, saved: undefined }, 30_000)).toBe('off')
    // A saved 30 s board under a 1 min floor runs at 1 min.
    expect(boardRefresh({ url: null, session: null, saved: '30s' }, 60_000)).toBe('1m')
  })
})
