import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsStore } from '@/core/models/delivery-statistics'
import { FLOW_FIGURES, HAND_OVER_FIGURE, STORE_FIGURES, TABLE_TRACKS, TRACK_FIGURES, storeRows } from './store-rows'

const full: DeliveryStatisticsStore = {
  storeCode: 'P001',
  flow: { cameIn: 120, madeReady: 110, outForDelivery: 40, trips: 44, delivered: 60, pickedUp: 45, handedOver: 101 },
  misses: { returnedBack: 2, rejected: 0, rescheduled: 1, closeRequested: 3, closedOrCancelled: 4 },
  avgHandOverMinutes: 92.4,
}

const withTracks: DeliveryStatisticsStore = {
  ...full,
  unspecified: 3,
  tracks: {
    delivery: {
      flow: { cameIn: 70, madeReady: 65, outForDelivery: 37, trips: 41, handedOver: 60 },
      misses: { returnedBack: 2, rejected: 0, rescheduled: 1, closeRequested: 1, closedOrCancelled: 2 },
      avgHandOverMinutes: 96.25,
    },
    pickUp: {
      flow: { cameIn: 48, madeReady: 44, handedOver: 45 },
      misses: { returnedBack: 0, rejected: 0, rescheduled: 0, closeRequested: 2, closedOrCancelled: 2 },
      avgHandOverMinutes: 31.5,
    },
  },
}

describe('storeRows by track', () => {
  it("All is the default view, and reads the store's unspecified as its last flow column", () => {
    expect(storeRows([withTracks])).toEqual(storeRows([withTracks], 'all'))
    expect(storeRows([withTracks])[0].unspecified).toBe(3)
  })

  it("Delivery maps each tracks.delivery figure to its column; Delivered is the lane's hand-over", () => {
    expect(storeRows([withTracks], 'delivery')).toEqual([
      {
        storeCode: 'P001',
        cameIn: 70,
        madeReady: 65,
        outForDelivery: 37,
        trips: 41,
        delivered: 60,
        returnedBack: 2,
        rejected: 0,
        rescheduled: 1,
        closeRequested: 1,
        closedOrCancelled: 2,
        avgHandOverMinutes: 96.25,
      },
    ])
  })

  it("Pick-up maps each tracks.pickUp figure to its column; Picked up is the lane's hand-over", () => {
    expect(storeRows([withTracks], 'pickUp')).toEqual([
      { storeCode: 'P001', cameIn: 48, madeReady: 44, pickedUp: 45, closeRequested: 2, closedOrCancelled: 2, avgHandOverMinutes: 31.5 },
    ])
  })

  it('🚩 a store row without tracks reads null in every Delivery and Pick-up figure, never 0 nor the store-wide one', () => {
    for (const track of ['delivery', 'pickUp'] as const) {
      const [row] = storeRows([full], track)
      expect(Object.keys(row)).toEqual(['storeCode', ...TRACK_FIGURES[track]])
      for (const key of TRACK_FIGURES[track]) expect(row[key]).toBeNull()
    }
  })

  it('a track without misses (a 2658 server) reads null in its miss columns, its flow as sent', () => {
    const { misses: _m, ...delivery } = withTracks.tracks!.delivery
    const [row] = storeRows([{ ...withTracks, tracks: { ...withTracks.tracks!, delivery } }], 'delivery')
    expect(row.returnedBack).toBeNull()
    expect(row.closedOrCancelled).toBeNull()
    expect(row.cameIn).toBe(70)
  })

  it('🚩 an absent unspecified reads null in All, never 0', () => {
    expect(storeRows([full])[0].unspecified).toBeNull()
  })
})

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
        unspecified: null,
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

describe('TRACK_FIGURES', () => {
  it("each view's columns are its track's figures in order", () => {
    // All: today's columns, Unspecified the last flow column (decision B).
    expect(TRACK_FIGURES.all).toEqual([
      'cameIn',
      'madeReady',
      'outForDelivery',
      'trips',
      'handedOver',
      'delivered',
      'pickedUp',
      'unspecified',
      'returnedBack',
      'rejected',
      'rescheduled',
      'closeRequested',
      'closedOrCancelled',
      'avgHandOverMinutes',
    ])
    expect(TRACK_FIGURES.delivery).toEqual([
      'cameIn',
      'madeReady',
      'outForDelivery',
      'trips',
      'delivered',
      'returnedBack',
      'rejected',
      'rescheduled',
      'closeRequested',
      'closedOrCancelled',
      'avgHandOverMinutes',
    ])
    // No Out for delivery, no Trips, and no Returned back / Rejected / Rescheduled (a table cannot hide per row).
    expect(TRACK_FIGURES.pickUp).toEqual(['cameIn', 'madeReady', 'pickedUp', 'closeRequested', 'closedOrCancelled', 'avgHandOverMinutes'])
    expect(STORE_FIGURES).toEqual(TRACK_FIGURES.all)
  })

  it("a row carries exactly its view's figures, in the column order", () => {
    for (const track of TABLE_TRACKS) {
      const [row] = storeRows([withTracks], track)
      expect(Object.keys(row)).toEqual(['storeCode', ...TRACK_FIGURES[track]])
    }
  })

  it('each view ranks by its own hand-over column', () => {
    expect(HAND_OVER_FIGURE).toEqual({ all: 'handedOver', delivery: 'delivered', pickUp: 'pickedUp' })
    for (const track of TABLE_TRACKS) expect(TRACK_FIGURES[track]).toContain(HAND_OVER_FIGURE[track])
  })
})

describe('STORE_FIGURES (the All view)', () => {
  it('is the flow in order with Trips beside Out for delivery and Handed over before its two halves, then Unspecified, the misses, Avg hand-over', () => {
    expect(STORE_FIGURES).toEqual([
      'cameIn',
      'madeReady',
      'outForDelivery',
      'trips',
      'handedOver',
      'delivered',
      'pickedUp',
      'unspecified',
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
    // As on the till: the stages end at Handed over; Delivered (D) and Picked up (P) are its halves, after it.
    expect(FLOW_FIGURES).toEqual(['cameIn', 'madeReady', 'outForDelivery', 'handedOver', 'delivered', 'pickedUp'])
  })
})
