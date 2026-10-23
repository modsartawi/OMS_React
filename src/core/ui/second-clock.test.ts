/**
 * The shared 1 s clock (review of BackOffice spec 2952): every countdown on a screen moves on ONE
 * interval, however many cells or lines read it, and the interval stops when the last one leaves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { secondClock } from './second-clock'

describe('secondClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs one interval for many readers, and none once they have all left', () => {
    expect(vi.getTimerCount()).toBe(0)
    const leave = [1, 2, 3, 4, 5].map(() => secondClock.subscribe(() => {}))
    expect(vi.getTimerCount()).toBe(1)
    leave.slice(0, 4).forEach((l) => l())
    expect(vi.getTimerCount()).toBe(1)
    leave[4]()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reads the time a reader joined at, then moves each second and tells every reader', () => {
    const a = vi.fn()
    const b = vi.fn()
    const leaveA = secondClock.subscribe(a)
    const leaveB = secondClock.subscribe(b)
    expect(secondClock.getSnapshot()).toBe(1_000_000)
    vi.advanceTimersByTime(1000)
    expect(secondClock.getSnapshot()).toBe(1_001_000)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    leaveA()
    leaveB()
  })
})
