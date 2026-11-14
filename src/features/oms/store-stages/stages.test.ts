import { describe, expect, it } from 'vitest'
import type { StoreStage } from '@/core/models/store-stage'
import {
  STAGES_DEFAULTS,
  WHY_MAX,
  moveCommit,
  personMovesFrom,
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
