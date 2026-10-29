/**
 * Ticket 608 — the guard editor's pure edits. Groups nest up to three levels (K13; the top-level `when` group
 * is level 1, as in G-007's outer All of), and a 4th is refused; a rule's codes default from its first block
 * and follow it until the author edits them (K11).
 */
import { describe, expect, it } from 'vitest'
import { RULES } from '../../../tools/insurance-rules-stubs.mjs'
import type { GuardCondition, GuardRule } from './model'
import { addCondition, canAddGroup, codesAreDefault, codesOverriddenToNone, editRule, effectiveCodes, setCode, groupDepth, newCondition } from './guard-edit'

const g7 = RULES.find((r) => r.id === 'G-007')!
const group = (mode: 'all' | 'any', conditions: GuardCondition[] = []): GuardCondition => ({ check: 'group', mode, conditions })

describe('group depth', () => {
  it('groupDepth_refusesAFourthLevel', () => {
    // G-007: an All of (level 1) holding a NOT Any of (level 2).
    expect(groupDepth(g7.when)).toBe(2)
    expect(canAddGroup(g7.when, [])).toBe(true)
    expect(canAddGroup(g7.when, [0])).toBe(true)
    // A third level inside the Any of is allowed …
    expect(canAddGroup(g7.when, [0, 2])).toBe(true)
    const three = addCondition(g7.when, [0, 2], group('all'))
    expect(groupDepth(three)).toBe(3)
    // … a fourth is refused: the edit gives back the very same conditions.
    expect(canAddGroup(three, [0, 2, 2])).toBe(false)
    expect(addCondition(three, [0, 2, 2], group('any'))).toBe(three)
    // A leaf still goes into the third level.
    const leaf = addCondition(three, [0, 2, 2], { check: 'patient', inList: 'PL-X' })
    expect(leaf).not.toBe(three)
    expect(groupDepth(leaf)).toBe(3)
    // A group carrying its own sub-group may not be dropped where it would reach a 4th level either.
    expect(canAddGroup(g7.when, [0, 2], group('any', [group('all')]))).toBe(false)
    expect(addCondition(g7.when, [0, 2], group('any', [group('all')]))).toBe(g7.when)
  })
})

describe('default codes', () => {
  const blank: GuardRule = {
    id: 'G-100',
    name: { en: '', ar: '' },
    folder: '',
    state: 'draft',
    filters: [],
    when: [],
    onUnknown: 'none',
    then: [{ effect: 'guard', severity: 'OVERRIDE', says: { en: '', ar: '' }, codes: null, suggest: null }],
  }
  const codes = (r: GuardRule) => r.then[0].codes

  it('defaultCodes_followTheFirstBlock_untilEdited', () => {
    // A refill-too-soon block first: ER / CV-4-8.
    let r = editRule(blank, (x) => ({ ...x, when: [newCondition('supply')] }))
    expect(codes(r)).toEqual({ conflict: 'ER', nphies: 'CV-4-8' })
    // A second block does not change them: only the FIRST block decides.
    r = editRule(r, (x) => ({ ...x, when: [...x.when, newCondition('sfda')] }))
    expect(codes(r)).toEqual({ conflict: 'ER', nphies: 'CV-4-8' })
    // The first block becomes a same-item history: 83, no NPHIES code.
    r = editRule(r, (x) => ({ ...x, when: [{ check: 'history', match: 'sameItem', windowDays: 3, measure: 'dispenses', atLeast: 1, includeThisLine: false }, x.when[1]] }))
    expect(codes(r)).toEqual({ conflict: '83', nphies: null })
    // Same kind → ID, same class → TD; a first block inside a group still counts.
    r = editRule(r, (x) => ({ ...x, when: [group('all', [{ check: 'history', match: 'sameKind', windowDays: 30, measure: 'dispenses', atLeast: 2, includeThisLine: true }])] }))
    expect(codes(r)).toEqual({ conflict: 'ID', nphies: null })
    // The author edits the conflict code: from now on the codes are the author's.
    r = editRule(r, (x) => ({ ...x, then: [{ ...x.then[0], codes: { conflict: 'TD', nphies: 'CV-4-3' } }] }))
    r = editRule(r, (x) => ({ ...x, when: [newCondition('supply')] }))
    expect(codes(r)).toEqual({ conflict: 'TD', nphies: 'CV-4-3' })
  })

  describe('661 — an empty code box keeps the default', () => {
    const dup: GuardRule = {
      ...blank,
      when: [{ check: 'history', match: 'sameItem', windowDays: 14, measure: 'dispenses', atLeast: 1, includeThisLine: false }],
    }
    const withCodes = (c: GuardRule['then'][0]['codes']) => ({ ...dup.then[0], codes: c })

    it('clearing a box leaves the key out, never null; typing sets it', () => {
      const cleared = setCode({ conflict: '83', nphies: 'AD-2-4' }, 'conflict', '  ')
      expect(cleared).toEqual({ nphies: 'AD-2-4' })
      expect(cleared).not.toHaveProperty('conflict')
      expect(setCode(null, 'nphies', ' AD-2-4 ')).toEqual({ nphies: 'AD-2-4' })
    })

    it("the engine's reading: a left-out key is the default, a present null is no code", () => {
      expect(effectiveCodes(dup, withCodes({ nphies: 'AD-2-4' }))).toEqual({ conflict: '83', nphies: 'AD-2-4' })
      expect(effectiveCodes(dup, withCodes({ conflict: null, nphies: 'AD-2-4' }))).toEqual({ conflict: null, nphies: 'AD-2-4' })
      expect(effectiveCodes(dup, withCodes(null))).toEqual({ conflict: '83', nphies: null })
      expect(codesAreDefault(dup, withCodes({}))).toBe(true)
      expect(codesAreDefault(dup, withCodes({ nphies: 'AD-2-4' }))).toBe(false)
    })

    it("the owner's G-001 (conflict saved as null) is named as overriding 83; a null that equals the default is not", () => {
      expect(codesOverriddenToNone(dup, withCodes({ conflict: null, nphies: 'AD-2-4' }))).toEqual([{ key: 'conflict', fallback: '83' }])
      expect(codesOverriddenToNone(dup, withCodes({ conflict: '83', nphies: null }))).toEqual([])
      expect(codesOverriddenToNone(dup, withCodes({ nphies: 'AD-2-4' }))).toEqual([])
    })
  })

  it('reference blocks default too', () => {
    const first = (c: GuardCondition) => codes(editRule(blank, (x) => ({ ...x, when: [c] })))
    expect(first({ check: 'sfda', status: 'notMarketed' })).toEqual({ conflict: null, nphies: 'CV-4-10' })
    expect(first({ check: 'formulary', indication: 'notListed' })).toEqual({ conflict: null, nphies: 'CV-4-5' })
    expect(first({ check: 'line', field: 'daysSupply', above: 90 })).toEqual({ conflict: 'MX', nphies: 'CV-4-2' })
    // A block with no default leaves the codes as they were (none).
    expect(first({ check: 'patient', inList: 'PL-VIP' })).toBeNull()
  })
})
