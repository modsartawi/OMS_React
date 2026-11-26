import { describe, expect, it } from 'vitest'
import type { ResultsLaterSlotsReply } from '@/core/models/sourcing-results'
import stub from './stub-tabs.json'
import { laterSlots } from './later-slots-model'

// The drive's stub: the results prototype's later-slot count, most orders coming in at night.
const reply = (over: Partial<ResultsLaterSlotsReply> = {}): ResultsLaterSlotsReply => ({ ...stub.laterSlots, ...over })

describe('laterSlots — the count by hour', () => {
  it('reads the sentence off the reply as sent', () => {
    expect(laterSlots(reply()).sentence).toEqual({ orders: 2447, slotOrders: 27550, percent: 8.9, middleLaterMinutes: 120 })
  })

  it('gives every hour of the day a bar, 00 to 23, an hour the reply left out at nought', () => {
    const { hours } = laterSlots(reply())
    expect(hours.map((h) => h.hour)).toEqual([...Array(24).keys()])
    expect(hours.map((h) => h.label).slice(0, 3)).toEqual(['00', '01', '02'])
    expect(hours[5]).toEqual({ hour: 5, label: '05', orders: 0 })
    expect(hours[0].orders).toBe(210)
    expect(hours[23].orders).toBe(195)
  })

  it('puts hours sent out of order back in order', () => {
    const { hours } = laterSlots(reply({ byHour: [...stub.laterSlots.byHour].reverse() }))
    expect(hours.slice(20).map((h) => h.orders)).toEqual([67, 119, 158, 195])
  })

  it('names the busiest hour', () => {
    expect(laterSlots(reply()).peak).toBe(0)
    expect(laterSlots(reply({ byHour: [{ hour: 14, orders: 9 }, { hour: 22, orders: 30 }] })).peak).toBe(22)
  })

  it('says whether the hours add up to the count', () => {
    expect(laterSlots(reply()).addsUp).toBe(true)
    expect(laterSlots(reply({ orders: 2448 })).addsUp).toBe(false)
  })

  it('ignores an hour outside the day', () => {
    const { hours } = laterSlots(reply({ byHour: [{ hour: 24, orders: 5 }, { hour: -1, orders: 3 }, { hour: 9, orders: 4 }], orders: 4 }))
    expect(hours.reduce((n, h) => n + h.orders, 0)).toBe(4)
  })

  it('draws no bar and names no busiest hour when no order had a cheaper later slot', () => {
    const empty = laterSlots(reply({ orders: 0, percent: 0, byHour: [] }))
    expect(empty.empty).toBe(true)
    expect(empty.peak).toBeNull()
    expect(empty.hours.every((h) => h.orders === 0)).toBe(true)
  })
})
