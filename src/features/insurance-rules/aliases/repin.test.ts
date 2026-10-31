/**
 * Ticket 705 — a published rule changes what it reads only through a draft someone else approved after seeing the
 * difference. The summary says which decisions would change and how, including none at all.
 */
import { describe, expect, it } from 'vitest'
import { labelPairs, repinStanding, repinSummary, type RepinBacktest, type RepinBacktestChange, type RepinDraft } from './repin'

const change = (over: Partial<RepinBacktestChange> = {}): RepinBacktestChange => ({
  bundleId: 'B-1',
  on: '2026-10-12',
  payer: '0001100041',
  ruleId: 'R-1',
  maskedKey: '1*******01',
  before: 'PASS',
  after: 'REFUSE',
  ...over,
})
const backtest = (over: Partial<RepinBacktest> = {}): RepinBacktest => ({
  status: 'done',
  error: null,
  bundles: 120,
  changedTotal: 0,
  changes: [],
  ...over,
})
const draft = (over: Partial<RepinDraft> = {}): RepinDraft => ({
  id: 'D-1',
  kind: 'alias',
  rulesetId: 'guards',
  rulesetName: 'Guards',
  rulesetVersion: 7,
  subject: '0001100041 · http://unitsofmeasure.org/ucum',
  before: null,
  after: 'http://unitsofmeasure.org',
  state: 'open',
  createdBy: 'nalharbi',
  createdAt: '2026-10-30T09:00:00',
  approvedBy: null,
  approvedAt: null,
  backtest: backtest(),
  ...over,
})

describe('repinSummary', () => {
  it('zero changes is said as zero, every bundle the same', () => {
    expect(repinSummary(backtest())).toEqual({ bundles: 120, changed: 0, unchanged: 120, moves: [], shown: 0, truncated: false })
  })
  it('groups the changes by how the decision moved, the most common first', () => {
    const s = repinSummary(
      backtest({
        changedTotal: 3,
        changes: [change(), change({ bundleId: 'B-2', before: 'WARN', after: 'PASS' }), change({ bundleId: 'B-3' })],
      }),
    )
    expect(s.moves).toEqual([
      { from: 'PASS', to: 'REFUSE', count: 2 },
      { from: 'WARN', to: 'PASS', count: 1 },
    ])
    expect(s).toMatchObject({ bundles: 120, changed: 3, unchanged: 117, shown: 3, truncated: false })
  })
  it('a line whose decision did not move is not a change, whatever the door counted', () => {
    const s = repinSummary(backtest({ changedTotal: 1, changes: [change({ before: 'WARN', after: 'WARN' })] }))
    expect(s).toEqual({ bundles: 120, changed: 0, unchanged: 120, moves: [], shown: 0, truncated: false })
  })
  it('HQ sends the first lines only: the total comes from HQ and the summary says it is partial', () => {
    const s = repinSummary(backtest({ changedTotal: 900, bundles: 1000, changes: [change()] }))
    expect(s).toMatchObject({ changed: 900, unchanged: 100, shown: 1, truncated: true })
  })
  it('never counts below zero unchanged when the figures disagree', () => {
    expect(repinSummary(backtest({ bundles: 1, changedTotal: 5, changes: [] })).unchanged).toBe(0)
  })
})

describe('labelPairs', () => {
  const says = (en: string, ar: string) => ({ en, ar })
  it('one pair per language that moved, in rule order, English first', () => {
    expect(
      labelPairs([
        { ruleId: 'G-1', before: says('Dental (12)', 'الأسنان (12)'), after: says('Dental care (12)', 'عناية الأسنان (12)') },
        { ruleId: 'G-2', before: says('Optical (44)', ''), after: says('Optical (44)', 'البصريات (44)') },
      ]),
    ).toEqual([
      { ruleId: 'G-1', lang: 'en', before: 'Dental (12)', after: 'Dental care (12)' },
      { ruleId: 'G-1', lang: 'ar', before: 'الأسنان (12)', after: 'عناية الأسنان (12)' },
      { ruleId: 'G-2', lang: 'ar', before: '', after: 'البصريات (44)' },
    ])
  })
  it('text that did not move is no pair, and nothing moved is no pairs', () => {
    expect(labelPairs([{ ruleId: 'G-1', before: says('Same', 'نفسه'), after: says('Same', 'نفسه') }])).toEqual([])
    expect(labelPairs(null)).toEqual([])
    expect(labelPairs(undefined)).toEqual([])
  })
})

describe('repinStanding', () => {
  it('a labels-only draft demands no back-test: another user may approve it without one', () => {
    expect(repinStanding(draft({ kind: 'labels', backtest: null }), 'falotaibi')).toBe('may')
  })
  it('a labels-only draft is still not its author to approve', () => {
    expect(repinStanding(draft({ kind: 'labels', backtest: null }), 'NALHARBI')).toBe('ownDraft')
  })
  it('a path or alias draft still demands one', () => {
    expect(repinStanding(draft({ kind: 'path', backtest: null }), 'falotaibi')).toBe('noBacktest')
  })
  it('another user may approve once the back-test is done, zero changes included', () => {
    expect(repinStanding(draft(), 'falotaibi')).toBe('may')
  })
  it('the author may not, whatever the case of their id', () => {
    expect(repinStanding(draft(), 'NALHARBI')).toBe('ownDraft')
  })
  it('with no known user or author it reads as their own', () => {
    expect(repinStanding(draft(), null)).toBe('ownDraft')
    expect(repinStanding(draft({ createdBy: null }), 'falotaibi')).toBe('ownDraft')
  })
  it('no one approves before seeing the difference: running, failed or missing', () => {
    for (const bt of [backtest({ status: 'running' }), backtest({ status: 'failed', error: 'x' }), null]) {
      expect(repinStanding(draft({ backtest: bt }), 'falotaibi')).toBe('noBacktest')
    }
  })
  it('an approved draft offers nothing', () => {
    expect(repinStanding(draft({ state: 'approved' }), 'falotaibi')).toBe('none')
  })
})
