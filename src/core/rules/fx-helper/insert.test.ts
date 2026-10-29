/**
 * Tickets 507 / oms 657 — the guided ƒx helper inserts at the cursor (moved from the promotion workspace's
 * `fx.test.ts` with the code), and a chip with a placeholder leaves it selected so typing replaces it.
 */
import { describe, expect, it } from 'vitest'
import { insertAtCursor, operatorChip } from './insert'

describe('insertAtCursor', () => {
  it('insertAtCursor_placesChipAndKeepsCaret', () => {
    // A field at the caret, the caret after it.
    expect(insertAtCursor('back > 0', { start: 0, end: 0 }, { text: 'spend' })).toEqual({ formula: 'spend back > 0', caret: 5 })
    // Over a selection: it replaces what was selected.
    expect(insertAtCursor('round(sum(eligible) * 10 / 100, decimals, halfUp)', { start: 6, end: 19 }, { text: 'spend' })).toEqual({
      formula: 'round(spend * 10 / 100, decimals, halfUp)',
      caret: 11,
    })
    // A function's snippet puts the caret inside it.
    expect(insertAtCursor('', null, { text: 'min(, 100)', caret: 4 })).toEqual({ formula: 'min(, 100)', caret: 4 })
    expect(insertAtCursor('spend', { start: 5, end: 5 }, { text: 'min(, 100)', caret: 4 })).toEqual({ formula: 'spend min(, 100)', caret: 10 })
    // No caret yet: at the end.
    expect(insertAtCursor('back', null, operatorChip('>='))).toEqual({ formula: 'back >= ', caret: 8 })
    // An operator next to a space does not double it.
    expect(insertAtCursor('back ', { start: 5, end: 5 }, operatorChip('*'))).toEqual({ formula: 'back * ', caret: 7 })
    expect(insertAtCursor('a b', { start: 1, end: 1 }, operatorChip('+'))).toEqual({ formula: 'a + b', caret: 4 })
    // Brackets come as a pair, the caret between them.
    expect(insertAtCursor('x', { start: 1, end: 1 }, operatorChip('('))).toEqual({ formula: 'x ()', caret: 3 })
    // A word before a word gets a space after too, so two names never run together.
    expect(insertAtCursor('back', { start: 0, end: 0 }, { text: 'spend' }).formula).toBe('spend back')
    // A caret past the end (the formula changed under it) is held to the end.
    expect(insertAtCursor('ab', { start: 9, end: 12 }, { text: 'c' })).toEqual({ formula: 'ab c', caret: 4 })
  })

  it('insertAtCursor_selectsTheSnippetsPlaceholder', () => {
    const chip = { text: 'eligibility.benefit[<code>].copayPct', caret: 20, select: 6 }
    // Into an empty box: `<code>` is selected.
    const empty = insertAtCursor('', null, chip)
    expect(empty).toEqual({ formula: 'eligibility.benefit[<code>].copayPct', caret: 20, end: 26 })
    expect(empty.formula.slice(empty.caret, empty.end)).toBe('<code>')
    // After an operator, mid-formula: the selection moves with the chip.
    const mid = insertAtCursor('line.price > ', { start: 13, end: 13 }, chip)
    expect(mid.formula).toBe('line.price > eligibility.benefit[<code>].copayPct')
    expect(mid.formula.slice(mid.caret, mid.end)).toBe('<code>')
    // After a name: the padding space shifts it too.
    const padded = insertAtCursor('not', { start: 3, end: 3 }, chip)
    expect(padded.formula).toBe('not eligibility.benefit[<code>].copayPct')
    expect(padded.formula.slice(padded.caret, padded.end)).toBe('<code>')
    // A chip with no placeholder answers no selection.
    expect('end' in insertAtCursor('', null, { text: 'patient.age' })).toBe(false)
  })

  it('a key in brackets ends a name: the next name gets its space', () => {
    expect(insertAtCursor('eligibility.tob[PH]', null, operatorChip('>'))).toEqual({ formula: 'eligibility.tob[PH] > ', caret: 22 })
    expect(insertAtCursor('eligibility.tob[PH]', null, { text: 'x' }).formula).toBe('eligibility.tob[PH] x')
  })
})
