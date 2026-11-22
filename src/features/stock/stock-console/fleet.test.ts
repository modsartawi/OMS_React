import { describe, expect, it } from 'vitest'
import type { StockConsoleFleet, StockConsoleFleetProblem } from '@/core/models/stock-console'
import { FLEET_FACTS, factView, feedLabel, fleetLine } from './fleet'

/** `GET StockConsole/Fleet` as SIS.Api answers it (BO 4160, `StockConsoleFleetAnswer`): every fact answered and well. */
const answered: StockConsoleFleet = {
  readAt: '2026-11-22T10:00:00',
  feeds: {
    answered: true,
    noAnswer: null,
    rows: [
      { feed: 'SapFeed', name: 'SAP feed', lastCompletePassAt: '2026-11-22T09:58:00', ageMinutes: 2, limitMinutes: 60, late: false },
      { feed: 'PosFeed', name: 'POS feed', lastCompletePassAt: '2026-11-22T09:51:00', ageMinutes: 9, limitMinutes: 30, late: false },
    ],
  },
  reserved: {
    answered: true,
    noAnswer: null,
    state: 'Computed',
    limitMinutes: 15,
    lastStartedAt: '2026-11-22T09:55:00',
    lastSuccessAt: '2026-11-22T09:56:00',
    lastComputedAt: '2026-11-22T09:56:00',
    lastDurationMs: 4200,
    lastDocuments: 10,
    lastPairs: 900,
    lastChangedPairs: 12,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastError: null,
    lastNetting: 'All',
    fellBackAt: null,
  },
  heldServed: {
    answered: true,
    noAnswer: null,
    served: true,
    changedAt: '2026-11-20T08:00:00',
    netting: 'All',
    fellBackAt: null,
    lastNetting: 'All',
    subtractsHeld: true,
  },
  reader: {
    answered: true,
    noAnswer: null,
    lastPassAt: '2026-11-22T09:59:30',
    lagMinutes: 0.1,
    limitMinutes: 10,
    behind: false,
    readThroughAt: '2026-11-22T09:59:26',
    rowsApplied: 1000,
    unmatchedRows: 0,
  },
  takes: {
    answered: true,
    noAnswer: null,
    day: '2026-11-22T00:00:00+03:00',
    takes: 1200,
    withinLimit: 1190,
    shareWithinLimit: 0.99,
    failed: 12,
    failedPerThousand: 10,
    rejected: 3,
    limitMilliseconds: 800,
    outages: [],
  },
  problems: [],
}

/** A status route that gave no answer: `answered` false, every other field its default. */
const silent = (fact: (typeof FLEET_FACTS)[number]): StockConsoleFleet => ({
  ...answered,
  [fact]: { ...answered[fact], answered: false, noAnswer: `Stock Visibility's route gave no answer: timeout` },
})

describe('a fleet fact', () => {
  it('the five facts of Feeds and switches, in the page’s order', () => {
    expect(FLEET_FACTS).toEqual(['feeds', 'reserved', 'heldServed', 'reader', 'takes'])
  })

  it('answered and well is answered', () => {
    expect(FLEET_FACTS.map((f) => factView(answered, f))).toEqual(['answered', 'answered', 'answered', 'answered', 'answered'])
  })

  it('with no answer is drawn as no answer — never as healthy, whatever its default fields say', () => {
    for (const fact of FLEET_FACTS) expect([fact, factView(silent(fact), fact)]).toEqual([fact, 'noAnswer'])
  })

  it('no answer for one fact leaves the others answered', () => {
    expect(FLEET_FACTS.map((f) => factView(silent('reader'), f))).toEqual(['answered', 'answered', 'answered', 'noAnswer', 'answered'])
  })

  it('a feed the server judges late is a problem', () => {
    const rows = [{ ...answered.feeds.rows[0], late: true }]
    expect(factView({ ...answered, feeds: { ...answered.feeds, rows } }, 'feeds')).toBe('problem')
  })

  it('a recompute the server judges stale or never run, or one that keeps failing, is a problem', () => {
    // Stale is the server's judgement (15 minutes outside the quiet window, a SIS.Api setting): the page does not re-time it.
    expect(factView({ ...answered, reserved: { ...answered.reserved, state: 'Stale' } }, 'reserved')).toBe('problem')
    expect(factView({ ...answered, reserved: { ...answered.reserved, state: 'NeverComputed' } }, 'reserved')).toBe('problem')
    expect(factView({ ...answered, reserved: { ...answered.reserved, consecutiveFailures: 3 } }, 'reserved')).toBe('problem')
  })

  it('a reader the server judges behind is a problem', () => {
    expect(factView({ ...answered, reader: { ...answered.reader, behind: true } }, 'reader')).toBe('problem')
  })

  it('the held-served switch is a problem when it fell back, or is on without held subtracted', () => {
    const fell = { ...answered.heldServed, fellBackAt: '2026-11-22T06:00:00', subtractsHeld: false }
    expect(factView({ ...answered, heldServed: fell }, 'heldServed')).toBe('problem')
    expect(factView({ ...answered, heldServed: { ...answered.heldServed, subtractsHeld: false } }, 'heldServed')).toBe('problem')
    // Off on purpose is not a problem: it subtracts nothing because it was asked not to.
    expect(factView({ ...answered, heldServed: { ...answered.heldServed, served: false, subtractsHeld: false } }, 'heldServed')).toBe(
      'answered',
    )
  })
})

describe('a feed’s name', () => {
  it('Stock Visibility’s feeds in words; another feed as it came', () => {
    expect(feedLabel('SapFeed')).toEqual({ key: 'fleet.feed.SapFeed' })
    expect(feedLabel('PosFeed')).toEqual({ key: 'fleet.feed.PosFeed' })
    expect(feedLabel('HoldLedgerReader')).toEqual({ key: 'fleet.feed.HoldLedgerReader' })
    expect(feedLabel('SapCount')).toEqual({ key: 'fleet.feed.SapCount' })
    expect(feedLabel('Drs')).toEqual({ raw: 'Drs' })
  })
})

describe('the fleet line above the stores list', () => {
  const problem = (over: Partial<StockConsoleFleetProblem>): StockConsoleFleetProblem => ({
    code: 'FeedLate',
    subject: 'PosFeed',
    value: 42,
    limit: 30,
    ...over,
  })

  it('nothing to say when no fleet fact is a problem', () => {
    expect(fleetLine([])).toEqual([])
  })

  it('each problem in its own sentence, with what it measured, in minutes', () => {
    expect(
      fleetLine([problem({}), problem({ code: 'ReservedNeverRun', subject: 'ReservedRecompute', value: null, limit: 15 })]),
    ).toEqual([
      { code: 'FeedLate', key: 'fleetLine.FeedLate', subject: { key: 'fleet.feed.PosFeed' }, value: 42, limit: 30 },
      { code: 'ReservedNeverRun', key: 'fleetLine.ReservedNeverRun', subject: { raw: 'ReservedRecompute' }, value: null, limit: 15 },
    ])
  })

  it('a status route that gave no answer is said, by the route — not hidden', () => {
    expect(fleetLine([problem({ code: 'NoAnswer', subject: 'Stock/FeedStatus', value: null, limit: null })])).toEqual([
      { code: 'NoAnswer', key: 'fleetLine.NoAnswer', subject: { raw: 'Stock/FeedStatus' }, value: null, limit: null },
    ])
  })

  it('a code the console does not know still shows, by its name', () => {
    expect(fleetLine([problem({ code: 'MoonPhase' })])[0].key).toBe('fleetLine.unknown')
  })
})
