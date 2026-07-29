/**
 * The keyboard highlight, asserted at its edge (ticket 191): **which press arms
 * it**, what a new question does to it, and the one gate that makes it inert.
 *
 * 🚩 Every case here is about a key that can put a line on a LIVE order, so the
 * negatives are the point: nothing highlighted until a press, nothing carried
 * over a new term, nothing at all while the door is shut.
 */
import { describe, expect, it } from 'vitest'
import { NO_HIGHLIGHT, highlightMoveOf, highlightedRow, moveHighlight } from './highlight'

/** The rows a press is measured against. `armed` is the ONE gate. */
const rows = (count: number, term = 'panadol', armed = true) => ({ count, term, armed })

describe('theFirstPressArmsIt', () => {
  it('starts with nothing highlighted — a landed result set aims at no row', () => {
    expect(highlightedRow(NO_HIGHLIGHT, rows(3))).toBeNull()
  })

  it('↓ from nothing highlights the FIRST row', () => {
    const moved = moveHighlight(NO_HIGHLIGHT, rows(3), 'down')
    expect(highlightedRow(moved, rows(3))).toBe(0)
  })

  // 🚩 The ruling, asserted so it is a decision and not an accident: ↑ from
  // nothing highlights NOTHING. Wrapping to the last row would arm `Enter` on
  // the least relevant guess of a non-sargable LIKE — the exact add the
  // two-key grammar exists to prevent.
  it('↑ from nothing highlights nothing — it does not wrap to the last row', () => {
    const moved = moveHighlight(NO_HIGHLIGHT, rows(3), 'up')
    expect(highlightedRow(moved, rows(3))).toBeNull()
  })

  it('↓ walks down and stops at the last row rather than wrapping to the first', () => {
    let state = moveHighlight(NO_HIGHLIGHT, rows(2), 'down')
    state = moveHighlight(state, rows(2), 'down')
    expect(highlightedRow(state, rows(2))).toBe(1)
    state = moveHighlight(state, rows(2), 'down')
    expect(highlightedRow(state, rows(2))).toBe(1)
  })

  // The way out is the key that came in: ↑ off the first row disarms `Enter`
  // again rather than parking on a row the agent is walking away from.
  it('↑ off the first row returns to nothing highlighted', () => {
    const first = moveHighlight(NO_HIGHLIGHT, rows(3), 'down')
    expect(highlightedRow(moveHighlight(first, rows(3), 'up'), rows(3))).toBeNull()
  })

  it('reads the two arrow keys and nothing else', () => {
    expect(highlightMoveOf('ArrowDown')).toBe('down')
    expect(highlightMoveOf('ArrowUp')).toBe('up')
    expect(highlightMoveOf('Enter')).toBeNull()
    expect(highlightMoveOf('Escape')).toBeNull()
    expect(highlightMoveOf('j')).toBeNull()
  })
})

describe('aNewQuestionResetsIt', () => {
  it('🚩 a new term drops the highlight — a stale one adds the wrong item', () => {
    const state = moveHighlight(NO_HIGHLIGHT, rows(3, 'panadol'), 'down')
    expect(highlightedRow(state, rows(3, 'aspirin'))).toBeNull()
  })

  it('and the next ↓ on the new term starts at its first row, not where it left off', () => {
    let state = moveHighlight(NO_HIGHLIGHT, rows(3, 'panadol'), 'down')
    state = moveHighlight(state, rows(3, 'panadol'), 'down')
    expect(highlightedRow(state, rows(3, 'panadol'))).toBe(1)
    const next = moveHighlight(state, rows(3, 'aspirin'), 'down')
    expect(highlightedRow(next, rows(3, 'aspirin'))).toBe(0)
  })

  it('🚩 a shorter result set CLAMPS rather than pointing past the end', () => {
    let state = moveHighlight(NO_HIGHLIGHT, rows(5), 'down')
    state = moveHighlight(state, rows(5), 'down')
    state = moveHighlight(state, rows(5), 'down')
    expect(highlightedRow(state, rows(5))).toBe(2)
    // The same term, re-answered with fewer rows (the catalogue moved under a
    // long call): the last row, never row 2 of a two-row list.
    expect(highlightedRow(state, rows(2))).toBe(1)
  })

  it('an emptied result set highlights nothing at all', () => {
    const state = moveHighlight(NO_HIGHLIGHT, rows(3), 'down')
    expect(highlightedRow(state, rows(0))).toBeNull()
  })
})

describe('itIsInertWhileTheDoorIsShut', () => {
  it('🚩 nothing is highlighted while the gate is shut — so `Enter` reaches no row', () => {
    const state = moveHighlight(NO_HIGHLIGHT, rows(3), 'down')
    expect(highlightedRow(state, rows(3, 'panadol', false))).toBeNull()
  })

  it('and the arrows themselves do nothing while it is shut', () => {
    const shut = rows(3, 'panadol', false)
    expect(moveHighlight(NO_HIGHLIGHT, shut, 'down')).toEqual(NO_HIGHLIGHT)
    expect(highlightedRow(moveHighlight(NO_HIGHLIGHT, shut, 'down'), rows(3))).toBeNull()
  })

  // An add in flight is the same shut door — the panel holds every row's button
  // while one add runs, and the keyboard obeys exactly that, never a second
  // predicate of its own.
  it('an add in flight is the same shut door, and the highlight returns when it lands', () => {
    const state = moveHighlight(NO_HIGHLIGHT, rows(3), 'down')
    expect(highlightedRow(state, rows(3, 'panadol', false))).toBeNull()
    expect(highlightedRow(state, rows(3, 'panadol', true))).toBe(0)
  })
})
