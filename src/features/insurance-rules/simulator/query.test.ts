/**
 * Ticket 612 — the simulator's address: `?tab=simulate|backtest&days=30|90|180&id=`. A back-test followed by its id
 * survives a reload; a value the screen does not know reads as the default.
 */
import { describe, expect, it } from 'vitest'
import { simulatorFromParams, simulatorToParams } from './query'

const read = (s: string) => simulatorFromParams(new URLSearchParams(s))

describe('the simulator address', () => {
  it('opens on Simulate, 30 days, no back-test', () => {
    expect(read('')).toEqual({ tab: 'simulate', days: 30, id: null })
  })

  it('reads the back-test tab, its window and the job it follows', () => {
    expect(read('tab=backtest&days=90&id=BT-7')).toEqual({ tab: 'backtest', days: 90, id: 'BT-7' })
  })

  it('an unknown tab or window reads as the default', () => {
    expect(read('tab=x&days=45&id=')).toEqual({ tab: 'simulate', days: 30, id: null })
  })

  it('writes only what differs from the default', () => {
    expect(simulatorToParams({ tab: 'simulate', days: 30, id: null }).toString()).toBe('')
    expect(simulatorToParams({ tab: 'backtest', days: 180, id: 'BT-7' }).toString()).toBe('tab=backtest&days=180&id=BT-7')
  })
})
