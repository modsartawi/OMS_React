import { describe, expect, it } from 'vitest'
import type { StoreCountRow, StoreGate, StoreGates, StoreSeedStatus, StoreStage } from '@/core/models/store-stage'
import {
  STAGES_DEFAULTS,
  WHY_MAX,
  blockingCheck,
  figureLines,
  gatesApart,
  moveRequest,
  canAskCountClosed,
  cancelCommit,
  countOf,
  countState,
  localDay,
  moveCommit,
  personMovesFrom,
  releaseCommit,
  seedView,
  stageRow,
  startCommit,
  stagesFiltersFromParams,
  stagesFiltersToParams,
  stagesShown,
} from './stages'

const stage = (store: string, s: string, lastMove: StoreStage['lastMove'] = null): StoreStage => ({
  store,
  stage: s,
  updatedAt: null,
  lastMove,
})

describe('the moves a person may ask for (SIS.Stock 064)', () => {
  it('any stage goes back to Shadow, Seeded to Blocking and Blocking back to Seeded; nobody writes Seeding or Seeded by hand', () => {
    expect(personMovesFrom('Shadow')).toEqual([])
    expect(personMovesFrom('Seeding')).toEqual(['Shadow'])
    expect(personMovesFrom('Seeded')).toEqual(['Shadow', 'Blocking'])
    expect(personMovesFrom('Blocking')).toEqual(['Shadow', 'Seeded'])
  })

  it('a stage this screen does not know can still be put back to Shadow', () => {
    expect(personMovesFrom('Paused')).toEqual(['Shadow'])
  })
})

describe('the move commit', () => {
  it('needs a stage the store may move to and a reason', () => {
    expect(moveCommit({ from: 'Blocking', to: 'Seeded', why: 'Back a step', pending: false }).canCommit).toBe(true)
    expect(moveCommit({ from: 'Seeded', to: '', why: 'x', pending: false }).canCommit).toBe(false)
    expect(moveCommit({ from: 'Seeded', to: 'Blocking', why: '   ', pending: false }).canCommit).toBe(false)
    expect(moveCommit({ from: 'Shadow', to: 'Seeded', why: 'x', pending: false }).canCommit).toBe(false)
    expect(moveCommit({ from: 'Seeded', to: 'Blocking', why: 'x', pending: true }).canCommit).toBe(false)
  })

  it('refuses a reason longer than SIS.Stock keeps (500)', () => {
    expect(WHY_MAX).toBe(500)
    expect(moveCommit({ from: 'Seeded', to: 'Shadow', why: 'a'.repeat(501), pending: false })).toEqual({
      canCommit: false,
      tooLong: true,
    })
  })
})

describe('the filters and rows', () => {
  it('round-trip the URL, upper-casing the store and dropping an unknown stage', () => {
    const f = stagesFiltersFromParams(new URLSearchParams('store=p88&stage=Seeded&open=p883'))
    expect(f).toEqual({ store: 'P88', stage: 'Seeded', open: 'P883' })
    expect(stagesFiltersToParams(f).toString()).toBe('store=P88&stage=Seeded&open=P883')
    expect(stagesFiltersFromParams(new URLSearchParams('stage=Nope'))).toEqual(STAGES_DEFAULTS)
  })

  it('narrow by store prefix and stage', () => {
    const all = [stage('P883', 'Seeded'), stage('P884', 'Shadow'), stage('Q100', 'Seeded')]
    expect(stagesShown(all, { store: 'P88', stage: '', open: '' }).map((s) => s.store)).toEqual(['P883', 'P884'])
    expect(stagesShown(all, { store: '', stage: 'Seeded', open: '' }).map((s) => s.store)).toEqual(['P883', 'Q100'])
  })

  it('a row carries the last move, blank for a store never moved', () => {
    expect(
      stageRow(
        stage('P883', 'Shadow', {
          store: 'P883',
          from: 'Blocking',
          to: 'Shadow',
          mover: 'Person',
          who: 'u.stockctl',
          why: 'Dead link',
          movedAt: '2026-11-14T10:05:00',
        }),
      ),
    ).toEqual({
      store: 'P883',
      stage: 'Shadow',
      lastFrom: 'Blocking',
      lastMover: 'Person',
      lastWho: 'u.stockctl',
      lastWhy: 'Dead link',
      lastMovedAt: '2026-11-14T10:05:00',
    })
    expect(stageRow(stage('P884', 'Shadow'))).toEqual({
      store: 'P884',
      stage: 'Shadow',
      lastFrom: '',
      lastMover: '',
      lastWho: '',
      lastWhy: '',
      lastMovedAt: '',
    })
  })
})

describe('the count closing (BackOffice 3898)', () => {
  const row = (isCountClosed: boolean): StoreCountRow => ({
    storeCode: 'P883 ',
    inventoryDate: '2026-11-10T00:00:00',
    isCountClosed,
    countClosedAt: isCountClosed ? '2026-11-14T00:55:00' : '0001-01-01T00:00:00',
    countClosedBy: isCountClosed ? 'u.invctl' : '',
  })

  it('finds the count row of a store and its state', () => {
    expect(countOf([row(false)], 'p883')?.inventoryDate).toBe('2026-11-10T00:00:00')
    expect(countOf([row(false)], 'P884')).toBeNull()
    expect(countState(null)).toBe('none')
    expect(countState(row(false))).toBe('open')
    expect(countState(row(true))).toBe('closed')
  })

  it('offers "count closed" on a store under count, to a holder of the grant, again after a refused seed', () => {
    expect(canAskCountClosed(row(false), true, false)).toBe(true)
    expect(canAskCountClosed(row(true), true, false)).toBe(true)
    expect(canAskCountClosed(null, true, false)).toBe(false)
    expect(canAskCountClosed(row(false), false, false)).toBe(false)
    expect(canAskCountClosed(row(false), true, true)).toBe(false)
  })

  it('releases by hand only a closed count, with a reason the log keeps', () => {
    expect(releaseCommit({ row: row(true), why: 'Seed refused twice', pending: false }).canCommit).toBe(true)
    expect(releaseCommit({ row: row(false), why: 'x', pending: false }).canCommit).toBe(false)
    expect(releaseCommit({ row: row(true), why: '  ', pending: false }).canCommit).toBe(false)
    expect(releaseCommit({ row: row(true), why: 'a'.repeat(501), pending: false })).toEqual({ canCommit: false, tooLong: true })
  })
})

describe('seedView — what the Count section shows of the seed', () => {
  const run = (over: Partial<StoreSeedStatus>): StoreSeedStatus => ({
    store: 'P077',
    state: 'None',
    kind: '',
    reason: '',
    askedAt: null,
    endedAt: null,
    batchRows: 0,
    ofThisClosing: true,
    released: false,
    reopened: false,
    ...over,
  })

  it('nothing before the seed is read', () => {
    expect(seedView(null)).toEqual({ running: false, refusal: null, failure: null })
    expect(seedView(undefined)).toEqual({ running: false, refusal: null, failure: null })
  })

  it('a run an earlier closing asked says nothing about this one', () => {
    expect(seedView(run({ state: 'Refused', reason: 'old', ofThisClosing: false }))).toEqual({
      running: false,
      refusal: null,
      failure: null,
    })
  })

  it('a running seed', () => {
    expect(seedView(run({ state: 'Running' })).running).toBe(true)
  })

  it('a refusal that holds the store shows its reason', () => {
    expect(seedView(run({ state: 'Refused', reason: 'The count against SAP found 2 documents.' }))).toEqual({
      running: false,
      refusal: 'The count against SAP found 2 documents.',
      failure: null,
    })
  })

  it('a refusal that opened the count again is not shown as holding the store', () => {
    expect(seedView(run({ state: 'Refused', kind: 'SalesOnTheirWay', reason: 'on its way', reopened: true })).refusal).toBeNull()
  })

  it('a failed seed shows its reason apart from a refusal', () => {
    expect(seedView(run({ state: 'Failed', reason: 'The seed was interrupted.' }))).toEqual({
      running: false,
      refusal: null,
      failure: 'The seed was interrupted.',
    })
  })
})

// BackOffice 2026-11-23: the count's start and its cancel on the web (the desktop Block / Unblock).
describe('the count start and cancel', () => {
  const open: StoreCountRow = {
    storeCode: 'P077',
    inventoryDate: '2026-11-20T00:00:00',
    isCountClosed: false,
    countClosedAt: '0001-01-01T00:00:00',
    countClosedBy: '',
  }
  const closed: StoreCountRow = { ...open, isCountClosed: true, countClosedAt: '2026-11-21T10:00:00', countClosedBy: 'u1' }
  const today = '2026-11-23'

  it('starts a store with no count, today or earlier, never later', () => {
    expect(startCommit({ row: null, day: today, today, pending: false })).toEqual({ canCommit: true, inFuture: false })
    expect(startCommit({ row: null, day: '2026-11-20', today, pending: false }).canCommit).toBe(true)
    expect(startCommit({ row: null, day: '2026-11-24', today, pending: false })).toEqual({ canCommit: false, inFuture: true })
  })

  it('never starts a store already under count, a blank day, or twice at once', () => {
    expect(startCommit({ row: open, day: today, today, pending: false }).canCommit).toBe(false)
    expect(startCommit({ row: closed, day: today, today, pending: false }).canCommit).toBe(false)
    expect(startCommit({ row: null, day: '', today, pending: false })).toEqual({ canCommit: false, inFuture: false })
    expect(startCommit({ row: null, day: today, today, pending: true }).canCommit).toBe(false)
  })

  it('cancels an open count only, with a reason of at most 500 characters', () => {
    expect(cancelCommit({ row: open, why: ' wrong store ', pending: false })).toEqual({ canCommit: true, tooLong: false })
    expect(cancelCommit({ row: open, why: '   ', pending: false }).canCommit).toBe(false)
    expect(cancelCommit({ row: closed, why: 'why', pending: false }).canCommit).toBe(false)
    expect(cancelCommit({ row: null, why: 'why', pending: false }).canCommit).toBe(false)
    expect(cancelCommit({ row: open, why: 'x'.repeat(WHY_MAX + 1), pending: false })).toEqual({ canCommit: false, tooLong: true })
  })

  it('reads today off the local wall clock, not UTC', () => {
    // 00:30 local on 23 Nov is still 22 Nov in UTC at +03:00; the count day must be the 23rd.
    expect(localDay(new Date(2026, 10, 23, 0, 30))).toBe('2026-11-23')
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

// BackOffice ticket 4261 (ADR 0145, SIS.Stock 081): a move to Blocking is measured by the store's gates — its own proof,
// never waived, and the fleet's gates, each failing one waived by name by a holder of StoreBlockEarly:02 — and names each
// confirmation the gates answer asks for.
const gate = (name: string, scope: string, holds: boolean, figure = ''): StoreGate => ({
  gate: name,
  scope,
  holds,
  waived: false,
  figure,
})

const p077 = (measured: StoreGate[], notConfirmed = ['StoreTills', 'WouldBeRefusalsRead']): StoreGates => ({
  store: 'P077',
  from: '2026-11-11T00:00:00',
  to: '2026-11-24T00:00:00',
  hold: false,
  measured,
  confirmed: [],
  notConfirmed,
  waived: [],
})

const ownHolds = [gate('Seed', 'Store', true), gate('CountersMet', 'Store', true), gate('WouldBeRefusals', 'Store', true)]

describe('the gates answer, store and fleet apart', () => {
  it("splits by scope, and a gate not marked is the store's (it can never be waived by mistake)", () => {
    const apart = gatesApart(p077([gate('Seed', 'Store', true), gate('SapCount', 'Fleet', false), gate('Odd', '', true)]))
    expect(apart.store.map((g) => g.gate)).toEqual(['Seed', 'Odd'])
    expect(apart.fleet.map((g) => g.gate)).toEqual(['SapCount'])
    expect(gatesApart(null)).toEqual({ store: [], fleet: [] })
  })

  it('reads a figure one day or feed per line (the would-be refusals: each day split GS1 / entered / determined)', () => {
    expect(
      figureLines('2026-11-22: 1 of 90 takes refused (1.1%): GS1 scan 1 of 40, determined 0 of 50; 2026-11-23: 0 of 80 takes refused'),
    ).toEqual(['2026-11-22: 1 of 90 takes refused (1.1%): GS1 scan 1 of 40, determined 0 of 50', '2026-11-23: 0 of 80 takes refused'])
    expect(figureLines('')).toEqual([])
  })
})

describe('the move to Blocking', () => {
  it("is ready when the store's own proof holds, each failing fleet gate is waived and every confirmation is named", () => {
    const gates = p077([...ownHolds, gate('SapCount', 'Fleet', false), gate('Feeds', 'Fleet', true)])
    const check = blockingCheck({ gates, confirmed: ['StoreTills', 'WouldBeRefusalsRead'], waived: ['SapCount'], canWaive: true })
    expect(check).toEqual({ ready: true, toConfirm: ['StoreTills', 'WouldBeRefusalsRead'], missing: [], storeFailing: [], unwaived: [] })
    expect(moveCommit({ from: 'Seeded', to: 'Blocking', why: 'Own proof holds', pending: false, blocking: check }).canCommit).toBe(true)
  })

  it('is not ready while a confirmation is missing, a store gate fails (even "waived"), or a failing fleet gate is not waived', () => {
    const gates = p077([gate('Seed', 'Store', true), gate('NightlyCompare', 'Store', false), gate('SapCount', 'Fleet', false)])
    const check = blockingCheck({ gates, confirmed: ['StoreTills'], waived: ['NightlyCompare'], canWaive: true })
    expect(check.ready).toBe(false)
    expect(check.missing).toEqual(['WouldBeRefusalsRead'])
    expect(check.storeFailing).toEqual(['NightlyCompare'])
    expect(check.unwaived).toEqual(['SapCount'])
    expect(moveCommit({ from: 'Seeded', to: 'Blocking', why: 'x', pending: false, blocking: check }).canCommit).toBe(false)
  })

  it('without the waive grant a ticked waiver counts for nothing', () => {
    const gates = p077([...ownHolds, gate('SapCount', 'Fleet', false)], [])
    expect(blockingCheck({ gates, confirmed: [], waived: ['SapCount'], canWaive: false }).unwaived).toEqual(['SapCount'])
  })

  it('cannot be sent before the gates are read', () => {
    expect(blockingCheck({ gates: null, confirmed: [], waived: [], canWaive: true }).ready).toBe(false)
    expect(moveCommit({ from: 'Seeded', to: 'Blocking', why: 'x', pending: false }).canCommit).toBe(false)
  })

  it("sends the confirmations in the answer's order and only the failing fleet gates ticked; other moves send neither", () => {
    const gates = p077([...ownHolds, gate('SapCount', 'Fleet', false), gate('Feeds', 'Fleet', true), gate('Seed', 'Store', true)])
    expect(
      moveRequest({
        to: 'Blocking',
        why: '  Own proof holds  ',
        gates,
        confirmed: ['WouldBeRefusalsRead', 'StoreTills', 'Stale'],
        waived: ['Feeds', 'SapCount', 'Seed'],
        canWaive: true,
      }),
    ).toEqual({ stage: 'Blocking', why: 'Own proof holds', confirmed: ['StoreTills', 'WouldBeRefusalsRead'], waived: ['SapCount'] })
    expect(moveRequest({ to: 'Blocking', why: 'x', gates, confirmed: [], waived: ['SapCount'], canWaive: false }).waived).toEqual([])
    expect(moveRequest({ to: 'Shadow', why: ' back ', gates, confirmed: ['StoreTills'], waived: ['SapCount'], canWaive: true })).toEqual({
      stage: 'Shadow',
      why: 'back',
    })
  })
})
