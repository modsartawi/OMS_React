/**
 * Ticket 609 — a template's blanks become the rule's values. The template is 3093's "Duplicate dispense"
 * (`history` sameItem, windowDays «3», REFUSE, code 83) with its window a blank, plus an item-list blank; the
 * values are the author's. Expected rules are written out by hand from 3093, not rebuilt the way the code does.
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../../../tools/insurance-rules-stubs.mjs'
import { blankCandidates, fillTemplate, missingBlanks, templateIn, valueAt, type GuardTemplate } from './templates'

const DUPLICATE: GuardTemplate = {
  id: 'T-DUP',
  origin: 'phase1',
  name: { en: 'Duplicate dispense', ar: 'صرف مكرر' },
  conflictCode: '83',
  blanks: [
    { path: 'name', label: { en: 'Name', ar: 'الاسم' } },
    { path: 'filters[0].list', label: { en: 'Item list', ar: 'قائمة الأصناف' } },
    { path: 'when[0].windowDays', label: { en: 'Days back', ar: 'الأيام السابقة' } },
  ],
  rule: {
    id: '',
    name: { en: '', ar: '' },
    folder: 'Pharmacist conduct',
    state: 'live',
    shadowSince: '2026-10-01',
    window: { from: null, until: null },
    audience: { channels: ['nphies', 'waseel', 'oms', 'bupa'], stores: [] },
    filters: [{ id: 'items', list: '' }],
    when: [{ check: 'history', match: 'list:items', windowDays: 3, measure: 'dispenses', atLeast: 1, includeThisLine: false }],
    onUnknown: 'none',
    then: [
      {
        effect: 'guard',
        severity: 'REFUSE',
        says: { en: 'Already dispensed on {lastDispensedOn}', ar: 'صُرف مسبقاً بتاريخ {lastDispensedOn}' },
        codes: { conflict: '83', nphies: null },
        suggest: null,
      },
    ],
  },
}

describe('fillTemplate', () => {
  it('fillTemplate_blanksBecomeRuleValues', () => {
    const rule = fillTemplate(
      DUPLICATE,
      { name: { en: 'GLP-1 twice in a week', ar: 'GLP-1 مرتين في أسبوع' }, 'filters[0].list': 'glp1', 'when[0].windowDays': 7 },
      { id: 'G-012', folder: 'Specialty medicines/GLP-1' },
    )
    expect(rule).toEqual({
      id: 'G-012',
      name: { en: 'GLP-1 twice in a week', ar: 'GLP-1 مرتين في أسبوع' },
      folder: 'Specialty medicines/GLP-1',
      state: 'draft',
      window: { from: null, until: null },
      audience: { channels: ['nphies', 'waseel', 'oms', 'bupa'], stores: [] },
      filters: [{ id: 'items', list: 'glp1' }],
      when: [{ check: 'history', match: 'list:items', windowDays: 7, measure: 'dispenses', atLeast: 1, includeThisLine: false }],
      onUnknown: 'none',
      then: [
        {
          effect: 'guard',
          severity: 'REFUSE',
          says: { en: 'Already dispensed on {lastDispensedOn}', ar: 'صُرف مسبقاً بتاريخ {lastDispensedOn}' },
          codes: { conflict: '83', nphies: null },
          suggest: null,
        },
      ],
    })
  })

  it('an unfilled blank keeps the default; the folder defaults to the template rule’s', () => {
    const rule = fillTemplate(DUPLICATE, { 'filters[0].list': 'glp1' }, { id: 'G-012' })
    expect(rule.when[0]).toMatchObject({ windowDays: 3 })
    expect(rule.folder).toBe('Pharmacist conduct')
  })

  it('the draft is independent: editing it never touches the template', () => {
    const rule = fillTemplate(DUPLICATE, { 'filters[0].list': 'glp1' }, { id: 'G-012' })
    rule.filters[0].list = 'controlled'
    ;(rule.when[0] as { windowDays: number }).windowDays = 99
    rule.then[0].says.en = 'changed'
    expect(DUPLICATE.rule.filters[0].list).toBe('')
    expect(DUPLICATE.rule.when[0]).toMatchObject({ windowDays: 3 })
    expect(DUPLICATE.rule.then[0].says.en).toBe('Already dispensed on {lastDispensedOn}')
  })

  it('a value for a path that is not a blank is ignored', () => {
    const rule = fillTemplate(DUPLICATE, { 'then[0].severity': 'WARN', 'filters[0].list': 'glp1' }, { id: 'G-012' })
    expect(rule.then[0].severity).toBe('REFUSE')
  })
})

describe('missingBlanks', () => {
  it('names the blanks still empty: an empty list, a name without its Arabic', () => {
    expect(missingBlanks(DUPLICATE, { name: { en: 'X', ar: '' } })).toEqual(['name', 'filters[0].list'])
    expect(missingBlanks(DUPLICATE, { name: { en: 'X', ar: 'س' }, 'filters[0].list': 'glp1' })).toEqual([])
  })
})

describe('blankCandidates', () => {
  it('offers the name, every typed value of the conditions and each message by the path HQ reads — never a filter or a block kind', () => {
    const g007 = {
      ...DUPLICATE.rule,
      id: 'G-007',
      filters: [{ id: 'glp1', list: 'glp1' }],
      when: [
        {
          check: 'group' as const,
          mode: 'all' as const,
          conditions: [
            { check: 'line' as const, inList: 'glp1' },
            { check: 'formulary' as const, indication: 'listed' as const, not: true },
            { check: 'patient' as const, inList: 'PL-VIP' },
            { check: 'history' as const, match: 'sameItem' as const, windowDays: 3, measure: 'dispenses' as const, atLeast: 1, includeThisLine: false },
          ],
        },
      ],
    }
    // 618: HQ stores no `filters` (a blank there is refused): the line's list itself is the blank.
    expect(blankCandidates(g007).map((c) => c.path)).toEqual([
      'name',
      'when[0].conditions[0].inList',
      'when[0].conditions[2].inList',
      'when[0].conditions[3].windowDays',
      'when[0].conditions[3].atLeast',
      'then[0].says',
    ])
  })
})

describe('blankCandidates — request blocks switch on field', () => {
  it('offers a policy / class list as a blank, never a payer read by codes or a list on a field that takes none', () => {
    const r = {
      ...DUPLICATE.rule,
      when: [
        { check: 'request' as const, field: 'policy', inList: 'sabic-policies' },
        { check: 'request' as const, field: 'class', inList: 'CL-GOLD' },
        { check: 'request' as const, field: 'payer', anyOf: ['0001100041'] },
        { check: 'request' as const, field: 'channel', inList: 'nonsense' },
      ],
    }
    expect(blankCandidates(r).map((c) => c.path).filter((p) => p.startsWith('when'))).toEqual(['when[0].inList', 'when[1].inList'])
  })
})

describe("the drive's phase-1 templates (3093), as GET …/Templates serves them (618)", () => {
  it('every blank path points at a value of its rule, read as the gallery reads it, and each template has a name blank', () => {
    for (const reply of TEMPLATES) {
      const t = templateIn(reply)
      expect([t.id, t.origin, t.blanks[0]?.path]).toEqual([t.id, 'phase1', 'name'])
      for (const b of t.blanks) expect([t.id, b.path, valueAt(t.rule, b.path) !== undefined]).toEqual([t.id, b.path, true])
    }
  })
})
