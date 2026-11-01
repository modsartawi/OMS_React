import { describe, expect, it } from 'vitest'
import { slotListDeliveryNo } from './reschedule'

describe('slotListDeliveryNo', () => {
  it('asks the slot list for a delivery by its number, so the list is capped at its limit', () => {
    expect(slotListDeliveryNo({ documentCategory: 'D', documentNo: '8000000253' })).toBe('8000000253')
  })

  it('sends no delivery for an order, whose list stays uncapped', () => {
    expect(slotListDeliveryNo({ documentCategory: 'O', documentNo: '100371607' })).toBeUndefined()
  })
})
