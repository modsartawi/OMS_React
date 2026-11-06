import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsStore } from '@/core/models/delivery-statistics'
import {
  CELL_BAR_FIGURES,
  FLOW_FIGURES,
  HAND_OVER_FIGURE,
  STORE_FIGURES,
  TABLE_TRACKS,
  TRACK_FIGURES,
  columnMaxima,
  defaultSort,
  defaultTableTrack,
  storeRows,
} from './store-rows'

const full: DeliveryStatisticsStore = {
  storeCode: 'P001',
  flow: { cameIn: 120, madeReady: 110, outForDelivery: 40, trips: 44, delivered: 60, pickedUp: 45, handedOver: 101 },
  misses: { returnedBack: 2, rejected: 0, rescheduled: 1, closeRequested: 3, closedOrCancelled: 4 },
  avgHandOverMinutes: 92.4,
  avgDeliveryMinutes: 40.1,
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
      avgDeliveryMinutes: 30.25,
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
        // A 2660 track without spec 811's fields: null, never 0.
        inSlotShare: null,
        outOfSlotShare: null,
        noSlot: null,
        deliveredPerTrip: null,
        returnedBack: 2,
        rejected: 0,
        rescheduled: 1,
        closeRequested: 1,
        closedOrCancelled: 2,
        avgDeliveryMinutes: null,
      },
    ])
  })

  it("Pick-up maps each tracks.pickUp figure to its column; Picked up is the lane's hand-over", () => {
    expect(storeRows([withTracks], 'pickUp')).toEqual([
      { storeCode: 'P001', cameIn: 48, madeReady: 44, pickedUp: 45, closeRequested: 2, closedOrCancelled: 2, avgDeliveryMinutes: 30.25 },
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
        avgDeliveryMinutes: 40.1,
      },
    ])
  })

  it('keeps the server order and one row per store', () => {
    const rows = storeRows([{ ...full, storeCode: 'P019' }, full])
    expect(rows.map((r) => r.storeCode)).toEqual(['P019', 'P001'])
  })

  it('🚩 an absent figure becomes null, never 0; a real 0 stays 0', () => {
    const { trips: _dropped, ...noTrips } = full.flow
    const [row] = storeRows([{ ...full, flow: noTrips, avgDeliveryMinutes: null }])
    expect(row.trips).toBeNull()
    expect(row.avgDeliveryMinutes).toBeNull()
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
      'avgDeliveryMinutes',
    ])
    // 816: In slot %, Out of slot %, No slot and Delivered per trip after Delivered; Avg delivery time last.
    expect(TRACK_FIGURES.delivery).toEqual([
      'cameIn',
      'madeReady',
      'outForDelivery',
      'trips',
      'delivered',
      'inSlotShare',
      'outOfSlotShare',
      'noSlot',
      'deliveredPerTrip',
      'returnedBack',
      'rejected',
      'rescheduled',
      'closeRequested',
      'closedOrCancelled',
      'avgDeliveryMinutes',
    ])
    // No Out for delivery, no Trips, and no Returned back / Rejected / Rescheduled (a table cannot hide per row).
    expect(TRACK_FIGURES.pickUp).toEqual(['cameIn', 'madeReady', 'pickedUp', 'closeRequested', 'closedOrCancelled', 'avgDeliveryMinutes'])
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
  it('is the flow in order with Trips beside Out for delivery and Handed over before its two halves, then Unspecified, the misses, Avg delivery time', () => {
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
      'avgDeliveryMinutes',
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

const slotted: DeliveryStatisticsStore = {
  ...withTracks,
  avgDeliveryMinutes: 41.5,
  tracks: {
    ...withTracks.tracks!,
    delivery: {
      ...withTracks.tracks!.delivery,
      slot: { inSlot: 48, outOfSlot: 9, noSlot: 3, inSlotShare: 0.8, outOfSlotShare: 0.15 },
      deliveredPerTrip: 1.46,
      avgDeliveryMinutes: 38.25,
    },
  },
}

describe('the Delivery view slot, trip and delivery-time figures (816)', () => {
  it('the Delivery view carries the five new figures as sent', () => {
    const [row] = storeRows([slotted], 'delivery')
    expect(row).toMatchObject({ inSlotShare: 0.8, outOfSlotShare: 0.15, noSlot: 3, deliveredPerTrip: 1.46, avgDeliveryMinutes: 38.25 })
    // Avg delivery time replaces the entry-based average in the Delivery view.
    expect(row).not.toHaveProperty('avgHandOverMinutes')
  })

  it('🚩 an absent figure reads null, never 0; a store without the fields reads null in each', () => {
    const [bare] = storeRows([withTracks], 'delivery')
    for (const key of ['inSlotShare', 'outOfSlotShare', 'noSlot', 'deliveredPerTrip', 'avgDeliveryMinutes'] as const) expect(bare[key]).toBeNull()
    const { inSlotShare: _i, outOfSlotShare: _o, ...countsOnly } = slotted.tracks!.delivery.slot!
    const delivery = { ...slotted.tracks!.delivery, slot: countsOnly, deliveredPerTrip: null }
    const [noShares] = storeRows([{ ...slotted, tracks: { ...slotted.tracks!, delivery } }], 'delivery')
    expect(noShares.inSlotShare).toBeNull()
    expect(noShares.outOfSlotShare).toBeNull()
    expect(noShares.deliveredPerTrip).toBeNull()
    expect(noShares.noSlot).toBe(3)
  })

  it("the All view's average is the store-wide Avg delivery time; Pick-up reads its lane's, the Pick-up funnel's figure", () => {
    expect(storeRows([slotted], 'all')[0]).toMatchObject({ avgDeliveryMinutes: 41.5 })
    expect(storeRows([slotted], 'all')[0]).not.toHaveProperty('avgHandOverMinutes')
    const { avgDeliveryMinutes: _a, ...older } = withTracks
    expect(storeRows([older], 'all')[0].avgDeliveryMinutes).toBeNull()
    // The same field the Pick-up funnel reads (`tracks.pickUp.avgDeliveryMinutes`), so the two never disagree.
    const [pickUp] = storeRows([slotted], 'pickUp')
    expect(pickUp.avgDeliveryMinutes).toBe(30.25)
    expect(pickUp).not.toHaveProperty('avgHandOverMinutes')
  })
})

describe('the table default per courier, and the cell-bar maxima (816)', () => {
  it('a chosen courier opens on Delivery sorted by Out of slot % worst first', () => {
    expect(defaultTableTrack('FREY')).toBe('delivery')
    expect(defaultSort('delivery', 'FREY')).toEqual({ figure: 'outOfSlotShare', direction: 'desc' })
    // A view the user switched to under a courier ranks by its own hand-over column, as today.
    expect(defaultSort('all', 'FREY')).toEqual({ figure: 'handedOver', direction: 'desc' })
  })

  it("all couriers keeps today's default: All, and each view by its hand-over column", () => {
    expect(defaultTableTrack('')).toBe('all')
    expect(defaultSort('all', '')).toEqual({ figure: 'handedOver', direction: 'desc' })
    expect(defaultSort('delivery', '')).toEqual({ figure: 'delivered', direction: 'desc' })
    expect(defaultSort('pickUp', '')).toEqual({ figure: 'pickedUp', direction: 'desc' })
  })

  it('the bars are drawn in Out of slot %, Delivered per trip and Avg delivery time, all Delivery-view columns', () => {
    expect(CELL_BAR_FIGURES).toEqual(['outOfSlotShare', 'deliveredPerTrip', 'avgDeliveryMinutes'])
    for (const key of CELL_BAR_FIGURES) expect(TRACK_FIGURES.delivery).toContain(key)
  })

  it("each bar column's maximum is its largest value as sent; an absent value adds nothing, none at all is 0", () => {
    const rows = [
      { storeCode: 'P001', outOfSlotShare: 0.15, deliveredPerTrip: 1.46, avgDeliveryMinutes: 38.25 },
      { storeCode: 'P019', outOfSlotShare: 0.4, deliveredPerTrip: null, avgDeliveryMinutes: 61 },
      { storeCode: 'P007', outOfSlotShare: null, deliveredPerTrip: 2.1, avgDeliveryMinutes: null },
    ]
    expect(columnMaxima(rows)).toEqual({ outOfSlotShare: 0.4, deliveredPerTrip: 2.1, avgDeliveryMinutes: 61 })
    expect(columnMaxima([{ storeCode: 'P001', outOfSlotShare: null }])).toEqual({ outOfSlotShare: 0, deliveredPerTrip: 0, avgDeliveryMinutes: 0 })
    expect(columnMaxima([])).toEqual({ outOfSlotShare: 0, deliveredPerTrip: 0, avgDeliveryMinutes: 0 })
  })
})
