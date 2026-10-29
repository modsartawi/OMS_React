/** Ticket 659 — the editor's own checks: a code in the wrong box, and a name another rule already has. */
import { describe, expect, it } from 'vitest'
import { checkCodes, codesHoldSave, sameNamedRules } from './rule-checks'

describe('checkCodes', () => {
  it('a NPHIES code in the conflict box holds the save (the owner typed AD-2-4 there on the walk)', () => {
    expect(checkCodes({ conflict: 'AD-2-4', nphies: null })).toEqual([{ field: 'conflict', problem: 'nphiesInConflict', blocks: true }])
    expect(checkCodes({ conflict: 'N-DC-067' })).toEqual([{ field: 'conflict', problem: 'nphiesInConflict', blocks: true }])
  })
  it('a conflict code in the NPHIES box holds the save', () => {
    expect(checkCodes({ conflict: null, nphies: '83' })).toEqual([{ field: 'nphies', problem: 'conflictInNphies', blocks: true }])
  })
  it('the right codes in the right boxes pass, in any case, and empty boxes pass', () => {
    expect(checkCodes({ conflict: 'ER', nphies: 'CV-4-8' })).toEqual([])
    expect(checkCodes({ conflict: '83', nphies: 'ad-2-4' })).toEqual([])
    expect(checkCodes({ conflict: null, nphies: null })).toEqual([])
    expect(checkCodes(undefined)).toEqual([])
  })
  it('an unknown shape only warns', () => {
    expect(checkCodes({ conflict: 'ABC', nphies: 'X1' })).toEqual([
      { field: 'conflict', problem: 'conflictShape', blocks: false },
      { field: 'nphies', problem: 'conflictInNphies', blocks: true },
    ])
    expect(checkCodes({ nphies: 'REFILL' })).toEqual([{ field: 'nphies', problem: 'nphiesShape', blocks: false }])
  })
  it('codesHoldSave reads every effect', () => {
    expect(codesHoldSave({ then: [{ codes: { conflict: 'ER' } }, { codes: { conflict: 'AD-2-4' } }] } as never)).toBe(true)
    expect(codesHoldSave({ then: [{ codes: { nphies: 'AD-2-4' } }] } as never)).toBe(false)
  })
})

describe('sameNamedRules', () => {
  const rules = [
    { id: 'G-001', name: { en: 'Duplicate dispense', ar: 'صرف مكرر' } },
    { id: 'G-002', name: { en: ' duplicate DISPENSE ', ar: 'صرف حسب الأولوية' } },
    { id: 'G-003', name: { en: 'Other', ar: 'صرف مكرر' } },
    { id: 'G-004', name: { en: '', ar: '' } },
  ]
  it('names the other rules with the same English or Arabic name, trimmed and in any case', () => {
    expect(sameNamedRules(rules[0], rules)).toEqual({ en: ['G-002'], ar: ['G-003'] })
  })
  it('never counts the rule itself, and a blank name matches nothing', () => {
    expect(sameNamedRules(rules[3], [...rules, { id: 'G-005', name: { en: '', ar: '' } }])).toEqual({ en: [], ar: [] })
    expect(sameNamedRules(rules[2], [rules[2]])).toEqual({ en: [], ar: [] })
  })
})
