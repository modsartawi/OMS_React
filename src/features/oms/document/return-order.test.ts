import { describe, expect, it } from 'vitest'
import { returnableLines } from './return-order'
import { DELIVERY_WITH_REMAINING, FULLY_RETURNED_LINES } from './__fixtures__/return-lines'
import { DOCUMENT_NUMBERS, PAYLOADS } from './__fixtures__/payloads'

describe('returnableLines', () => {
  it('reports remaining as delivered minus returned, and omits a line with nothing left', () => {
    const { rows, hiddenCount } = returnableLines(DELIVERY_WITH_REMAINING.lines)
    expect(rows.map((r) => r.lineNumber)).toEqual([10, 20])
    expect(rows.map((r) => r.remaining)).toEqual([4, 4])
    // The fully-returned line is not a row — it is the tally.
    expect(hiddenCount).toBe(1)
  })

  it('reports an untouched line at its full delivered quantity', () => {
    const untouched = returnableLines(DELIVERY_WITH_REMAINING.lines).rows[0]
    expect(untouched).toEqual({
      lineNumber: 10,
      itemNumber: '208713',
      itemDescription: expect.any(String),
      delivered: 4,
      returned: 0,
      remaining: 4,
    })
  })

  it('handles a non-trivial history — two earlier partial returns', () => {
    // Delivered 9, returns of 2 then 3 already taken: the answer is 4, which is
    // neither the delivered quantity, nor zero, nor the last return's quantity.
    const partly = returnableLines(DELIVERY_WITH_REMAINING.lines).rows[1]
    expect(partly.delivered).toBe(9)
    expect(partly.returned).toBe(5)
    expect(partly.remaining).toBe(4)
    expect(partly.remaining).not.toBe(partly.delivered)
    expect(partly.remaining).not.toBe(0)
    expect(partly.remaining).not.toBe(3)
  })

  it('treats a missing returnedQuantity as nothing returned — never NaN', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      const lines = PAYLOADS[documentNo].lines
      // The captures carry no `returnedQuantity` at all — the live shape today.
      expect(lines.every((l) => l.returnedQuantity === undefined)).toBe(true)
      for (const row of returnableLines(lines).rows) {
        expect(Number.isNaN(row.returned)).toBe(false)
        expect(Number.isNaN(row.remaining)).toBe(false)
        expect(row.returned).toBe(0)
        expect(row.remaining).toBe(row.delivered)
      }
    }
  })

  it('projects an exhausted delivery to no rows at all', () => {
    const { rows, hiddenCount } = returnableLines(FULLY_RETURNED_LINES.lines)
    expect(rows).toEqual([])
    expect(hiddenCount).toBe(2)
  })

  it('clamps a remainder to what was delivered, and survives a document with no lines', () => {
    const overReturned = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 2, returnedQuantity: 5 }]
    expect(returnableLines(overReturned)).toEqual({ rows: [], hiddenCount: 1 })
    // `returnedQuantity` is still an unconfirmed 1283 §2b spelling, so a
    // negative sign convention is a shape that could arrive. It must never
    // project a cap ABOVE what was delivered.
    const negative = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 4, returnedQuantity: -3 }]
    expect(returnableLines(negative).rows[0].remaining).toBe(4)
    expect(returnableLines(null)).toEqual({ rows: [], hiddenCount: 0 })
    expect(returnableLines([])).toEqual({ rows: [], hiddenCount: 0 })
  })
})
