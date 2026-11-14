import { describe, expect, it } from 'vitest'
import type { StoreGateFigures } from '@/core/models/held-stock-report'
import { GATES_DEFAULTS, gateRow, gatesFiltersFromParams, gatesFiltersToParams, gatesQuery, storesShown } from './gates'

const store = (code: string, holds: boolean): StoreGateFigures => ({
  store: code,
  takes: {
    reported: 1000, withinOneSecond: 994, withinTwoSeconds: 997, unanswered: 3, overOneSecond: 6,
    withinOneSecondPercent: 99.4, unansweredPercent: 0.3, holds: true,
  },
  deliveriesWithoutPick: {
    total: 3,
    days: [{ day: '2026-11-08T00:00:00', count: 2 }, { day: '2026-11-13T00:00:00', count: 1 }],
    holds: false,
  },
  tills: {
    seen: [
      { till: `${code}_1`, build: '261105', lastSeen: '2026-11-13T09:00:00', holdSeamSeen: '2026-11-13T08:00:00', onHoldSeam: true },
      { till: `${code}_2`, build: '261104', lastSeen: '2026-11-13T10:00:00', holdSeamSeen: null, onHoldSeam: false },
    ],
    onAnOldEngine: [`${code}_2`],
    holds: false,
  },
  holds,
})

describe('the gate figures URL (BackOffice ticket 3900)', () => {
  it('writes nothing for the defaults: the fleet, the 14 days ending today, every store', () => {
    expect(gatesFiltersToParams(GATES_DEFAULTS).toString()).toBe('')
    expect(gatesFiltersFromParams(new URLSearchParams())).toEqual(GATES_DEFAULTS)
  })

  it('round-trips the stores, the last day and the not-holding filter, and reads junk as the default', () => {
    const filters = { stores: 'P001,P002', to: '2026-11-13', failing: true }
    expect(gatesFiltersFromParams(gatesFiltersToParams(filters))).toEqual(filters)
    expect(gatesFiltersFromParams(new URLSearchParams('to=2026-02-30&failing=yes&stores=p2 p1'))).toEqual({
      ...GATES_DEFAULTS,
      stores: 'P2,P1',
    })
  })

  it('asks the door for the stores and the last day only', () => {
    expect(gatesQuery({ stores: 'P001', to: '2026-11-13', failing: true })).toEqual({ stores: 'P001', to: '2026-11-13' })
    expect(gatesQuery(GATES_DEFAULTS)).toEqual({})
  })
})

describe('the gate figures grid', () => {
  it('flattens a store to one row: the takes, the delivery sales by day, and the tills on an old engine named', () => {
    expect(gateRow(store('P001', false))).toEqual({
      store: 'P001',
      holds: false,
      takesReported: 1000,
      withinOneSecondPercent: 99.4,
      unansweredPercent: 0.3,
      takesHold: true,
      deliveriesWithoutPick: 3,
      deliveryDays: '2026-11-08: 2, 2026-11-13: 1',
      deliveriesHold: false,
      tillsSeen: 2,
      tillsOnAnOldEngine: 'P001_2',
      tillsHold: false,
    })
  })

  it('shows only the stores whose gates do not all hold when asked', () => {
    const stores = [store('P001', false), store('P002', true)]
    expect(storesShown(stores, false).map((s) => s.store)).toEqual(['P001', 'P002'])
    expect(storesShown(stores, true).map((s) => s.store)).toEqual(['P001'])
  })
})
