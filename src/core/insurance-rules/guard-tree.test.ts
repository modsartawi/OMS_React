/**
 * oms 658 — the IF tree is rearranged without starting over: a condition moves (into a group, out of one, up,
 * down), sibling conditions are wrapped in a new group, a group is ungrouped, a condition is duplicated. Every
 * refusal (into itself, a 4th level, a NOT group ungrouped) gives back the SAME conditions, so the history pushes
 * no step; a move is one step Undo takes back.
 */
import { describe, expect, it } from 'vitest'
import { editorHistory, initialEditorHistory } from './editor-history'
import {
  duplicateCondition,
  editRule,
  groupsToMoveInto,
  moveCondition,
  moveDown,
  moveIntoGroup,
  moveOutOfGroup,
  moveRefusal,
  moveUp,
  newGuardRule,
  ungroup,
  ungroupRefusal,
  withWhen,
  wrapInGroup,
} from './guard-edit'
import type { GuardCondition } from './model'

const leaf = (n: number): GuardCondition => ({ check: 'line', field: 'daysSupply', above: n })
const all = (...conditions: GuardCondition[]): GuardCondition => ({ check: 'group', mode: 'all', conditions })
const any = (...conditions: GuardCondition[]): GuardCondition => ({ check: 'group', mode: 'any', conditions })
/** A tree as a short string: numbers for leaves, A(...) / O(...) for All of / Any of, ! for NOT. */
const shape = (cs: readonly GuardCondition[]): string =>
  cs.map((c) => (c.not ? '!' : '') + (c.check === 'group' ? `${c.mode === 'all' ? 'A' : 'O'}(${shape(c.conditions)})` : String((c as { above: number }).above))).join(' ')

describe('moveCondition', () => {
  // 1 2 A(3 4) 5
  const tree = [leaf(1), leaf(2), all(leaf(3), leaf(4)), leaf(5)]

  it('moveCondition_movesIntoAGroupOutOfOneAndAlongItsList', () => {
    expect(shape(moveCondition(tree, [0], [2], 1))).toBe('2 A(3 1 4) 5')
    expect(shape(moveCondition(tree, [3], [2], 0))).toBe('1 2 A(5 3 4)')
    expect(shape(moveCondition(tree, [2, 1], [], 0))).toBe('4 1 2 A(3) 5')
    expect(shape(moveCondition(tree, [2, 0], [], 4))).toBe('1 2 A(4) 5 3')
    // An index into the list as it is before the move: between 2 and A(...) is index 2, from either side.
    expect(shape(moveCondition(tree, [0], [], 2))).toBe('2 1 A(3 4) 5')
    expect(shape(moveCondition(tree, [3], [], 2))).toBe('1 2 5 A(3 4)')
    // A whole group moves with what is in it.
    expect(shape(moveCondition(tree, [2], [], 0))).toBe('A(3 4) 1 2 5')
  })

  it('a move to where it already is changes nothing', () => {
    expect(moveCondition(tree, [1], [], 1)).toBe(tree)
    expect(moveCondition(tree, [1], [], 2)).toBe(tree)
  })

  it('moveCondition_refusesAGroupIntoItselfOrUnderItself', () => {
    const nested = [all(leaf(1), any(leaf(2)))]
    expect(moveRefusal(nested, [0], [0], 0)).toBe('self')
    expect(moveRefusal(nested, [0], [0, 1], 0)).toBe('self')
    expect(moveCondition(nested, [0], [0, 1], 0)).toBe(nested)
    // ...but a leaf of it may move into its sibling group.
    expect(shape(moveCondition(nested, [0, 0], [0, 1], 1))).toBe('A(O(2 1))')
  })

  it('moveCondition_refusesAFourthLevel', () => {
    // A(A(A(1))) is three levels; a group dropped into the innermost one would be a 4th.
    const deep = [all(all(all(leaf(1)))), any(leaf(2))]
    expect(moveRefusal(deep, [1], [0, 0, 0], 0)).toBe('tooDeep')
    expect(moveCondition(deep, [1], [0, 0, 0], 0)).toBe(deep)
    // A two-level group into a level-2 list: 2 + 2 > 3.
    const two = [all(all(leaf(1))), all(any(leaf(2)))]
    expect(moveRefusal(two, [1], [0, 0], 0)).toBe('tooDeep')
    expect(moveRefusal(two, [1], [0], 0)).toBeNull()
    // A leaf goes anywhere.
    expect(shape(moveCondition(deep, [1, 0], [0, 0, 0], 1))).toBe('A(A(A(1 2))) O()')
    expect(moveRefusal(deep, [5], [], 0)).toBe('missing')
    expect(moveRefusal(deep, [1], [3], 0)).toBe('missing')
  })
})

describe('the move tools', () => {
  const tree = [leaf(1), all(leaf(2), leaf(3)), leaf(4)]
  it('up, down, out of its group, into a sibling group', () => {
    expect(shape(moveUp(tree, [2]))).toBe('1 4 A(2 3)')
    expect(moveUp(tree, [0])).toBe(tree)
    expect(shape(moveDown(tree, [0]))).toBe('A(2 3) 1 4')
    expect(moveDown(tree, [2])).toBe(tree)
    expect(shape(moveDown(tree, [1, 0]))).toBe('1 A(3 2) 4')
    expect(shape(moveOutOfGroup(tree, [1, 0]))).toBe('1 A(3) 2 4')
    expect(moveOutOfGroup(tree, [0])).toBe(tree)
    expect(shape(moveIntoGroup(tree, [0], [1]))).toBe('A(2 3 1) 4')
    expect(shape(moveIntoGroup(tree, [2], [1]))).toBe('1 A(2 3 4)')
    expect(groupsToMoveInto(tree, [0])).toEqual([[1]])
    expect(groupsToMoveInto(tree, [1])).toEqual([])
  })
})

describe('wrapInGroup', () => {
  const tree = [leaf(1), leaf(2), leaf(3), leaf(4)]
  it('wrapInGroup_putsSelectedSiblingsInANewGroupAtTheFirstOnesPlace', () => {
    expect(shape(wrapInGroup(tree, [[3], [1]], 'any'))).toBe('1 O(2 4) 3')
    expect(shape(wrapInGroup(tree, [[0]], 'all'))).toBe('A(1) 2 3 4')
    expect(shape(wrapInGroup([all(leaf(1), leaf(2))], [[0, 0], [0, 1]], 'any'))).toBe('A(O(1 2))')
  })
  it('refuses conditions of different lists, none, or a 4th level', () => {
    const mixed = [leaf(1), all(leaf(2))]
    expect(wrapInGroup(mixed, [[0], [1, 0]], 'all')).toBe(mixed)
    expect(wrapInGroup(tree, [], 'all')).toBe(tree)
    const deep = [all(all(leaf(1), all(leaf(2))))]
    expect(wrapInGroup(deep, [[0, 0, 1]], 'any')).toBe(deep)
    expect(shape(wrapInGroup(deep, [[0, 0, 0]], 'any'))).toBe('A(A(O(1) A(2)))')
  })
})

describe('ungroup and duplicate', () => {
  it('ungroup_putsTheGroupsConditionsInItsPlace', () => {
    const tree = [leaf(1), any(leaf(2), all(leaf(3))), leaf(4)]
    expect(shape(ungroup(tree, [1]))).toBe('1 2 A(3) 4')
    expect(shape(ungroup(tree, [1, 1]))).toBe('1 O(2 3) 4')
    expect(ungroup(tree, [0])).toBe(tree)
  })
  it('ungroup_refusesANotGroup', () => {
    const tree = [{ ...any(leaf(1), leaf(2)), not: true }]
    expect(ungroupRefusal(tree, [0])).toBe('negated')
    expect(ungroup(tree, [0])).toBe(tree)
  })
  it('duplicate puts a copy right after it, a group with what is in it', () => {
    const tree = [leaf(1), all(leaf(2))]
    const out = duplicateCondition(tree, [1])
    expect(shape(out)).toBe('1 A(2) A(2)')
    expect(out[2]).not.toBe(out[1])
    expect(duplicateCondition(tree, [7])).toBe(tree)
  })
})

describe('a move in the editor', () => {
  it('is one step Undo takes back; a refused one is no step', () => {
    const rule = { ...newGuardRule('G-900'), when: [leaf(1), all(leaf(2))] }
    const edit = (fn: (w: GuardCondition[]) => GuardCondition[]) => ({ type: 'edit' as const, edit: (r: typeof rule) => editRule(r, (x) => withWhen(x, fn(x.when))) })
    let h = initialEditorHistory(rule)
    h = editorHistory(h, edit((w) => moveIntoGroup(w, [0], [1])))
    expect(shape(h.present.when)).toBe('A(2 1)')
    expect(h.past).toHaveLength(1)
    const same = editorHistory(h, edit((w) => moveCondition(w, [0], [0], 0)))
    expect(same).toBe(h)
    h = editorHistory(h, { type: 'undo' })
    expect(shape(h.present.when)).toBe('1 A(2)')
  })

  it('codes follow the new first block only while they were the default', () => {
    const days = { check: 'line', field: 'daysSupply', above: 90 } as GuardCondition // MX / CV-4-2
    const sfda = { check: 'sfda', status: 'notMarketed' } as GuardCondition // CV-4-10
    const base = newGuardRule('G-901')
    const rule = editRule(base, (r) => ({ ...r, when: [days, sfda] }))
    expect(rule.then[0].codes).toEqual({ conflict: 'MX', nphies: 'CV-4-2' })
    const moved = editRule(rule, (r) => ({ ...r, when: moveUp(r.when, [1]) }))
    expect(moved.then[0].codes).toEqual({ conflict: null, nphies: 'CV-4-10' })
    const typed = { ...rule, then: [{ ...rule.then[0], codes: { conflict: 'DC', nphies: 'CV-4-5' } }] }
    expect(editRule(typed, (r) => ({ ...r, when: moveUp(r.when, [1]) })).then[0].codes).toEqual({ conflict: 'DC', nphies: 'CV-4-5' })
  })
})
