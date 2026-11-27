import { describe, expect, it } from 'vitest'
import type { ResultsLaterSlotsReply } from '@/core/models/sourcing-results'
import stub from './stub-tabs.json'
import { laterSlots } from './later-slots-model'

// `GET SourcingAdvisor/Results/LaterSlots` (BO 4393): orders with a slot, those with a later slot priced lower, all 24 hours.
const reply = stub.laterSlots as unknown as ResultsLaterSlotsReply

describe('laterSlots — the count by hour', () => {
  it('reads the sentence as sent: orders with a later slot cheaper, of the orders with a slot, and the share', () => {
    expect(laterSlots(reply).sentence).toEqual({ cheaper: 1318, withSlot: 16536, percent: 8.0 })
  })

  it('draws a bar per hour, 00 to 23, of the orders that had a later slot cheaper', () => {
    const hours = laterSlots(reply).hours
    expect(hours).toHaveLength(24)
    expect(hours[18]).toEqual({ hour: 18, label: '18', cheaper: 141, withSlot: 1732 })
    expect(hours[0]).toEqual({ hour: 0, label: '00', cheaper: 0, withSlot: 0 })
  })

  it('gives an hour the reply left out a bar at nought', () => {
    const short = { ...reply, byHour: reply.byHour.filter((h) => h.hour !== 3) }
    expect(laterSlots(short).hours[3]).toEqual({ hour: 3, label: '03', cheaper: 0, withSlot: 0 })
  })

  it('names the busiest hour and checks the hours add up to the count', () => {
    const m = laterSlots(reply)
    expect(m.peak).toBe(18)
    expect(m.addsUp).toBe(true)
    expect(laterSlots({ ...reply, laterSlotCheaper: 1319 }).addsUp).toBe(false)
  })

  it('reads a period with no later slot cheaper as empty', () => {
    const none = { ...reply, laterSlotCheaper: 0, percent: 0, byHour: reply.byHour.map((h) => ({ ...h, laterSlotCheaper: 0 })) }
    expect(laterSlots(none)).toMatchObject({ empty: true, peak: null })
  })
})
