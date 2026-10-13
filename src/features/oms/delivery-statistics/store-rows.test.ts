import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsStore } from '@/core/models/delivery-statistics'
import { compareFigures, FLOW_FIGURES, STORE_FIGURES, storeRows } from './store-rows'

const full: DeliveryStatisticsStore = {
  storeCode: 'P001',
  flow: { cameIn: 120, madeReady: 110, outForDelivery: 40, trips: 44, delivered: 60, pickedUp: 45, handedOver: 101 },
  misses: { returnedBack: 2, rejected: 0, rescheduled: 1, closeRequested: 3, closedOrCancelled: 4 },
  avgHandOverMinutes: 92.4,
}

describe('storeRows', () => {
  it('maps each store to one row, every figure as the server sent it', () => {
    expect(storeRows([full])).toEqual([
      {
        storeCode: 'P001',
        cameIn: 120,
        madeReady: 110,
        outForDelivery: 40,
        trips: 44,
        delivered: 60,
        pickedUp: 45,
        handedOver: 101,
        returnedBack: 2,
        rejected: 0,
        rescheduled: 1,
        closeRequested: 3,
        closedOrCancelled: 4,
        avgHandOverMinutes: 92.4,
      },
    ])
  })

  it('keeps the server order and one row per store', () => {
    const rows = storeRows([{ ...full, storeCode: 'P019' }, full])
    expect(rows.map((r) => r.storeCode)).toEqual(['P019', 'P001'])
  })

  it('🚩 an absent figure becomes null, never 0; a real 0 stays 0', () => {
    const { trips: _dropped, ...noTrips } = full.flow
    const [row] = storeRows([{ ...full, flow: noTrips, avgHandOverMinutes: null }])
    expect(row.trips).toBeNull()
    expect(row.avgHandOverMinutes).toBeNull()
    expect(row.rejected).toBe(0)
  })

  it('a missing band, or a value that is not a finite number, reads as absent', () => {
    const bare = { storeCode: 'P002' } as unknown as DeliveryStatisticsStore
    const [row] = storeRows([bare])
    for (const key of STORE_FIGURES) expect(row[key]).toBeNull()
    const [odd] = storeRows([{ ...full, flow: { ...full.flow, cameIn: '12' as unknown as number, madeReady: Number.NaN } }])
    expect(odd.cameIn).toBeNull()
    expect(odd.madeReady).toBeNull()
  })

  it('🚩 derives nothing: Handed over is the server figure, not Delivered + Picked up', () => {
    const [row] = storeRows([full])
    expect(row.handedOver).toBe(101)
    expect(row.delivered! + row.pickedUp!).not.toBe(row.handedOver)
  })

  it('an absent or empty list is no rows', () => {
    expect(storeRows([])).toEqual([])
    expect(storeRows(undefined)).toEqual([])
  })
})

describe('STORE_FIGURES', () => {
  it('is the flow in order with Trips beside Out for delivery, then the misses, then Avg hand-over', () => {
    expect(STORE_FIGURES).toEqual([
      'cameIn',
      'madeReady',
      'outForDelivery',
      'trips',
      'delivered',
      'pickedUp',
      'handedOver',
      'returnedBack',
      'rejected',
      'rescheduled',
      'closeRequested',
      'closedOrCancelled',
      'avgHandOverMinutes',
    ])
  })
})

describe('FLOW_FIGURES', () => {
  it('is the flow band in the table order, without Trips (its own caption)', () => {
    expect(FLOW_FIGURES).toEqual(STORE_FIGURES.filter((k) => FLOW_FIGURES.includes(k as never)))
    expect(FLOW_FIGURES).toEqual(['cameIn', 'madeReady', 'outForDelivery', 'delivered', 'pickedUp', 'handedOver'])
  })
})

/**
 * Sorts as AG Grid does: the comparator's answer, negated when descending. A comparator that
 * puts `null` last must therefore answer differently by direction.
 */
function gridSort(values: (number | null)[], descending: boolean): (number | null)[] {
  return [...values].sort((a, b) => {
    const r = compareFigures(a, b, descending)
    return descending ? -r : r
  })
}

describe('compareFigures', () => {
  const values = [5, null, 0, 12, null, 3.5]

  it('sorts numerically, not as text', () => {
    expect(gridSort([10, 9, 100], false)).toEqual([9, 10, 100])
  })

  it('🚩 ascending: the numbers low to high, 0 among them, the absent ones last', () => {
    expect(gridSort(values, false)).toEqual([0, 3.5, 5, 12, null, null])
  })

  it('🚩 descending: the numbers high to low, the absent ones STILL last', () => {
    expect(gridSort(values, true)).toEqual([12, 5, 3.5, 0, null, null])
  })

  it('two absent figures are equal', () => {
    expect(compareFigures(null, null, false)).toBe(0)
    expect(compareFigures(null, null, true)).toBe(0)
  })
})
