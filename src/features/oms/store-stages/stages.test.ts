import { describe, expect, it } from 'vitest'
import type { StoreCountRow, StoreStage } from '@/core/models/store-stage'
import {
  STAGES_DEFAULTS,
  WHY_MAX,
  canAskCountClosed,
  countOf,
  countState,
  moveCommit,
  personMovesFrom,
  personName,
  releaseCommit,
  stageRow,
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
    expect(moveCommit({ from: 'Seeded', to: 'Blocking', why: 'Gates hold for 14 days', pending: false }).canCommit).toBe(true)
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
          whoName: 'Rana Haddad',
          why: 'Dead link',
          movedAt: '2026-11-14T10:05:00',
        }),
      ),
    ).toEqual({
      store: 'P883',
      stage: 'Shadow',
      lastFrom: 'Blocking',
      lastMover: 'Person',
      lastWho: 'Rana Haddad',
      lastWhoId: 'u.stockctl',
      lastWhy: 'Dead link',
      lastMovedAt: '2026-11-14T10:05:00',
    })
    expect(stageRow(stage('P884', 'Shadow'))).toEqual({
      store: 'P884',
      stage: 'Shadow',
      lastFrom: '',
      lastMover: '',
      lastWho: '',
      lastWhoId: '',
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
    countClosedByName: isCountClosed ? 'Huda Saleh' : '',
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

// Owner ruling 2026-11-15: the log shows people's names, not user ids. SIS.Api names each id from HQ's user directory and
// keeps the id beside it; an id the directory does not know (the seed, the sweep's SIS.Api, an old row) comes back as itself.
describe("people's names (BackOffice 3899, owner ruling 2026-11-15)", () => {
  it('shows the name, and the id when there is no name', () => {
    expect(personName('u.stockctl', 'Rana Haddad')).toBe('Rana Haddad')
    expect(personName('SIS.Api', 'SIS.Api')).toBe('SIS.Api')
    expect(personName('u.old', '  ')).toBe('u.old')
    expect(personName('u.old', undefined)).toBe('u.old')
    expect(personName('', '')).toBe('')
  })

  it('a row whose last mover is unknown shows the raw id', () => {
    const row = stageRow(
      stage('P883', 'Seeded', {
        store: 'P883',
        from: 'Seeding',
        to: 'Seeded',
        mover: 'Seed',
        who: 'SIS.Api',
        whoName: 'SIS.Api',
        why: '',
        movedAt: '2026-11-14T10:05:00',
      }),
    )
    expect(row.lastWho).toBe('SIS.Api')
    expect(row.lastWhoId).toBe('SIS.Api')
  })
})
