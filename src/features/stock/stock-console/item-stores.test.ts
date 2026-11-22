import { describe, expect, it } from 'vitest'
import type { StockConsoleItemStoreRow } from '@/core/models/stock-console'
import { itemStoreFigures, itemStoreHref } from './item-stores'

const row = (over: Partial<StockConsoleItemStoreRow> = {}): StockConsoleItemStoreRow => ({
  plant: 'P078',
  city: 'Jeddah',
  stage: 'Seeded',
  sapStock: 50,
  tillStock: 44,
  heldStanding: 3,
  heldSold: 1,
  reserved: null,
  lastUpdate: '2026-11-22T10:00:00',
  ...over,
})

describe('an Other stores row', () => {
  it('links to the same item at that store', () => {
    expect(itemStoreHref('1001', row())).toBe('/stock/console/store/P078/item/1001')
  })

  it('reads gap, held and free as the store list does when the answer leaves them out', () => {
    expect(itemStoreFigures(row())).toEqual({
      gap: 6,
      held: 4,
      free: 40,
      reserved: null,
      reservedState: 'NeverComputed',
      reservedIncluded: false,
    })
    expect(itemStoreFigures(row({ reserved: 10 }))).toMatchObject({ free: 30, reservedState: 'Computed', reservedIncluded: true })
  })

  it('takes the figures SIS.Api adds when it adds them', () => {
    const figures = itemStoreFigures(
      row({ reserved: 10, gap: 7, held: 5, free: 29, reservedState: 'Stale', reservedIncluded: true }),
    )
    expect(figures).toEqual({ gap: 7, held: 5, free: 29, reserved: 10, reservedState: 'Stale', reservedIncluded: true })
  })
})
