import { describe, expect, it } from 'vitest'
import type { DeliveryStatistics } from '@/core/models/delivery-statistics'
import { comparedWindow, readHeadline } from './headline'

const DASH = '—'

/** A full answer, as a server with every spec-811 field sends it. Its figures do not add up on purpose. */
const FULL: Pick<DeliveryStatistics, 'flow' | 'tracks' | 'avgDeliveryMinutes' | 'previous'> = {
  flow: { cameIn: 1234, delivered: 640, pickedUp: 455, handedOver: 1093 },
  tracks: {
    delivery: {
      flow: { cameIn: 702, handedOver: 640 },
      slot: { inSlot: 512, outOfSlot: 96, noSlot: 32, inSlotShare: 0.842, outOfSlotShare: 0.158 },
      deliveredPerTrip: 1.56,
      avgDeliveryMinutes: 41.5,
    },
    pickUp: { flow: { cameIn: 529, handedOver: 455 }, avgDeliveryMinutes: 31.5 },
  },
  avgDeliveryMinutes: 38.2,
  previous: {
    from: '2026-10-30',
    to: '2026-10-30',
    until: '09:35',
    cameIn: { value: 1187, change: 47, changePct: 0.0396 },
    handedOver: { value: 1100, change: -7, changePct: -0.0064 },
    inSlotShare: { value: 0.842, change: 0, changePct: 0 },
    outOfSlotShare: { value: 0, change: 0.158, changePct: null },
    deliveredPerTrip: { value: 1.61, change: -0.05, changePct: -0.031 },
    avgDeliveryMinutes: { value: 44, change: -5.8, changePct: -0.1318 },
  },
}

describe('readHeadline', () => {
  it('headline model reads the six figures and their change as sent', () => {
    const tiles = readHeadline(FULL, DASH)

    expect(tiles.map((t) => t.id)).toEqual(['cameIn', 'handedOver', 'inSlot', 'outOfSlot', 'deliveredPerTrip', 'avgDeliveryMinutes'])
    expect(tiles.map((t) => t.value)).toEqual([1234, 1093, 0.842, 0.158, 1.56, 38.2])
    expect(tiles.map((t) => t.previous)).toEqual([1187, 1100, 0.842, 0, 1.61, 44])
    // The server's own subtraction and percentage, the arrow from the sign of `change`.
    expect(tiles.map((t) => t.delta)).toEqual([
      { abs: 47, pct: 0.0396, direction: 'up' },
      { abs: -7, pct: -0.0064, direction: 'down' },
      { abs: 0, pct: 0, direction: 'flat' },
      // A zero previous: no percentage, and the server's change stays as sent.
      { abs: 0.158, pct: null, direction: 'up' },
      { abs: -0.05, pct: -0.031, direction: 'down' },
      { abs: -5.8, pct: -0.1318, direction: 'down' },
    ])
  })

  it("Handed over carries the till's Delivered | Picked up split; In slot and Out of slot their n of N delivered", () => {
    const byId = Object.fromEntries(readHeadline(FULL, DASH).map((t) => [t.id, t]))

    expect(byId.handedOver.sub).toEqual({ kind: 'split', delivered: '640', pickedUp: '455' })
    // N is the Delivery track's Delivered (its hand-over), not the store-wide Handed over.
    expect(byId.inSlot.sub).toEqual({ kind: 'ofDelivered', n: '512', total: '640' })
    expect(byId.outOfSlot.sub).toEqual({ kind: 'ofDelivered', n: '96', total: '640' })
    for (const id of ['cameIn', 'deliveredPerTrip', 'avgDeliveryMinutes']) expect(byId[id].sub).toBeUndefined()
  })

  it('headline model reads dash, never 0, for an older server', () => {
    // No `previous`, no `slot`, no `deliveredPerTrip`, no `avgDeliveryMinutes` anywhere; no tracks either.
    const tiles = readHeadline({ flow: { cameIn: 0, delivered: 0, pickedUp: 0, handedOver: 0 } }, DASH)
    const byId = Object.fromEntries(tiles.map((t) => [t.id, t]))

    // A real 0 reads 0.
    expect(byId.cameIn.value).toBe(0)
    expect(byId.handedOver.value).toBe(0)
    // An absent figure is no value (the tile's dash), never 0.
    for (const id of ['inSlot', 'outOfSlot', 'deliveredPerTrip', 'avgDeliveryMinutes']) expect(byId[id].value).toBeNull()
    // No previous block: no change line on any tile.
    expect(tiles.every((t) => t.delta === null && t.previous === null)).toBe(true)
    expect(byId.inSlot.sub).toEqual({ kind: 'ofDelivered', n: DASH, total: DASH })
    expect(byId.handedOver.sub).toEqual({ kind: 'split', delivered: '0', pickedUp: '0' })
  })

  it("an absent share (nothing delivered: 0 of 0) reads no value, and a figure with no `change` draws no change line", () => {
    const tiles = readHeadline(
      {
        flow: { cameIn: 3, handedOver: 0 },
        tracks: { delivery: { flow: { handedOver: 0 }, slot: { inSlot: 0, outOfSlot: 0, noSlot: 0 }, deliveredPerTrip: null, avgDeliveryMinutes: null }, pickUp: {} },
        avgDeliveryMinutes: null,
        previous: { from: '2026-10-29', to: '2026-11-04', cameIn: { value: 0, changePct: null }, handedOver: { value: 2, change: null, changePct: 0.5 } },
      },
      DASH,
    )
    const byId = Object.fromEntries(tiles.map((t) => [t.id, t]))

    expect(byId.inSlot.value).toBeNull()
    expect(byId.inSlot.sub).toEqual({ kind: 'ofDelivered', n: '0', total: '0' })
    expect(byId.deliveredPerTrip.value).toBeNull()
    expect(byId.avgDeliveryMinutes.value).toBeNull()
    // A previous figure without the server's `change` is no change line, even with a percentage.
    expect(byId.cameIn.delta).toBeNull()
    expect(byId.handedOver.delta).toBeNull()
    // A previous block without a figure: no change line.
    expect(byId.inSlot.delta).toBeNull()
  })
})

describe('comparedWindow', () => {
  it('names Today\'s window as its day up to the cut-off time', () => {
    expect(comparedWindow({ from: '2026-10-30', to: '2026-10-30', until: '09:35' })).toEqual({ kind: 'until', day: '2026-10-30', time: '09:35' })
    // A cut-off sent as a full local time reads as its HH:mm.
    expect(comparedWindow({ from: '2026-10-30', to: '2026-10-30', until: '2026-10-30T09:35:00' })).toEqual({ kind: 'until', day: '2026-10-30', time: '09:35' })
  })

  it('names a closed window as its day, or its range as one value', () => {
    expect(comparedWindow({ from: '2026-10-29', to: '2026-10-29' })).toEqual({ kind: 'range', range: '2026-10-29' })
    expect(comparedWindow({ from: '2026-10-23', to: '2026-10-29' })).toEqual({ kind: 'range', range: '2026-10-23 – 2026-10-29' })
  })

  it('names nothing when the server sent no previous block', () => {
    expect(comparedWindow(undefined)).toBeNull()
  })
})
