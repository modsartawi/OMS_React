import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/query-core'

import type { StockElsewhereResult, StockElsewhereStore } from '@/core/models/callcenter'
import { availabilityOf } from './item-search'
import { createSettle, NEARBY_SETTLE_MS, nearbyLine, nearbyStockQuery } from './nearby-stock'
import { stockView } from './stock-view'

/**
 * Ticket 991 (spec 983 D12) — nearby stock on the highlighted search row, on demand.
 *
 * The component is a thin renderer (RTL is not installed, spec 083); what can go wrong
 * silently is WHEN it asks and WHAT the line says, so both are proven here: the settle
 * clock and the per-item-and-plant cache through a real `QueryClient`, and the line's
 * honest negatives over `stock-view.ts`'s states.
 */

const STORE = (over: Partial<StockElsewhereStore> = {}): StockElsewhereStore => ({
  plant: '1204',
  city: 'Riyadh',
  areaName: 'Malqa',
  address: 'King Abdullah Rd',
  atp: 2,
  distanceKm: 1.2,
  ...over,
})

const RESULT = (over: Partial<StockElsewhereResult> = {}): StockElsewhereResult => ({
  contractVersion: '1.7',
  itemNumber: '200021',
  originPlant: '1101',
  distanceKnown: true,
  available: true,
  stores: [STORE()],
  withStock: 1,
  truncated: false,
  ...over,
})

describe('when the console asks', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('onlyTheSettledRowAsks: arrowing through 10 rows quickly makes one request', async () => {
    const client = new QueryClient()
    const ask = vi.fn(async (_tx: string, item: string) => RESULT({ itemNumber: item }))
    const settle = createSettle<string>(NEARBY_SETTLE_MS, (item) => {
      void client.fetchQuery(nearbyStockQuery(ask, 'TX-1', '1101', item))
    })

    // An agent holding the down arrow: a row every 60 ms, ten rows.
    for (let i = 1; i <= 10; i++) {
      settle.aim(`20000${i}`)
      await vi.advanceTimersByTimeAsync(60)
    }
    expect(ask).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask).toHaveBeenCalledWith('TX-1', '2000010')
  })

  it('nothing is asked before the row has held for 300 ms', async () => {
    const fired = vi.fn()
    const settle = createSettle<string>(NEARBY_SETTLE_MS, fired)
    settle.aim('200001')
    await vi.advanceTimersByTimeAsync(299)
    expect(fired).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fired).toHaveBeenCalledWith('200001')
  })

  it('aiming at nothing, or cancelling, asks nothing', async () => {
    const fired = vi.fn()
    const settle = createSettle<string>(NEARBY_SETTLE_MS, fired)
    settle.aim('200001')
    settle.aim(null)
    await vi.advanceTimersByTimeAsync(1000)
    settle.aim('200002')
    settle.cancel()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fired).not.toHaveBeenCalled()
  })

  it('the answer is cached per item and plant: coming back asks nothing, another plant asks again', async () => {
    const client = new QueryClient()
    const ask = vi.fn(async (_tx: string, item: string) => RESULT({ itemNumber: item }))
    const settleOn = (plant: string) =>
      createSettle<string>(NEARBY_SETTLE_MS, (item) => {
        void client.fetchQuery(nearbyStockQuery(ask, 'TX-1', plant, item))
      })

    const at1101 = settleOn('1101')
    at1101.aim('200001')
    await vi.advanceTimersByTimeAsync(300)
    at1101.aim('200002')
    await vi.advanceTimersByTimeAsync(300)
    at1101.aim('200001')
    await vi.advanceTimersByTimeAsync(300)
    expect(ask).toHaveBeenCalledTimes(2)

    // The store moved: the same item is a new question, ranked from somewhere else.
    const at1204 = settleOn('1204')
    at1204.aim('200001')
    await vi.advanceTimersByTimeAsync(300)
    expect(ask).toHaveBeenCalledTimes(3)
  })

  it('an outage is never retried by the cache', () => {
    const query = nearbyStockQuery(vi.fn(), 'TX-1', '1101', '200001')
    expect(query.retry).toBe(false)
    expect(query.queryKey).toEqual(['callcenter', 'nearbyStock', 'TX-1', '1101', '200001'])
  })
})

describe('what the line says', () => {
  const panel = (result: StockElsewhereResult | null, over: Partial<Parameters<typeof stockView>[0]> = {}) =>
    stockView({ canPriceCheck: true, result, pending: false, ...over })

  it('N here, then the nearest stores by area name, as the server ranked them', () => {
    const line = nearbyLine(
      availabilityOf(0),
      panel(
        RESULT({
          stores: [STORE({ plant: '1204', areaName: 'Malqa', atp: 2 }), STORE({ plant: '1302', areaName: 'Yasmin', atp: 5 })],
          withStock: 2,
        }),
      ),
    )
    expect(line).toEqual({
      kind: 'listed',
      here: 0,
      stores: [
        { plant: '1204', name: 'Malqa', atp: 2 },
        { plant: '1302', name: 'Yasmin', atp: 5 },
      ],
      more: 0,
    })
  })

  it('shows three stores and counts the rest from the server total, not the list', () => {
    const stores = ['A', 'B', 'C', 'D', 'E'].map((n, i) => STORE({ plant: `13${i}`, areaName: n }))
    const line = nearbyLine(availabilityOf(4), panel(RESULT({ stores, withStock: 23, truncated: true })))
    expect(line.kind).toBe('listed')
    if (line.kind !== 'listed') return
    expect(line.here).toBe(4)
    expect(line.stores.map((s) => s.name)).toEqual(['A', 'B', 'C'])
    expect(line.more).toBe(20)
  })

  it('a store with no area name is named by its city, then its code', () => {
    const line = nearbyLine(
      availabilityOf(1),
      panel(
        RESULT({
          stores: [STORE({ plant: '1204', areaName: '', city: 'Jeddah' }), STORE({ plant: '1302', areaName: '', city: '' })],
          withStock: 2,
        }),
      ),
    )
    expect(line.kind === 'listed' && line.stores.map((s) => s.name)).toEqual(['Jeddah', '1302'])
  })

  it('unknown here is null, never zero', () => {
    const line = nearbyLine(availabilityOf(null), panel(RESULT()))
    expect(line.kind === 'listed' && line.here).toBe(null)
  })

  it('🚩 an outage says could-not-check, never nobody-has-it', () => {
    const line = nearbyLine(availabilityOf(0), panel(RESULT({ available: false, stores: [], withStock: 0 })))
    expect(line.kind).toBe('unknown')
  })

  it('nobody else has it is its own state, carrying the count here', () => {
    expect(nearbyLine(availabilityOf(3), panel(RESULT({ stores: [], withStock: 0 })))).toEqual({ kind: 'none', here: 3 })
  })

  it('a shut gate draws nothing; a pending read says it is checking', () => {
    expect(nearbyLine(availabilityOf(3), panel(null, { canPriceCheck: false })).kind).toBe('shut')
    expect(nearbyLine(availabilityOf(3), panel(null, { pending: true })).kind).toBe('pending')
  })
})
