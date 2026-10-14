import { describe, expect, it } from 'vitest'
import type { DeliveryStatisticsTracks } from '@/core/models/delivery-statistics'
import { MISSES, readMissesRows } from './misses-rows'

const DASH = '—'

const tracks = (
  delivery: DeliveryStatisticsTracks['delivery']['misses'],
  pickUp: DeliveryStatisticsTracks['pickUp']['misses'],
): DeliveryStatisticsTracks => ({
  delivery: { flow: { cameIn: 700 }, misses: delivery },
  pickUp: { flow: { cameIn: 520 }, misses: pickUp },
})

const read = (t: DeliveryStatisticsTracks | null | undefined) => {
  const rows = readMissesRows(t, DASH)
  return Object.fromEntries(rows.map((r) => [r.track, r.misses.map((m) => [m.id, m.value])]))
}

describe('readMissesRows', () => {
  it('the Delivery row always shows all five misses', () => {
    // Sent, in the till's order.
    expect(read(tracks({ returnedBack: 21, rejected: 4, rescheduled: 9, closeRequested: 1, closedOrCancelled: 1200 }, {})).delivery).toEqual([
      ['returnedBack', '21'],
      ['rejected', '4'],
      ['rescheduled', '9'],
      ['closeRequested', '1'],
      ['closedOrCancelled', '1,200'],
    ])
    // Each at 0: still all five, each a real 0.
    expect(read(tracks({ returnedBack: 0, rejected: 0, rescheduled: 0, closeRequested: 0, closedOrCancelled: 0 }, {})).delivery).toEqual(
      MISSES.map((id) => [id, '0']),
    )
    // Each absent: still all five, each the dash, never 0.
    expect(read(tracks({}, {})).delivery).toEqual(MISSES.map((id) => [id, DASH]))
  })

  it('the Pick-up row hides Returned back, Rejected and Rescheduled at zero or absent and shows them when not zero', () => {
    // At zero: only the two that can happen to a pick-up.
    expect(read(tracks({}, { returnedBack: 0, rejected: 0, rescheduled: 0, closeRequested: 3, closedOrCancelled: 6 })).pickUp).toEqual([
      ['closeRequested', '3'],
      ['closedOrCancelled', '6'],
    ])
    // Absent: hidden too; the two always shown read the dash.
    expect(read(tracks({}, {})).pickUp).toEqual([
      ['closeRequested', DASH],
      ['closedOrCancelled', DASH],
    ])
    // Not zero: bad data stays visible, in the till's order.
    expect(read(tracks({}, { returnedBack: 0, rejected: 2, rescheduled: 0, closeRequested: 0, closedOrCancelled: 0 })).pickUp).toEqual([
      ['rejected', '2'],
      ['closeRequested', '0'],
      ['closedOrCancelled', '0'],
    ])
    expect(read(tracks({}, { returnedBack: 1, rejected: 2, rescheduled: 3, closeRequested: 4, closedOrCancelled: 5 })).pickUp).toEqual([
      ['returnedBack', '1'],
      ['rejected', '2'],
      ['rescheduled', '3'],
      ['closeRequested', '4'],
      ['closedOrCancelled', '5'],
    ])
  })

  // 🚩 A server older than 2658 (no `tracks`) or a 2658 one (tracks without misses) is not a quiet day.
  it('no tracks, or tracks without misses, reads the dash on both rows, never 0', () => {
    const noMisses = { delivery: { flow: { cameIn: 700 } }, pickUp: { flow: { cameIn: 520 } } } as DeliveryStatisticsTracks
    for (const t of [undefined, null, noMisses, { delivery: {}, pickUp: {} } as DeliveryStatisticsTracks]) {
      expect(read(t)).toEqual({
        delivery: MISSES.map((id) => [id, DASH]),
        pickUp: [
          ['closeRequested', DASH],
          ['closedOrCancelled', DASH],
        ],
      })
    }
  })

  it('reads each row from its own track, Delivery first', () => {
    const rows = readMissesRows(tracks({ closeRequested: 1 }, { closeRequested: 3 }), DASH)
    expect(rows.map((r) => r.track)).toEqual(['delivery', 'pickUp'])
    expect(rows[0].misses.find((m) => m.id === 'closeRequested')?.value).toBe('1')
    expect(rows[1].misses.find((m) => m.id === 'closeRequested')?.value).toBe('3')
  })
})
