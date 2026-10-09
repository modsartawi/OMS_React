/**
 * Ticket 451 — `levelCascade`: the A → E filters cascade downward only. Changing A re-asks the
 * levels below with A as a filter and drops any B/C/D/E choice no longer offered; picking a level
 * never touches the levels above it.
 */
import { describe, expect, it } from 'vitest'
import type { MaterialLevelValue } from '@/core/models/materials'
import { cascade, levelsAbove, pickLevel, pruneLevel } from './level-cascade'
import { emptyLevels, type LevelChoices } from './search-query'

const v = (...codes: string[]): MaterialLevelValue[] => codes.map((code) => ({ code, description: code + ' desc' }))
const levels = (over: Partial<LevelChoices>): LevelChoices => ({ ...emptyLevels(), ...over })

describe('levelsAbove — what a level is asked with', () => {
  it('A is asked with nothing', () => {
    expect(levelsAbove(levels({ A: ['A006'], B: ['B010'] }), 'A')).toEqual({})
  })

  it('C is asked with A and B, never with C, D or E', () => {
    expect(levelsAbove(levels({ A: ['A006', 'A008'], B: ['B010'], C: ['C1'], D: ['D1'], E: ['E1'] }), 'C')).toEqual({
      aLevel: ['A006', 'A008'],
      bLevel: ['B010'],
    })
  })

  it('a level above with no choice is left off', () => {
    expect(levelsAbove(levels({ B: ['B010'] }), 'D')).toEqual({ bLevel: ['B010'] })
  })
})

describe('pickLevel — never touches the levels above', () => {
  it('picking C leaves A and B exactly as they were', () => {
    const before = levels({ A: ['A006'], B: ['B010', 'B011'], C: ['C1'] })
    const after = pickLevel(before, 'C', ['C2', 'C3'])
    expect(after.A).toBe(before.A)
    expect(after.B).toBe(before.B)
    expect(after.C).toEqual(['C2', 'C3'])
  })

  it('picking A keeps the lower choices until their options are known', () => {
    const after = pickLevel(levels({ A: ['A006'], B: ['B010'] }), 'A', ['A008'])
    expect(after).toEqual(levels({ A: ['A008'], B: ['B010'] }))
  })

  it('never keeps the empty code, nor a code twice', () => {
    expect(pickLevel(emptyLevels(), 'B', ['', 'B1', 'B1']).B).toEqual(['B1'])
  })
})

describe('pruneLevel / cascade — changing A drops what is no longer offered', () => {
  it('drops a B choice the new A no longer offers, and keeps one it does', () => {
    const picked = pickLevel(levels({ A: ['A006'], B: ['B010', 'B020'] }), 'A', ['A008'])
    expect(pruneLevel(picked, 'B', v('B020', 'B030')).B).toEqual(['B020'])
  })

  it('returns the same object when nothing is dropped, so the cascade settles', () => {
    const l = levels({ A: ['A006'], B: ['B010'] })
    expect(pruneLevel(l, 'B', v('B010', 'B011'))).toBe(l)
  })

  it('changing A drops every B/C/D/E choice no longer offered, all the way down', () => {
    const before = levels({ A: ['A006'], B: ['B010'], C: ['C1', 'C2'], D: ['D1'], E: ['E1', 'E2'] })
    const picked = pickLevel(before, 'A', ['A008'])
    // The options under the NEW A (and under B/C/D after their own pruning).
    const after = cascade(picked, {
      B: v('B030'),
      C: v('C2', 'C9'),
      D: v('D7'),
      E: v('E2'),
    })
    expect(after).toEqual(levels({ A: ['A008'], B: [], C: ['C2'], D: [], E: ['E2'] }))
  })

  it('the cascade never touches a level above the one whose options changed', () => {
    const l = levels({ A: ['A006'], B: ['B010'], C: ['C1'] })
    // Only C's options are known; A and B are left alone even though no list was given for them.
    const after = cascade(l, { C: v('C2') })
    expect(after.A).toBe(l.A)
    expect(after.B).toBe(l.B)
    expect(after.C).toEqual([])
  })

  it('a level whose options are not known yet is not pruned', () => {
    const l = levels({ A: ['A006'], B: ['B010'] })
    expect(cascade(l, {})).toBe(l)
  })
})
