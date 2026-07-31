/**
 * The slot picker's one derivation. Pure, because the defect it fixes is silent:
 * a picker that opens on the wrong day still looks like a picker, and the agent
 * reads the windows in front of them.
 */
import { describe, expect, it } from 'vitest'
import type { SessionSlot } from '@/core/models/callcenter'
import type { TimeSlotModel } from '@/core/models/slots'
import { initialDayIndex } from './slot-view'

const window_ = (slotId: string) => ({
  slotId,
  time: '10:00 AM - 12:00 PM',
  status: true,
  slotFrom: '2026-07-30T10:00:00',
  slotTo: '2026-07-30T12:00:00',
})

const DAYS: TimeSlotModel[] = [
  { day: 'THURSDAY', date: '2026/07/30', fullDay: '2026/07/30 THURSDAY', times: [window_('S1'), window_('S2')] },
  { day: 'FRIDAY', date: '2026/07/31', fullDay: '2026/07/31 FRIDAY', times: [window_('S3')] },
  { day: 'SATURDAY', date: '2026/08/01', fullDay: '2026/08/01 SATURDAY', times: [window_('S4'), window_('S5')] },
]

const held = (slotId: string): SessionSlot => ({ slotId, from: '10:00', to: '12:00', isActive: true })

describe('initialDayIndex', () => {
  it('opens on the day holding the slot the order already has', () => {
    // 🚩 The defect. Before the day row this was always 0, so an order with a
    // Saturday window opened on Thursday — and the *on this order* tick lived on
    // a day nobody was looking at.
    expect(initialDayIndex(DAYS, held('S4'))).toBe(2)
    expect(initialDayIndex(DAYS, held('S5'))).toBe(2)
    expect(initialDayIndex(DAYS, held('S3'))).toBe(1)
  })

  it('opens on the first day when the order holds no slot', () => {
    expect(initialDayIndex(DAYS, null)).toBe(0)
    expect(initialDayIndex(DAYS, undefined)).toBe(0)
    expect(initialDayIndex(DAYS, { ...held('S4'), slotId: '  ' })).toBe(0)
  })

  it('falls back to the first day when the held slot is not offered here', () => {
    // ⚠️ A real state, not a fault: the windows are read fresh at the ORDER's
    // store, so a slot picked before a store move belongs to a catalogue that is
    // no longer on screen. The agent is choosing again, and the first day is
    // where that starts.
    expect(initialDayIndex(DAYS, held('S99'))).toBe(0)
  })

  it('survives the shapes the read can be in before it answers', () => {
    expect(initialDayIndex(null, held('S4'))).toBe(0)
    expect(initialDayIndex([], held('S4'))).toBe(0)
    expect(initialDayIndex([{ ...DAYS[0], times: [] }], held('S4'))).toBe(0)
  })
})
