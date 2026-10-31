/**
 * Ticket 612 — a back-test of the guard draft (`GET InsuranceRules/Guards/Backtests/{id}`, door 3140): whether it is
 * still running, how far it got, whether it is the CURRENT revision's (611's Submit gate), its fires, and a patient
 * key that is never shown whole.
 */
import { describe, expect, it } from 'vitest'
import { backtestKinds, backtestWindowLimit, cappedBacktestDays, draftHoldsMonitors, monitorBacktestReading, offeredBacktestDays, backtestFires, backtestIsCurrent, backtestProgressPct, backtestRunning, draftBacktest, maskedKey, stoppedShown, type GuardBacktest, type MonitorBacktest } from './backtest'

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

describe('the back-test read per kind (oms 700)', () => {
  const monitors: MonitorBacktest = {
    answers: 800,
    raisedOn: 2,
    raised: { action: 3, info: 1 },
    items: [
      { on: '2026-10-26', message: { source: 'nphies', id: 'ANS-1' }, maskedKey: '1*******83', rules: ['M-001'] },
      { on: '2026-10-25', message: { source: 'nphies', id: 'ANS-2' }, maskedKey: '1198765408', rules: ['M-001', 'M-002'] },
    ],
    itemsTotal: 40,
    rules: [{ ruleId: 'M-001', raised: 3 }],
  }

  it('a guard’s reading is unchanged: no monitor section is the guard report alone', () => {
    expect(backtestKinds(bt())).toEqual(['guard'])
    expect(backtestKinds(bt({ monitors: null }))).toEqual(['guard'])
    expect(backtestKinds(bt({ requests: 0, lines: 0 }))).toEqual(['guard'])
    expect(backtestFires(bt())).toEqual({ rows: [['REFUSE', 4], ['OVERRIDE', 30], ['WARN', 6]], total: 40 })
  })

  it('a draft with guards and monitors reads as both, and monitors alone never as refusals on sales', () => {
    expect(backtestKinds(bt({ monitors }))).toEqual(['guard', 'monitor'])
    expect(backtestKinds(bt({ monitors, requests: 0, lines: 0 }))).toEqual(['monitor'])
  })

  it('a monitor reads as review items raised, heaviest first, on which answers, keys masked', () => {
    expect(monitorBacktestReading(monitors)).toEqual({
      rows: [['action', 3], ['info', 1]],
      total: 4,
      answers: 800,
      raisedOn: 2,
      items: [
        { on: '2026-10-26', message: { source: 'nphies', id: 'ANS-1' }, maskedKey: '1*******83', rules: ['M-001'] },
        { on: '2026-10-25', message: { source: 'nphies', id: 'ANS-2' }, maskedKey: '1*******08', rules: ['M-001', 'M-002'] },
      ],
      shown: 2,
      itemsTotal: 40,
      truncated: true,
      rules: [{ ruleId: 'M-001', raised: 3 }],
    })
  })

  it('a thin reply reads as nothing raised', () => {
    expect(monitorBacktestReading({} as MonitorBacktest)).toEqual({ rows: [['action', 0], ['info', 0]], total: 0, answers: 0, raisedOn: 0, items: [], shown: 0, itemsTotal: 0, truncated: false, rules: [] })
  })

  it('a draft holds a monitor only while one still runs', () => {
    const guard = { kind: undefined, state: 'draft' as const }
    const monitor = { kind: 'monitor' as const, state: 'draft' as const }
    const off = { kind: 'monitor' as const, state: 'disabled' as const }
    expect(draftHoldsMonitors([guard])).toBe(false)
    expect(draftHoldsMonitors([guard, off])).toBe(false)
    expect(draftHoldsMonitors([guard, monitor])).toBe(true)
  })
})

describe('the back-test window, capped by retention (door 3298: the shortest setting it reads, minus 30 days)', () => {
  it('offers only the windows inside the limit', () => {
    expect(offeredBacktestDays(180)).toEqual([30, 90, 180])
    expect(offeredBacktestDays(179)).toEqual([30, 90])
    expect(offeredBacktestDays(90)).toEqual([30, 90])
    expect(offeredBacktestDays(30)).toEqual([30])
    expect(offeredBacktestDays(29)).toEqual([])
  })

  it('a window from the address past the limit falls to the longest offered, and to none when none fits', () => {
    expect(cappedBacktestDays(180, 180)).toBe(180)
    expect(cappedBacktestDays(180, 120)).toBe(90)
    expect(cappedBacktestDays(30, 120)).toBe(30)
    expect(cappedBacktestDays(30, 15)).toBeNull()
  })

  it('an unreadable limit offers nothing, never everything', () => {
    expect(backtestWindowLimit({ days: [7, 30, 180] })).toBe(180)
    expect(backtestWindowLimit({ days: [90.5] })).toBe(90)
    for (const bad of [null, undefined, [], {}, { maxDays: 'x' }, { maxDays: -5 }, { maxDays: Number.NaN }]) expect(backtestWindowLimit(bad)).toBe(0)
  })
})
