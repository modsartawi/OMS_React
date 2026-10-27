/**
 * Ticket 612 — a back-test of the guard draft (`GET InsuranceRules/Guards/Backtests/{id}`, door 3140): whether it is
 * still running, how far it got, whether it is the CURRENT revision's (611's Submit gate), its fires, and a patient
 * key that is never shown whole.
 */
import { describe, expect, it } from 'vitest'
import { backtestFires, backtestIsCurrent, backtestProgressPct, backtestRunning, draftBacktest, maskedKey, stoppedShown, type GuardBacktest } from './backtest'

const bt = (o: Partial<GuardBacktest> = {}): GuardBacktest => ({
  id: 'BT-1',
  status: 'done',
  progress: 1,
  revision: 12,
  days: 90,
  requestedBy: 'nalharbi',
  requestedAt: '2026-10-27T10:00:00',
  finishedAt: '2026-10-27T10:02:00',
  error: null,
  since: '2026-07-29',
  requests: 1200,
  lines: 3400,
  fires: { refuse: 4, override: 30, warn: 6 },
  stopped: [],
  stoppedTotal: 0,
  sar: 0,
  distinct: { patients: 0, stores: 0, pharmacists: 0 },
  overlap: 0,
  rules: [],
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

describe('the draft’s back-test (GET …/Backtests, newest first)', () => {
  it('draftBacktest_isTheFinishedOneOfTheCurrentRevision_elseItsNewest_elseTheNewest', () => {
    // A finished back-test of the revision is what HQ's Submit accepts, so it wins over a newer running one.
    const list = [bt({ id: 'BT-3', revision: 12, status: 'running' }), bt({ id: 'BT-2', revision: 12 }), bt({ id: 'BT-1', revision: 11 })]
    expect(draftBacktest(list, 12)?.id).toBe('BT-2')
    expect(draftBacktest([list[0], list[2]], 12)?.id).toBe('BT-3')
    expect(draftBacktest([bt({ id: 'BT-1', revision: 11 })], 12)?.id).toBe('BT-1')
    expect(draftBacktest([], 12)).toBeNull()
    expect(draftBacktest(null, 12)).toBeNull()
  })

  it('a finished one of the revision wins over a newer failed one', () => {
    expect(draftBacktest([bt({ id: 'BT-3', status: 'failed' }), bt({ id: 'BT-2' })], 12)?.id).toBe('BT-2')
  })
})

describe('stoppedShown', () => {
  it('says when HQ sent only the first of the stopped requests', () => {
    const rows = Array.from({ length: 500 }, () => ({ on: '2026-10-01', store: 'P001', item: '100101', maskedKey: '1*******01', sar: 1, rules: ['G-007'] }))
    expect(stoppedShown(bt({ stopped: rows, stoppedTotal: 1830 }))).toEqual({ shown: 500, total: 1830, truncated: true })
    expect(stoppedShown(bt({ stopped: rows.slice(0, 3), stoppedTotal: 3 }))).toEqual({ shown: 3, total: 3, truncated: false })
  })
})

describe('maskedKey', () => {
  it('keeps a key HQ already masked as it came (first digit and the last two)', () => {
    expect(maskedKey('1*******01')).toBe('1*******01')
  })

  it('masks a whole National ID / Iqama that slipped through as HQ does: the first digit and the last two', () => {
    expect(maskedKey('1023456783')).toBe('1*******83')
    expect(maskedKey('2412345619')).toBe('2*******19')
  })

  it('never shows an empty or short key as data', () => {
    expect(maskedKey('')).toBe('')
    expect(maskedKey('123')).toBe('***')
  })
})
