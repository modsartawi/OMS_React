/**
 * Ticket 548 — the write-off reason words: a known code reads its key, an unknown one the code.
 */
import { describe, expect, it } from 'vitest'
import { PRESCRIPTION_WRITE_OFF_REASONS, writeOffReasonWord } from './words'

describe('writeOffReasonWord', () => {
  it('offers the four coded reasons in order', () => {
    expect([...PRESCRIPTION_WRITE_OFF_REASONS]).toEqual(['PAYER_REFUSED', 'SALE_LOST', 'GOODS_NEVER_LEFT', 'OTHER'])
  })
  it('a known reason reads its key', () => {
    expect(writeOffReasonWord('GOODS_NEVER_LEFT')).toEqual({ key: 'writeOffReason.GOODS_NEVER_LEFT', raw: 'GOODS_NEVER_LEFT' })
  })
  it('an unknown reason reads as the code', () => {
    expect(writeOffReasonWord('LOST_IN_SPACE')).toEqual({ key: null, raw: 'LOST_IN_SPACE' })
  })
})
