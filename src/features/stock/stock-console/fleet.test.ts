import { describe, expect, it } from 'vitest'
import type { StockConsoleFleet } from '@/core/models/stock-console'
import { FLEET_FACTS, factView, feedLabel, fleetLine } from './fleet'

const answered: StockConsoleFleet = {
  readAt: '2026-11-22T10:00:00',
  feeds: [
    { feed: 'Sap', lastCompletePassAt: '2026-11-22T09:58:00', ageSeconds: 120 },
    { feed: 'Pos', lastCompletePassAt: '2026-11-22T09:51:00', ageSeconds: 540 },
  ],
  reservedRun: {
    lastStartedAt: '2026-11-22T09:55:00',
    lastSuccessAt: '2026-11-22T09:56:00',
    lastFailureAt: null,
    consecutiveFailures: 0,
    lastError: null,
    lastNetting: 'HeldServed',
  },
  heldServed: { served: true, changedAt: '2026-11-20T08:00:00', netting: 'HeldServed', subtractsHeld: true, fellBackAt: null },
  ledgerReader: { lastPassAt: '2026-11-22T09:59:30', lagSeconds: 4, readThroughAt: '2026-11-22T09:59:26' },
  takesToday: { day: '2026-11-22', takes: 1200, failed: 12, skipped: 0 },
  problems: [],
}

const silent: StockConsoleFleet = {
  readAt: '2026-11-22T10:00:00',
  feeds: null,
  reservedRun: null,
  heldServed: null,
  ledgerReader: null,
  takesToday: null,
  problems: [],
}

const problem = (fact: string) => ({ fact, subject: null, value: null, limit: null, since: null })

describe('a fleet fact', () => {
  it('the five facts of Feeds and switches, in the page’s order', () => {
    expect(FLEET_FACTS).toEqual(['feeds', 'reservedRun', 'heldServed', 'ledgerReader', 'takesToday'])
  })

  it('with no answer is drawn as no answer — never as healthy', () => {
    for (const fact of FLEET_FACTS) expect([fact, factView(silent, fact)]).toEqual([fact, 'noAnswer'])
  })

  it('a key missing from the answer altogether is no answer too', () => {
    const older = { readAt: '2026-11-22T10:00:00' } as StockConsoleFleet
    for (const fact of FLEET_FACTS) expect([fact, factView(older, fact)]).toEqual([fact, 'noAnswer'])
  })

  it('no answer for one fact leaves the others answered', () => {
    const one = { ...answered, ledgerReader: null }
    expect(FLEET_FACTS.map((f) => factView(one, f))).toEqual(['answered', 'answered', 'answered', 'noAnswer', 'answered'])
  })

  it('an empty list of feeds is no answer, not "every feed is fine"', () => {
    expect(factView({ ...answered, feeds: [] }, 'feeds')).toBe('noAnswer')
  })

  it('a feed that never passed, a recompute that never succeeded or keeps failing, and a reader that never passed are a problem', () => {
    expect(factView({ ...answered, feeds: [{ feed: 'Pos', lastCompletePassAt: null, ageSeconds: null }] }, 'feeds')).toBe('problem')
    expect(factView({ ...answered, reservedRun: { ...answered.reservedRun!, lastSuccessAt: null } }, 'reservedRun')).toBe('problem')
    expect(factView({ ...answered, reservedRun: { ...answered.reservedRun!, consecutiveFailures: 3 } }, 'reservedRun')).toBe('problem')
    expect(factView({ ...answered, ledgerReader: { ...answered.ledgerReader!, lastPassAt: null } }, 'ledgerReader')).toBe('problem')
  })

  it('a recompute the server judges stale or never run, and a reader it judges behind, are a problem', () => {
    // Stale is the server's judgement (15 minutes outside the quiet window, a SIS.Api setting): the page does not re-time it.
    expect(factView({ ...answered, problems: [problem('ReservedStale')] }, 'reservedRun')).toBe('problem')
    expect(factView({ ...answered, problems: [problem('ReservedNeverRun')] }, 'reservedRun')).toBe('problem')
    expect(factView({ ...answered, problems: [problem('ReaderBehind')] }, 'ledgerReader')).toBe('problem')
    expect(factView({ ...answered, problems: [problem('FeedLate')] }, 'feeds')).toBe('problem')
    expect(factView({ ...answered, problems: [problem('TakesFailing')] }, 'takesToday')).toBe('problem')
    // A problem of one fact leaves the others as they are.
    expect(factView({ ...answered, problems: [problem('ReaderBehind')] }, 'reservedRun')).toBe('answered')
  })

  it('the held-served switch is a problem when it fell back, or is on without held subtracted', () => {
    const fell = { ...answered.heldServed!, fellBackAt: '2026-11-22T06:00:00', subtractsHeld: false }
    expect(factView({ ...answered, heldServed: fell }, 'heldServed')).toBe('problem')
    expect(factView({ ...answered, heldServed: { ...answered.heldServed!, subtractsHeld: false } }, 'heldServed')).toBe('problem')
    expect(factView({ ...answered, problems: [problem('HeldServedFellBack')] }, 'heldServed')).toBe('problem')
    // Off on purpose is not a problem: it subtracts nothing because it was asked not to.
    expect(factView({ ...answered, heldServed: { ...answered.heldServed!, served: false, subtractsHeld: false } }, 'heldServed')).toBe(
      'answered',
    )
  })

  it('a problem the server judges for a fact with no answer is still no answer — never drawn as a judged fact', () => {
    expect(factView({ ...silent, problems: [problem('ReaderBehind')] }, 'ledgerReader')).toBe('noAnswer')
  })
})

describe('a feed’s name', () => {
  it('SAP and the till in words; another feed as it came', () => {
    expect(feedLabel('Sap')).toEqual({ key: 'fleet.feed.Sap' })
    expect(feedLabel('Pos')).toEqual({ key: 'fleet.feed.Pos' })
    expect(feedLabel('Drs')).toEqual({ raw: 'Drs' })
  })
})

describe('the fleet line above the stores list', () => {
  it('nothing to say when no fleet fact is a problem', () => {
    expect(fleetLine([])).toEqual([])
  })

  it('each problem in its own sentence, with what it measured and its time', () => {
    expect(
      fleetLine([
        { fact: 'FeedLate', subject: 'Pos', value: 42, limit: 30, since: '2026-11-22T09:18:00' },
        { fact: 'ReservedNeverRun', subject: null, value: null, limit: null, since: null },
      ]),
    ).toEqual([
      { fact: 'FeedLate', key: 'fleetLine.FeedLate', subject: { key: 'fleet.feed.Pos' }, value: 42, limit: 30, since: '2026-11-22T09:18:00' },
      { fact: 'ReservedNeverRun', key: 'fleetLine.ReservedNeverRun', subject: null, value: null, limit: null, since: null },
    ])
  })

  it('the held-served switch falling back has its own sentence', () => {
    expect(fleetLine([problem('HeldServedFellBack')])[0].key).toBe('fleetLine.HeldServedFellBack')
  })

  it('a fact the console does not know still shows, by its name', () => {
    expect(fleetLine([{ fact: 'MoonPhase', subject: null, value: 3, limit: null, since: null }])[0].key).toBe('fleetLine.unknown')
  })
})
