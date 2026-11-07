import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsTracks } from '@/core/models/delivery-statistics'
import { readLanes, showsUnspecified } from './lanes'

const DASH = '—'

const TRACKS: DeliveryStatisticsTracks = {
  delivery: {
    flow: { cameIn: 700, madeReady: 650, outForDelivery: 380, trips: 412, handedOver: 640 },
    misses: { returnedBack: 21, rejected: 0, rescheduled: 9, closeRequested: 1, closedOrCancelled: 12 },
    avgHandOverMinutes: 96.25,
    avgDeliveryMinutes: 41.5,
    slot: { inSlot: 512, outOfSlot: 96, noSlot: 32, inSlotShare: 0.8, outOfSlotShare: 0.15 },
  },
  pickUp: {
    flow: { cameIn: 520, madeReady: 470, handedOver: 455 },
    misses: { returnedBack: 0, rejected: 0, rescheduled: 0, closeRequested: 3, closedOrCancelled: 5 },
    avgHandOverMinutes: 31.5,
    avgDeliveryMinutes: 30.25,
  },
}

describe('readLanes', () => {
  it("lanes read each track's stages from tracks", () => {
    const [delivery, pickUp] = readLanes(TRACKS, DASH)

    expect(delivery.track).toBe('delivery')
    expect(delivery.stages.map((s) => [s.id, s.value])).toEqual([
      ['cameIn', '700'],
      ['madeReady', '650'],
      ['outForDelivery', '380'],
      // The lane's last stage is the track's own hand-over: Delivered.
      ['delivered', '640'],
    ])
    // Trips sit on Out for delivery, and on no other stage.
    expect(delivery.stages.map((s) => s.trips)).toEqual([undefined, undefined, '412', undefined])
    // The lane's average is its Avg delivery time, not the entry-based hand-over average.
    expect(delivery.average).toEqual({ value: '41.5', hasUnit: true })

    expect(pickUp.track).toBe('pickUp')
    // A pick-up never goes out: three stages, no Out for delivery, ending at Picked up.
    expect(pickUp.stages.map((s) => [s.id, s.value])).toEqual([
      ['cameIn', '520'],
      ['madeReady', '470'],
      ['pickedUp', '455'],
    ])
    expect(pickUp.stages.every((s) => s.trips === undefined)).toBe(true)
    expect(pickUp.average).toEqual({ value: '30.25', hasUnit: true })
  })

  it('a real 0 reads 0, an average of 0 included', () => {
    const [delivery, pickUp] = readLanes(
      {
        delivery: { flow: { cameIn: 0, madeReady: 0, outForDelivery: 0, trips: 0, handedOver: 0 }, avgDeliveryMinutes: 0 },
        pickUp: { flow: { cameIn: 0, madeReady: 0, handedOver: 0 }, avgDeliveryMinutes: 0 },
      },
      DASH,
    )
    expect(delivery.stages.map((s) => s.value)).toEqual(['0', '0', '0', '0'])
    expect(delivery.stages[2].trips).toBe('0')
    expect(delivery.average).toEqual({ value: '0', hasUnit: true })
    expect(pickUp.stages.map((s) => s.value)).toEqual(['0', '0', '0'])
  })

  // 🚩 An older server (no `tracks`) is not an empty day.
  it('no tracks reads every lane figure as the dash, never 0', () => {
    for (const tracks of [undefined, null, { delivery: {}, pickUp: {} } as DeliveryStatisticsTracks]) {
      const [delivery, pickUp] = readLanes(tracks, DASH)
      // Both lanes are still drawn, stage for stage, so an older server reads as "not sent".
      expect(delivery.stages.map((s) => [s.id, s.value])).toEqual([
        ['cameIn', DASH],
        ['madeReady', DASH],
        ['outForDelivery', DASH],
        ['delivered', DASH],
      ])
      expect(delivery.stages[2].trips).toBe(DASH)
      expect(delivery.average).toEqual({ value: DASH, hasUnit: false })
      expect(pickUp.stages.map((s) => [s.id, s.value])).toEqual([
        ['cameIn', DASH],
        ['madeReady', DASH],
        ['pickedUp', DASH],
      ])
      expect(pickUp.average).toEqual({ value: DASH, hasUnit: false })
    }
  })

  it('🚩 an absent trips and a null average read as the dash, beside the figures that were sent', () => {
    const [delivery, pickUp] = readLanes(
      {
        // An older server's hand-over average is not the lane's Avg delivery time: still the dash.
        delivery: { flow: { cameIn: 700, madeReady: 650, outForDelivery: 380, handedOver: 640 }, avgHandOverMinutes: 96.25, avgDeliveryMinutes: null },
        pickUp: { flow: { cameIn: 520, madeReady: 470, handedOver: 455 }, avgHandOverMinutes: 31.5 },
      },
      DASH,
    )
    expect(delivery.stages[2]).toMatchObject({ id: 'outForDelivery', value: '380', trips: DASH })
    // A unit beside the dash would read as a value: only a number carries one.
    expect(delivery.average).toEqual({ value: DASH, hasUnit: false })
    expect(pickUp.average).toEqual({ value: DASH, hasUnit: false })
    expect(pickUp.stages.map((s) => s.value)).toEqual(['520', '470', '455'])
  })

  it('funnel stages carry their figure and their share of Came in', () => {
    const [delivery, pickUp] = readLanes(TRACKS, DASH)
    // Geometry only: each stage's bar is its figure over the lane's own Came in, as the server sent both.
    expect(delivery.stages.map((s) => [s.id, s.value, s.bar])).toEqual([
      ['cameIn', '700', 1],
      ['madeReady', '650', 650 / 700],
      ['outForDelivery', '380', 380 / 700],
      ['delivered', '640', 640 / 700],
    ])
    expect(pickUp.stages.map((s) => s.bar)).toEqual([1, 470 / 520, 455 / 520])
  })

  it('🚩 an absent stage or an absent Came in draws no bar and reads the dash', () => {
    const [delivery, pickUp] = readLanes(
      {
        delivery: { flow: { cameIn: 700, outForDelivery: 380, handedOver: 0 } },
        pickUp: { flow: { madeReady: 470, handedOver: 455 } },
      },
      DASH,
    )
    // An absent stage: no bar. A real 0 is a bar of nothing, not an absent one.
    expect(delivery.stages.map((s) => [s.value, s.bar])).toEqual([
      ['700', 1],
      [DASH, null],
      ['380', 380 / 700],
      ['0', 0],
    ])
    // No Came in to measure against: no stage of the lane draws a bar, its figures still read.
    expect(pickUp.stages.map((s) => [s.value, s.bar])).toEqual([
      [DASH, null],
      ['470', null],
      ['455', null],
    ])
  })

  it('a Came in of 0 draws no bar; a stage past Came in carries its ratio unclamped (StageBar clamps), its figure as sent', () => {
    const [delivery, pickUp] = readLanes(
      {
        delivery: { flow: { cameIn: 0, madeReady: 0, outForDelivery: 0, handedOver: 0 } },
        // Counted on its first event, a hand-over can be of a delivery that came in before the period.
        pickUp: { flow: { cameIn: 400, madeReady: 444, handedOver: 455 } },
      },
      DASH,
    )
    expect(delivery.stages.map((s) => s.bar)).toEqual([null, null, null, null])
    expect(pickUp.stages.map((s) => [s.value, s.bar])).toEqual([
      ['400', 1],
      ['444', 444 / 400],
      ['455', 455 / 400],
    ])
  })

  it('🚩 a pick-up lane never shows an Out for delivery, even if a server sent one', () => {
    const odd = { ...TRACKS, pickUp: { flow: { ...TRACKS.pickUp.flow, outForDelivery: 2 } } } as unknown as DeliveryStatisticsTracks
    const [, pickUp] = readLanes(odd, DASH)
    expect(pickUp.stages.map((s) => s.id)).toEqual(['cameIn', 'madeReady', 'pickedUp'])
  })
})

describe('the slot split', () => {
  it("the slot split is the server's counts and shares", () => {
    const [delivery] = readLanes(TRACKS, DASH)
    expect(delivery.slot).toEqual({
      drawn: true,
      segments: [
        { id: 'inSlot', count: 512, value: '512', share: '80%' },
        { id: 'outOfSlot', count: 96, value: '96', share: '15%' },
        // The server sends no No slot share, and none is made up.
        { id: 'noSlot', count: 32, value: '32', share: null },
      ],
    })
  })

  it('🚩 nothing delivered, or no slot figures, draws no split and reads the dash', () => {
    const cases: DeliveryStatisticsTracks['delivery'][] = [
      // Nothing delivered: the server sends zero counts and no shares.
      { flow: { handedOver: 0 }, slot: { inSlot: 0, outOfSlot: 0, noSlot: 0 } },
      // An older server: no slot keeping at all.
      { flow: { handedOver: 640 } },
      // Counts without their shares.
      { slot: { inSlot: 512, outOfSlot: 96, noSlot: 32 } },
    ]
    for (const delivery of cases) {
      const [lane] = readLanes({ delivery, pickUp: {} }, DASH)
      expect(lane.slot?.drawn).toBe(false)
      expect(lane.slot?.segments.map((s) => s.id)).toEqual(['inSlot', 'outOfSlot', 'noSlot'])
    }
    const [older] = readLanes({ delivery: { flow: { handedOver: 640 } }, pickUp: {} }, DASH)
    expect(older.slot?.segments.map((s) => [s.value, s.share, s.count])).toEqual([
      [DASH, null, null],
      [DASH, null, null],
      [DASH, null, null],
    ])
    expect(readLanes(undefined, DASH)[0].slot?.drawn).toBe(false)
  })

  it('a pick-up has no slot split', () => {
    const [, pickUp] = readLanes(TRACKS, DASH)
    expect(pickUp.slot).toBeUndefined()
  })
})

describe('showsUnspecified', () => {
  it('the Unspecified tile shows only for a number above zero', () => {
    expect(showsUnspecified(3)).toBe(true)
    expect(showsUnspecified(0)).toBe(false)
    expect(showsUnspecified(undefined)).toBe(false)
    expect(showsUnspecified(null)).toBe(false)
    expect(showsUnspecified(Number.NaN)).toBe(false)
    expect(showsUnspecified('3')).toBe(false)
  })
})
