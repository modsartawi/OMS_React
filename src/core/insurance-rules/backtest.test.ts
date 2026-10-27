/**
 * Ticket 612 — a back-test of the guard draft (`GET InsuranceRules/Guards/Backtests/{id}`, door 3140): whether it is
 * still running, how far it got, whether it is the CURRENT revision's (611's Submit gate), its fires, and a patient
 * key that is never shown whole.
 */
import { describe, expect, it } from 'vitest'
import { backtestFires, backtestIsCurrent, backtestProgressPct, backtestRunning, maskedKey, type GuardBacktest } from './backtest'

const bt = (o: Partial<GuardBacktest> = {}): GuardBacktest => ({
  status: 'done',
  progress: 1,
  revision: 12,
  fires: { refuse: 4, override: 30, warn: 6 },
  stopped: [],
  sar: 0,
  distinct: { patients: 0, stores: 0, pharmacists: 0 },
  overlap: 0,
  ...o,
})

describe('a back-test', () => {
  it('runs while queued or running, and stops polling once done or failed', () => {
    expect([bt({ status: 'queued' }), bt({ status: 'running' }), bt({ status: 'done' }), bt({ status: 'failed' })].map(backtestRunning)).toEqual([
      true,
      true,
      false,
      false,
    ])
  })

  it('reads its progress as a whole percent, held inside 0–100', () => {
    expect([0, 0.426, 1, 1.4, -0.2].map((p) => backtestProgressPct(bt({ progress: p })))).toEqual([0, 43, 100, 100, 0])
  })

  it('is current only when it finished on the revision the draft is at', () => {
    expect(backtestIsCurrent(bt(), 12)).toBe(true)
    expect(backtestIsCurrent(bt({ revision: 11 }), 12)).toBe(false)
    expect(backtestIsCurrent(bt({ status: 'running' }), 12)).toBe(false)
    expect(backtestIsCurrent(null, 12)).toBe(false)
  })

  it('counts its fires heaviest first, with their total', () => {
    expect(backtestFires(bt())).toEqual({ rows: [['REFUSE', 4], ['OVERRIDE', 30], ['WARN', 6]], total: 40 })
  })
})

describe('maskedKey', () => {
  it('keeps a key HQ already masked as it came', () => {
    expect(maskedKey('10••••••83')).toBe('10••••••83')
  })

  it('masks a whole National ID / Iqama that slipped through, keeping two digits each end', () => {
    expect(maskedKey('1023456783')).toBe('10••••••83')
    expect(maskedKey('2412345619')).toBe('24••••••19')
  })

  it('never shows an empty or short key as data', () => {
    expect(maskedKey('')).toBe('')
    expect(maskedKey('1234')).toBe('••••')
  })
})
