import { describe, expect, it } from 'vitest'
import type { TakeRefusalGroup, TakeRefusalReport, TakeRefusalRow } from '@/core/models/held-stock-report'
import {
  REFUSAL_DEFAULTS,
  drillIntoGroup,
  groupsShown,
  refusalFiltersFromParams,
  refusalFiltersToParams,
  refusalQuery,
  refusalTotals,
  rowsShown,
} from './refusals'

describe('the refusal report URL', () => {
  it('writes nothing for the defaults: today, every open store, real and shadow rows, the groups', () => {
    expect(refusalFiltersToParams(REFUSAL_DEFAULTS).toString()).toBe('')
    expect(refusalFiltersFromParams(new URLSearchParams())).toEqual(REFUSAL_DEFAULTS)
  })

  it('round-trips the day, the stores, the kind, the tab and a group drill (a blank batch included)', () => {
    const filters = {
      tab: 'rows' as const,
      day: '2026-11-12',
      stores: 'P001,P002',
      kind: 'shadow' as const,
      drill: { store: 'P001', material: '100234', batch: '', shadow: true },
    }
    expect(refusalFiltersFromParams(refusalFiltersToParams(filters))).toEqual(filters)
  })

  it('reads an impossible day, an unknown tab or kind as the default, and tidies the stores', () => {
    const read = refusalFiltersFromParams(new URLSearchParams('day=2026-02-30&tab=nope&kind=maybe&stores= p001 ,p001;p002'))
    expect(read.day).toBe('')
    expect(read.tab).toBe('groups')
    expect(read.kind).toBe('')
    expect(read.stores).toBe('P001,P002')
    expect(read.drill).toBeNull()
  })
})

describe('the refusal read', () => {
  it('asks for the day and the stores, and leaves either out for today and every open store', () => {
    expect(refusalQuery({ ...REFUSAL_DEFAULTS, day: '2026-11-12', stores: 'P001' })).toEqual({ day: '2026-11-12', stores: 'P001' })
    expect(refusalQuery({ ...REFUSAL_DEFAULTS, kind: 'shadow', tab: 'rows' })).toEqual({})
  })
})

const group = (store: string, material: string, batch: string, isShadow: boolean, count: number): TakeRefusalGroup => ({
  store,
  material,
  batch,
  isShadow,
  count,
  quantityAsked: count,
  quantityAvailable: 0,
  reasons: 'NO_STOCK',
  sapFeedAgeSeconds: 60,
  posFeedAgeSeconds: null,
  firstAt: '2026-11-12T09:00:00',
  lastAt: '2026-11-12T10:00:00',
})

const row = (takeId: string, store: string, material: string, batch: string, isShadow: boolean): TakeRefusalRow => ({
  takeId,
  store,
  material,
  batch,
  quantityAsked: 1,
  quantityAvailable: 0,
  code: 'R1',
  reason: 'NO_STOCK',
  batchWithStock: '',
  batchWithStockExpiry: null,
  batchWithStockQuantity: null,
  expiredQuantity: null,
  document: '',
  user: '',
  isShadow,
  stage: '',
  sapFeedAgeSeconds: null,
  posFeedAgeSeconds: null,
  loggedAt: '2026-11-12T09:00:00',
})

const ROWS = [
  row('T1', 'P001', 'M1', 'B1', false),
  row('T2', 'P001', 'M1', 'B1', true),
  row('T3', 'P001', 'M1', '', false),
  row('T4', 'P002', 'M1', 'B1', false),
  row('T5', 'P001', 'M1', 'B1', false),
]

describe('the shadow filter and the drill', () => {
  it('keeps the real refusals or the would-be ones apart, on the groups and on the rows', () => {
    const groups = [group('P001', 'M1', 'B1', false, 2), group('P001', 'M1', 'B1', true, 1)]
    expect(groupsShown(groups, { ...REFUSAL_DEFAULTS, kind: 'shadow' }).map((g) => g.isShadow)).toEqual([true])
    expect(groupsShown(groups, REFUSAL_DEFAULTS)).toHaveLength(2)
    expect(rowsShown(ROWS, { ...REFUSAL_DEFAULTS, kind: 'real' }).map((r) => r.takeId)).toEqual(['T1', 'T3', 'T4', 'T5'])
  })

  it('opening a group shows its rows: same store, material, batch and shadow, keeping the day and stores', () => {
    const scoped = { ...REFUSAL_DEFAULTS, day: '2026-11-12', stores: 'P001,P002' }
    const next = drillIntoGroup(scoped, group('P001', 'M1', 'B1', false, 2))
    expect(next).toEqual({ ...scoped, tab: 'rows', drill: { store: 'P001', material: 'M1', batch: 'B1', shadow: false } })
    expect(rowsShown(ROWS, next).map((r) => r.takeId)).toEqual(['T1', 'T5'])
  })

  it('the group with no batch keeps only the rows that named none, never every batch', () => {
    const next = drillIntoGroup(REFUSAL_DEFAULTS, group('P001', 'M1', '', false, 1))
    expect(rowsShown(ROWS, next).map((r) => r.takeId)).toEqual(['T3'])
  })
})

describe("the day's tiles", () => {
  it('counts refusals and would-be refusals from the groups, and the lines, takes and unreached stores', () => {
    const report: TakeRefusalReport = {
      asOf: '',
      day: '2026-11-12',
      groups: [group('P001', 'M1', 'B1', false, 3), group('P002', 'M2', '', false, 1), group('P003', 'M1', 'B1', true, 4)],
      rows: [],
      multiBatchLines: [{ store: 'P001', lines: 2 }, { store: 'P002', lines: 5 }],
      lastResortTakes: [],
      storesUnreached: ['P009'],
    }
    expect(refusalTotals(report)).toEqual({ refused: 4, wouldRefuse: 4, groups: 3, multiBatchLines: 7, lastResortTakes: 0, storesUnreached: 1 })
  })
})
