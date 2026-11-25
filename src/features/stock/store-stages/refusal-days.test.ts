/**
 * BackOffice 4277 (spec 4275 "What head office sees", ADR 0146): the stage sheet shows, per day of the would-be refusals'
 * window, the fallback's share of scanned takes beside the would-be refusal share, and in a `Record` store the would-be
 * placements. The fallback has no gate of its own: these are figures, never a verdict.
 */
import { describe, expect, it } from 'vitest'
import type { StoreGates, StoreRefusalDay } from '@/core/models/store-stage'
import { formatShare, refusalDaysView } from './refusal-days'

const day = (over: Partial<StoreRefusalDay>): StoreRefusalDay => ({
  day: '2026-11-24',
  takes: 0,
  refused: 0,
  refusalShare: null,
  scannedTakes: 0,
  fallbackTakes: 0,
  fallbackShare: null,
  wouldBePlacements: 0,
  ...over,
})

const gates = (over: Partial<StoreGates>): StoreGates => ({
  store: 'P077',
  from: '2026-11-11T00:00:00',
  to: '2026-11-24T00:00:00',
  hold: true,
  measured: [],
  confirmed: [],
  notConfirmed: [],
  waived: [],
  ...over,
})

describe('a share as drawn', () => {
  it('a fraction is a percentage to two places; a day with nothing to share is blank, never 0%', () => {
    expect(formatShare(0.015)).toBe('1.50%')
    expect(formatShare(0)).toBe('0.00%')
    expect(formatShare(0.1234)).toBe('12.34%')
    expect(formatShare(null)).toBe('')
  })
})

describe('the refusal days on the stage sheet', () => {
  it('each day in the server’s order, the fallback share beside the refusal share', () => {
    const view = refusalDaysView(
      gates({
        expiryFallback: 'On',
        refusalDays: [
          day({ day: '2026-11-23T00:00:00', takes: 200, refused: 3, refusalShare: 0.015, scannedTakes: 80, fallbackTakes: 4, fallbackShare: 0.05 }),
          day({ day: '2026-11-24T00:00:00' }),
        ],
      }),
    )
    expect(view.state).toBe('On')
    expect(view.showWouldBe).toBe(false)
    expect(view.lines).toEqual([
      { day: '2026-11-23', takes: 200, refused: 3, refusalShare: '1.50%', scannedTakes: 80, fallbackTakes: 4, fallbackShare: '5.00%', wouldBePlacements: 0 },
      { day: '2026-11-24', takes: 0, refused: 0, refusalShare: '', scannedTakes: 0, fallbackTakes: 0, fallbackShare: '', wouldBePlacements: 0 },
    ])
  })

  it('a Record store also shows the would-be placements', () => {
    const view = refusalDaysView(gates({ expiryFallback: 'Record', refusalDays: [day({ refused: 2, wouldBePlacements: 2 })] }))
    expect(view.showWouldBe).toBe(true)
    expect(view.lines[0].wouldBePlacements).toBe(2)
  })

  it('an older server without the days shows none, and its state reads as unknown', () => {
    expect(refusalDaysView(gates({}))).toEqual({ state: null, showWouldBe: false, lines: [] })
    expect(refusalDaysView(null)).toEqual({ state: null, showWouldBe: false, lines: [] })
  })
})
