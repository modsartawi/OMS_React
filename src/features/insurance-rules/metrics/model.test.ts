/**
 * Ticket 615 — the insurance team's metrics, flags and rejection report (BackOffice 3141), read by pure
 * functions: rejections ranked by SAR with the gap (no live guard) marked, the metrics' totals, the outcome
 * mix as shares, and each flag's reason built from its numbers.
 */
import { describe, expect, it } from 'vitest'
import { flagReason, metricsTotals, outcomeShares, rankRejections, sortMetricsRows, type MetricsRow, type RejectionRow } from './model'

const rej = (o: Partial<RejectionRow>): RejectionRow => ({ code: null, words: null, payer: 'BUPA', sameKind: 'E1497', count: 1, sar: 0, liveGuard: false, ...o })

describe('rankRejections', () => {
  it('rankedBySar_thenCount_thenCode', () => {
    const ranked = rankRejections([
      rej({ code: 'CV-4-8', sar: 100, count: 3 }),
      rej({ code: 'BE-1-4', sar: 900, count: 1 }),
      rej({ code: 'AD-1-4', sar: 100, count: 7 }),
      rej({ code: 'AA-0-1', sar: 100, count: 7 }),
    ])
    expect(ranked.map((r) => [r.rank, r.row.code])).toEqual([
      [1, 'BE-1-4'],
      [2, 'AA-0-1'],
      [3, 'AD-1-4'],
      [4, 'CV-4-8'],
    ])
  })

  it('shareOfTheTopSar_drawsTheBar', () => {
    const ranked = rankRejections([rej({ code: 'A', sar: 250 }), rej({ code: 'B', sar: 1000 }), rej({ code: 'C', sar: 0 })])
    expect(ranked.map((r) => r.share)).toEqual([1, 0.25, 0])
  })

  it('totals_andTheSarWithNoLiveGuard', () => {
    const ranked = rankRejections([rej({ sar: 300, count: 2, liveGuard: true }), rej({ sar: 200, count: 5 }), rej({ sar: 50, count: 1 })])
    expect(ranked.totals).toEqual({ count: 8, sar: 550, unguardedSar: 250, unguardedRows: 2 })
  })

  it('nothing ranks nothing', () => {
    const ranked = rankRejections([])
    expect([...ranked]).toEqual([])
    expect(ranked.totals).toEqual({ count: 0, sar: 0, unguardedSar: 0, unguardedRows: 0 })
  })
})

const row = (o: Partial<MetricsRow>): MetricsRow => ({
  key: 'G-001',
  name: null,
  fires: { refuse: 0, override: 0, warn: 0 },
  shadowFires: 0,
  outcomes: { removed: 0, changed: 0, overridden: 0, acknowledged: 0, exception: 0 },
  overrideRate: null,
  sarProtectedEstimate: 0,
  rejectionsAfterPass: 0,
  timeAddedMedianMs: null,
  ...o,
})

describe('metricsTotals', () => {
  it('sumsFiresShadowSarAndRejections_andWeighsTheOverrideRateByOverrideFires', () => {
    const totals = metricsTotals([
      row({ fires: { refuse: 4, override: 10, warn: 6 }, shadowFires: 3, overrideRate: 0.9, sarProtectedEstimate: 1200.5, rejectionsAfterPass: 2 }),
      row({ fires: { refuse: 1, override: 30, warn: 0 }, shadowFires: 0, overrideRate: 0.5, sarProtectedEstimate: 99.5, rejectionsAfterPass: 1 }),
      row({ fires: { refuse: 0, override: 0, warn: 5 }, overrideRate: null }),
    ])
    // (0.9·10 + 0.5·30) / 40 = 24 / 40
    expect(totals).toEqual({ fires: 56, bySeverity: { refuse: 5, override: 40, warn: 11 }, shadowFires: 3, overrideRate: 0.6, sarProtectedEstimate: 1300, rejectionsAfterPass: 3 })
  })

  it('noOverrideFire_hasNoRate', () => {
    expect(metricsTotals([row({ fires: { refuse: 2, override: 0, warn: 0 } })]).overrideRate).toBeNull()
  })
})

describe('outcomeShares', () => {
  it('eachOutcomeAsAShareOfTheirSum_inAFixedOrder', () => {
    expect(outcomeShares({ removed: 1, changed: 1, overridden: 6, acknowledged: 2, exception: 0 })).toEqual([
      { outcome: 'removed', count: 1, share: 0.1 },
      { outcome: 'changed', count: 1, share: 0.1 },
      { outcome: 'overridden', count: 6, share: 0.6 },
      { outcome: 'acknowledged', count: 2, share: 0.2 },
      { outcome: 'exception', count: 0, share: 0 },
    ])
  })

  it('noOutcome_isEmpty', () => {
    expect(outcomeShares({ removed: 0, changed: 0, overridden: 0, acknowledged: 0, exception: 0 })).toEqual([])
  })
})

describe('flagReason', () => {
  const name = { en: 'x', ar: 'y' }
  it('noisy_namesOverriddenOfFiresAndTheRate', () => {
    expect(flagReason({ ruleId: 'G-002', name, kind: 'noisy', since: '2026-10-20', fires: 40, overridden: 36, previousAverage: null, lastFired: '2026-10-27T09:05:00' })).toEqual({
      key: 'reason.noisy',
      values: { overridden: 36, fires: 40, pct: 90 },
    })
  })
  it('silent_namesTheLastFireOrNever', () => {
    expect(flagReason({ ruleId: 'G-004', name, kind: 'silent', since: '2026-10-01', fires: 0, overridden: 0, previousAverage: null, lastFired: '2026-07-30T10:00:00' })).toEqual({
      key: 'reason.silent',
      values: { lastFired: '2026-07-30' },
    })
    expect(flagReason({ ruleId: 'G-004', name, kind: 'silent', since: '2026-10-01', fires: 0, overridden: 0, previousAverage: null, lastFired: null })).toEqual({ key: 'reason.silentNever', values: {} })
  })
  it('jump_namesFiresAgainstThePreviousAverage_andTheFactor', () => {
    expect(flagReason({ ruleId: 'G-003', name, kind: 'jump', since: '2026-10-25', fires: 240, overridden: 0, previousAverage: 16, lastFired: null })).toEqual({
      key: 'reason.jump',
      values: { fires: 240, previous: 16, factor: 15 },
    })
  })
  it('jump_fromNothing_hasNoFactor', () => {
    expect(flagReason({ ruleId: 'G-003', name, kind: 'jump', since: '2026-10-25', fires: 12, overridden: 0, previousAverage: 0, lastFired: null })).toEqual({ key: 'reason.jumpFromNone', values: { fires: 12 } })
  })
})

describe('sortMetricsRows', () => {
  it('byDay_inCalendarOrder_elseMostFiresFirst_thenKey', () => {
    const rows = [
      row({ key: '2026-10-03', fires: { refuse: 9, override: 0, warn: 0 } }),
      row({ key: '2026-10-01', fires: { refuse: 1, override: 0, warn: 0 } }),
      row({ key: '2026-10-02', fires: { refuse: 1, override: 0, warn: 0 } }),
    ]
    expect(sortMetricsRows(rows, 'day').map((r) => r.key)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    const stores = [row({ key: 'P019', fires: { refuse: 1, override: 1, warn: 0 } }), row({ key: 'P001', fires: { refuse: 0, override: 0, warn: 5 } }), row({ key: 'P002', fires: { refuse: 2, override: 0, warn: 0 } })]
    expect(sortMetricsRows(stores, 'store').map((r) => r.key)).toEqual(['P001', 'P002', 'P019'])
  })
})
