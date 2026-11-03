import { describe, expect, it } from 'vitest'
import { DEMO_ORDER_NO, lateExample } from './demo'

describe('the demo order (owner ask, D12)', () => {
  it('copilotDemo_unsetKeepsThePlaceholderSelected', () => {
    // Ticket 731 sets the number; until then the example keeps "X", selected to be typed over.
    expect(DEMO_ORDER_NO).toBe('')
    expect(lateExample('', 'X')).toEqual({ orderNo: 'X', select: 'X' })
    expect(lateExample('   ', 'X')).toEqual({ orderNo: 'X', select: 'X' })
  })

  it('copilotDemo_setNamesTheDemoOrder', () => {
    expect(lateExample('7000123456', 'X')).toEqual({ orderNo: '7000123456', select: null })
    expect(lateExample(' 7000123456 ', 'X')).toEqual({ orderNo: '7000123456', select: null })
  })
})
