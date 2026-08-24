import { describe, expect, it } from 'vitest'
import { clampReturnQuantity, returnableLines, submitGate } from './return-order'
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
      uom: expect.any(String),
      unitPrice: expect.any(Number),
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

  it('never offers a struck line, and does not count it as one that came back', () => {
    // `deleted` lines render STRUCK in the Items grid rather than vanishing, so
    // they are visibly part of the delivery — but they are not goods a customer
    // can send back, and nothing was ever returned off them.
    const struck = [
      { ...DELIVERY_WITH_REMAINING.lines[0], quantity: 4, deleted: true },
      { ...DELIVERY_WITH_REMAINING.lines[1], quantity: 9, returnedQuantity: 5 },
    ]
    const projection = returnableLines(struck)
    expect(projection.rows.map((r) => r.lineNumber)).toEqual([20])
    expect(projection.hiddenCount).toBe(0)
    expect(projection.notReturnableCount).toBe(1)
  })

  it('treats a line delivered in no quantity the same way — nothing to give back, nothing taken', () => {
    const nothing = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 0 }]
    expect(returnableLines(nothing)).toEqual({
      rows: [],
      hiddenCount: 0,
      notReturnableCount: 1,
    })
  })

  it('projects an exhausted delivery to no rows at all', () => {
    const { rows, hiddenCount } = returnableLines(FULLY_RETURNED_LINES.lines)
    expect(rows).toEqual([])
    expect(hiddenCount).toBe(2)
  })

  it('clamps a remainder to what was delivered, and survives a document with no lines', () => {
    const overReturned = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 2, returnedQuantity: 5 }]
    expect(returnableLines(overReturned)).toEqual({ rows: [], hiddenCount: 1, notReturnableCount: 0 })
    // `returnedQuantity` is still an unconfirmed 1283 §2b spelling, so a
    // negative sign convention is a shape that could arrive. It must never
    // project a cap ABOVE what was delivered.
    const negative = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 4, returnedQuantity: -3 }]
    expect(returnableLines(negative).rows[0].remaining).toBe(4)
    expect(returnableLines(null)).toEqual({ rows: [], hiddenCount: 0, notReturnableCount: 0 })
    expect(returnableLines([])).toEqual({ rows: [], hiddenCount: 0, notReturnableCount: 0 })
  })
})

describe('clampReturnQuantity', () => {
  it('holds a stepper inside [1, remaining]', () => {
    expect(clampReturnQuantity(2, 4)).toBe(2)
    expect(clampReturnQuantity(0, 4)).toBe(1)
    expect(clampReturnQuantity(5, 4)).toBe(4)
    expect(clampReturnQuantity(4, 4)).toBe(4)
    expect(clampReturnQuantity(1, 4)).toBe(1)
  })

  it('holds TYPED input inside the same range — the keyboard is not a way round the stepper', () => {
    // Everything a quantity box can be handed: a paste, a sign, a cap breach,
    // a word, an empty box. None of them may leave the range.
    expect(clampReturnQuantity('0', 3)).toBe(1)
    expect(clampReturnQuantity('-2', 3)).toBe(1)
    expect(clampReturnQuantity('99', 3)).toBe(3)
    expect(clampReturnQuantity('abc', 3)).toBe(1)
    expect(clampReturnQuantity('', 3)).toBe(1)
    expect(clampReturnQuantity(null, 3)).toBe(1)
    expect(clampReturnQuantity(undefined, 3)).toBe(1)
    expect(clampReturnQuantity(Number.NaN, 3)).toBe(1)
    expect(clampReturnQuantity('2', 3)).toBe(2)
  })

  it('never returns zero, even when the line has nothing left', () => {
    // A row with nothing left is not rendered at all (the projection hides it),
    // so the low end wins over a zero cap rather than producing a zero quantity.
    expect(clampReturnQuantity(0, 0)).toBe(1)
    expect(clampReturnQuantity(9, 0)).toBe(1)
  })
})

describe('submitGate', () => {
  const picked = (quantity: number | null) => ({ picked: true, quantity })
  const unpicked = { picked: false, quantity: null }

  it('names the lines sentence when nothing is ticked', () => {
    expect(submitGate([unpicked, unpicked])).toEqual({
      ok: false,
      key: 'returnDocument.gate.selectLines',
    })
    expect(submitGate([])).toEqual({ ok: false, key: 'returnDocument.gate.selectLines' })
  })

  it('names the quantity sentence when a ticked line has a cleared quantity', () => {
    const outcome = submitGate([picked(2), picked(null), unpicked])
    // One complaint at a time, and in the order the operator must act: a line
    // IS ticked, so the lines sentence is answered and must not be repeated.
    expect(outcome).toEqual({ ok: false, key: 'returnDocument.gate.quantityAtLeastOne' })
    expect(outcome.key).not.toBe('returnDocument.gate.selectLines')
  })

  it('ignores the quantity on a line that is not ticked', () => {
    expect(submitGate([picked(1), { picked: false, quantity: null }]).ok).toBe(true)
  })

  it('treats a zero or negative ticked quantity as the same missing thing', () => {
    expect(submitGate([picked(0)]).key).toBe('returnDocument.gate.quantityAtLeastOne')
    expect(submitGate([picked(-1)]).key).toBe('returnDocument.gate.quantityAtLeastOne')
  })

  it('flips to a summary of what is selected once nothing is missing', () => {
    expect(submitGate([picked(2), picked(1)])).toEqual({
      ok: true,
      key: 'returnDocument.gate.summary',
      params: { count: 2 },
    })
  })

  it('returns a key and its parameters, never a sentence — t() lives at the call site', () => {
    for (const outcome of [submitGate([]), submitGate([picked(null)]), submitGate([picked(1)])]) {
      // A key, not prose: no spaces, no full stop, and namespaced under the
      // block the dialog's copy lives in.
      expect(outcome.key).toMatch(/^returnDocument\.gate\.[A-Za-z]+$/)
      expect(outcome.key).not.toContain(' ')
      const values = Object.values(outcome.params ?? {})
      expect(values.every((v) => typeof v === 'number')).toBe(true)
    }
  })
})
