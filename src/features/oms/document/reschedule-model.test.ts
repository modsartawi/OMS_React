import { describe, expect, it } from 'vitest'
import type { TimeSlotModel, TimeSlotTimeModel } from '@/core/models/slots'
import { canSaveReschedule, seedReschedule } from './reschedule-model'

const DAY = { date: '2026-11-28', day: 'Saturday', fullDay: 'Saturday 28 Nov', times: [] } as unknown as TimeSlotModel
const WINDOW = {
  slotId: 'S1',
  time: '15:00–18:00',
  slotFrom: '2026-11-28T15:00:00',
  slotTo: '2026-11-28T18:00:00',
  status: true,
} as unknown as TimeSlotTimeModel

describe('the reschedule dialog opens with no reason chosen (spec 4354, as the till does)', () => {
  it('seeds the first day once the slots land, but never a reason', () => {
    expect(seedReschedule({ dayIndex: '', reasonCode: '' }, 3)).toEqual({ dayIndex: '0', reasonCode: '' })
  })

  it('keeps what the user already chose', () => {
    expect(seedReschedule({ dayIndex: '2', reasonCode: 'CUST' }, 3)).toEqual({ dayIndex: '2', reasonCode: 'CUST' })
  })

  it('seeds no day when there is none', () => {
    expect(seedReschedule({ dayIndex: '', reasonCode: '' }, 0)).toEqual({ dayIndex: '', reasonCode: '' })
  })
})

describe('save is off until a reason is chosen', () => {
  const ready = { ready: true, day: DAY, time: WINDOW }

  it('is off with a day and a time but no reason', () => {
    expect(canSaveReschedule({ ...ready, reasonCode: '' })).toBe(false)
  })

  it('is off for a blank reason', () => {
    expect(canSaveReschedule({ ...ready, reasonCode: '   ' })).toBe(false)
  })

  it('is on once a reason is chosen', () => {
    expect(canSaveReschedule({ ...ready, reasonCode: 'CUST' })).toBe(true)
  })

  it('is off without a day or a time, or while the lists are not ready, even with a reason', () => {
    expect(canSaveReschedule({ ...ready, day: null, reasonCode: 'CUST' })).toBe(false)
    expect(canSaveReschedule({ ...ready, time: null, reasonCode: 'CUST' })).toBe(false)
    expect(canSaveReschedule({ ...ready, ready: false, reasonCode: 'CUST' })).toBe(false)
  })
})
