import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsTracks } from '@/core/models/delivery-statistics'
import { readLanes, showsUnspecified } from './lanes'

const DASH = '—'

const TRACKS: DeliveryStatisticsTracks = {
  delivery: {
    flow: { cameIn: 700, madeReady: 650, outForDelivery: 380, trips: 412, handedOver: 640 },
    misses: { returnedBack: 21, rejected: 0, rescheduled: 9, closeRequested: 1, closedOrCancelled: 12 },
    avgHandOverMinutes: 96.25,
  },
  pickUp: {
    flow: { cameIn: 520, madeReady: 470, handedOver: 455 },
    misses: { returnedBack: 0, rejected: 0, rescheduled: 0, closeRequested: 3, closedOrCancelled: 5 },
    avgHandOverMinutes: 31.5,
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
    expect(delivery.average).toEqual({ value: '96.25', hasUnit: true })

    expect(pickUp.track).toBe('pickUp')
    // A pick-up never goes out: three stages, no Out for delivery, ending at Picked up.
    expect(pickUp.stages.map((s) => [s.id, s.value])).toEqual([
      ['cameIn', '520'],
      ['madeReady', '470'],
      ['pickedUp', '455'],
    ])
    expect(pickUp.stages.every((s) => s.trips === undefined)).toBe(true)
    expect(pickUp.average).toEqual({ value: '31.5', hasUnit: true })
  })

  it('a real 0 reads 0, an average of 0 included', () => {
    const [delivery, pickUp] = readLanes(
      {
        delivery: { flow: { cameIn: 0, madeReady: 0, outForDelivery: 0, trips: 0, handedOver: 0 }, avgHandOverMinutes: 0 },
        pickUp: { flow: { cameIn: 0, madeReady: 0, handedOver: 0 }, avgHandOverMinutes: 0 },
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
        delivery: { flow: { cameIn: 700, madeReady: 650, outForDelivery: 380, handedOver: 640 }, avgHandOverMinutes: null },
        pickUp: { flow: { cameIn: 520, madeReady: 470, handedOver: 455 } },
      },
      DASH,
    )
    expect(delivery.stages[2]).toEqual({ id: 'outForDelivery', value: '380', trips: DASH })
    // A unit beside the dash would read as a value: only a number carries one.
    expect(delivery.average).toEqual({ value: DASH, hasUnit: false })
    expect(pickUp.average).toEqual({ value: DASH, hasUnit: false })
    expect(pickUp.stages.map((s) => s.value)).toEqual(['520', '470', '455'])
  })

  it('🚩 a pick-up lane never shows an Out for delivery, even if a server sent one', () => {
    const odd = { ...TRACKS, pickUp: { flow: { ...TRACKS.pickUp.flow, outForDelivery: 2 } } } as unknown as DeliveryStatisticsTracks
    const [, pickUp] = readLanes(odd, DASH)
    expect(pickUp.stages.map((s) => s.id)).toEqual(['cameIn', 'madeReady', 'pickedUp'])
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
