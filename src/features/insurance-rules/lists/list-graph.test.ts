/**
 * Ticket 610 — an item list is the union of its filters, plus the lists it includes, minus the lists it
 * excludes, at most THREE lists deep; a list that reaches itself is a cycle. Both are refused BEFORE the
 * save (HQ refuses them again), so the author reads the path at fault instead of a 4xx.
 */
import { describe, expect, it } from 'vitest'
import type { GuardList } from '@/core/insurance-rules/model'
import { LIST_MAX_DEPTH, listProblems } from './list-graph'

const list = (id: string, include: string[] = [], exclude: string[] = []): GuardList => ({
  id,
  name: { en: id, ar: id },
  filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: ['E1497'] }] }],
  include,
  exclude,
})

describe('listProblems', () => {
  it('listCycle_isRefusedBeforeSave — a list that includes a list that includes it back', () => {
    const regular = list('regular', ['chronic'])
    const chronic = list('chronic', ['regular'])
    expect(listProblems(chronic, [regular], { isNew: false })).toEqual([{ kind: 'cycle', path: ['chronic', 'regular', 'chronic'] }])
  })

  it('a cycle through an EXCLUDED list is a cycle too, and a list may not name itself', () => {
    expect(listProblems(list('a', [], ['b']), [list('b', ['a'])], { isNew: false })).toEqual([{ kind: 'cycle', path: ['a', 'b', 'a'] }])
    expect(listProblems(list('a', ['a']), [], { isNew: false })).toEqual([{ kind: 'cycle', path: ['a', 'a'] }])
  })

  it('three lists deep is allowed; a fourth is refused, even when the edit is at the bottom', () => {
    expect(LIST_MAX_DEPTH).toBe(3)
    expect(listProblems(list('a', ['b']), [list('b', ['c']), list('c')], { isNew: false })).toEqual([])
    expect(listProblems(list('a', ['b']), [list('b', ['c']), list('c', ['d']), list('d')], { isNew: false })).toEqual([
      { kind: 'tooDeep', path: ['a', 'b', 'c', 'd'] },
    ])
    // Editing `c` to include `d` makes `a` four deep.
    expect(listProblems(list('c', ['d']), [list('a', ['b']), list('b', ['c']), list('d')], { isNew: false })).toEqual([
      { kind: 'tooDeep', path: ['a', 'b', 'c', 'd'] },
    ])
  })

  it('a list named that is not in the ruleset', () => {
    expect(listProblems(list('a', ['ghost']), [], { isNew: false })).toEqual([{ kind: 'unknownList', id: 'ghost' }])
  })

  it('a new list needs a free, well-formed id and a name in both languages', () => {
    const others = [list('glp1')]
    expect(listProblems({ ...list('glp1'), name: { en: 'x', ar: 'y' } }, others, { isNew: true })).toEqual([{ kind: 'idTaken' }])
    expect(listProblems(list('GLP 1!'), others, { isNew: true })).toEqual([{ kind: 'idInvalid' }])
    expect(listProblems({ ...list('pens'), name: { en: ' ', ar: 'أقلام' } }, others, { isNew: true })).toEqual([{ kind: 'nameMissing' }])
  })

  it('a field with no code, or a list that names nothing at all', () => {
    const noCodes: GuardList = { ...list('a'), filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', noneOf: [] }] }] }
    expect(listProblems(noCodes, [], { isNew: false })).toEqual([{ kind: 'emptyAttribute', filter: 0, attribute: 0 }])
    const empty: GuardList = { ...list('a'), filters: [] }
    expect(listProblems(empty, [], { isNew: false })).toEqual([{ kind: 'emptyDefinition' }])
  })
})
