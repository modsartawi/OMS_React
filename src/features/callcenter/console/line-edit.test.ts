/**
 * The three corrections a call actually makes — quantity, unit of measure, void —
 * asserted at their edge (ticket 170): **what is worth sending**, **what one
 * correction's id discipline is**, and **which refusals the agent is owed words
 * for**.
 */
import { describe, expect, it } from 'vitest'
import {
  beginLineEdit,
  committingLineEdit,
  lineRefusalKey,
  nextQty,
  nextUom,
  reaskingLineEdit,
} from './line-edit'

describe('onlyARealCorrectionIsSent', () => {
  it('sends a quantity the agent actually changed', () => {
    expect(nextQty(2, '5')).toBe(5)
    expect(nextQty(2, ' 5 ')).toBe(5)
  })

  it('sends nothing when the quantity did not move', () => {
    // A blur that changed nothing is not a correction, and a round trip on a
    // live basket that re-prices for nothing is a stutter mid-call.
    expect(nextQty(2, '2')).toBeNull()
  })

  it('🚩 refuses to send zero or a negative — that is a void, and void is its own verb', () => {
    expect(nextQty(2, '0')).toBeNull()
    expect(nextQty(2, '-3')).toBeNull()
  })

  it('sends nothing it cannot read as a number', () => {
    for (const raw of ['', '   ', 'abc', '2 boxes', 'NaN', 'Infinity']) expect(nextQty(2, raw)).toBeNull()
  })

  it('🚩 leaves the per-line cap to the server', () => {
    // `QTY_INVALID` names *beyond the per-line cap* (§7) and the cap is the
    // engine's. A client-side ceiling would be a second opinion about a rule the
    // console cannot see — and would refuse an order the door would have taken.
    expect(nextQty(1, '9999')).toBe(9999)
  })

  it('sends a unit only where it is one the server offered, and a different one', () => {
    expect(nextUom({ uom: 'EA', uomOptions: ['EA', 'BOX'] }, 'BOX')).toBe('BOX')
    expect(nextUom({ uom: 'EA', uomOptions: ['EA', 'BOX'] }, 'EA')).toBeNull()
    // Nothing on the wire the projection did not offer: the options are the
    // item's, and a unit invented here would be a guaranteed UOM_NOT_AVAILABLE.
    expect(nextUom({ uom: 'EA', uomOptions: ['EA', 'BOX'] }, 'PAL')).toBeNull()
    expect(nextUom({ uom: 'EA', uomOptions: [] }, 'BOX')).toBeNull()
  })
})

describe('oneCorrectionKeepsOneRequestId', () => {
  it('reuses the id across the acceptance and the re-ask', () => {
    // The same discipline as the add and the rebind (§4) — a quantity RAISED
    // beyond availability takes 169's confirm path, and the acceptance must not
    // look like a second correction to the server's ledger.
    const edit = beginLineEdit({ kind: 'qty', lineId: 'L1', qty: 5 }, () => 'EDIT-1')
    expect(edit.requestId).toBe('EDIT-1')
    expect(edit.confirmToken).toBeUndefined()

    const committing = committingLineEdit(edit, 'TOKEN-A')
    expect(committing).toEqual({ ...edit, confirmToken: 'TOKEN-A' })

    const again = reaskingLineEdit(committing)
    expect(again.requestId).toBe('EDIT-1')
    expect('confirmToken' in again).toBe(false)
  })

  it('mints a new id for a genuinely new correction', () => {
    let n = 0
    const mint = () => `EDIT-${++n}`
    expect(beginLineEdit({ kind: 'void', lineId: 'L1' }, mint).requestId).not.toBe(
      beginLineEdit({ kind: 'void', lineId: 'L1' }, mint).requestId,
    )
  })

  it('carries what the sheet needs to name the line, and nothing else', () => {
    const edit = beginLineEdit({ kind: 'qty', lineId: 'L1', qty: 5, description: 'Panadol Extra' }, () => 'EDIT-1')
    expect(edit.description).toBe('Panadol Extra')
    // Law 1's shape: a correction carries an id, a line and an intent. Nothing
    // about money, and nothing the server did not ask for.
    expect(Object.keys(edit).sort()).toEqual(['description', 'kind', 'lineId', 'qty', 'requestId'])
  })
})

describe('aRefusedCorrectionIsExplained', () => {
  it('gives the three the contract names their own words', () => {
    // §7's own codes for this verb family. Each is a different fact for the
    // agent: a stale screen, a unit the item does not come in, a quantity the
    // engine will not take.
    expect(lineRefusalKey('LINE_NOT_FOUND')).toBe('LINE_NOT_FOUND')
    expect(lineRefusalKey('UOM_NOT_AVAILABLE')).toBe('UOM_NOT_AVAILABLE')
    expect(lineRefusalKey('QTY_INVALID')).toBe('QTY_INVALID')
  })

  it('🚩 leaves anything else to the server’s own sentence', () => {
    // A code this console has no words for must not be turned into a generic
    // one: the envelope's `message` is the considered answer, and inventing a
    // sentence over it is how a guardrail refusal reads as "unexpected".
    expect(lineRefusalKey('SOMETHING_NEW')).toBeNull()
    expect(lineRefusalKey(null)).toBeNull()
    expect(lineRefusalKey(undefined)).toBeNull()
  })
})
