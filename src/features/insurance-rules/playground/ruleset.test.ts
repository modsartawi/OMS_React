/**
 * Ticket 679 — the Rule pane's mini ruleset: the document read into the editors' rules and printed back, and a
 * reader error's path placed on the block it names.
 */
import { describe, expect, it } from 'vitest'
import { errorAtBlock, moveSlot, printRuleset, readRuleset, rulesetIssues } from './ruleset'

const DOC = {
  schema: 1,
  kind: 'guard',
  revision: 0,
  fields: [],
  lists: [{ id: 'L-1', name: { en: 'Insulin', ar: 'إنسولين' }, filters: [], include: [], exclude: [] }],
  rules: [
    {
      id: 'G-1',
      name: { en: 'Long supply', ar: 'صرف طويل' },
      onUnknown: 'none',
      when: [
        { check: 'line', field: 'daysSupply', above: 90 },
        { check: 'patient', field: 'age', atLeast: 18 },
      ],
      then: [{ effect: 'guard', severity: 'WARN', says: { en: 'Long', ar: 'طويل' } }],
    },
    {
      id: 'G-2',
      when: [{ check: 'group', mode: 'any', conditions: [{ check: 'line', inList: 'L-1' }] }],
      then: [],
    },
  ],
}

describe('rulesetRoundTrip', () => {
  it('a guard document read into the editors and printed back is the same document', () => {
    const read = readRuleset('guard', JSON.stringify(DOC))
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.slots.map((s) => s.editable)).toEqual([true, true])
    expect(JSON.parse(printRuleset(read))).toEqual(DOC)
  })

  it('a rule guard-wire cannot read back stays JSON-only and is kept byte-for-byte', () => {
    const odd = { id: 'G-9', onUnknown: 'block', when: [{ check: 'line', field: 'daysSupply', above: 1 }], then: [], zeta: 1, alpha: [2] }
    const doc = { ...DOC, rules: [odd, DOC.rules[0]] }
    const read = readRuleset('guard', JSON.stringify(doc))
    if (!read.ok) throw new Error('should read')
    expect(read.slots.map((s) => s.editable)).toEqual([false, true])
    // An editor edit on the other rule, then the move of the odd rule last: the odd rule's text is unchanged.
    const moved = { ...read, slots: moveSlot(read.slots, 0, 1) }
    const printed = JSON.parse(printRuleset(moved))
    expect(printed.rules[1]).toEqual(odd)
    expect(JSON.stringify(printed.rules[1])).toBe(JSON.stringify(odd))
    expect(printed.rules[0]).toEqual(DOC.rules[0])
  })

  it('a rule with a block or an effect the editors do not draw is JSON-only', () => {
    const doc = { ...DOC, rules: [{ ...DOC.rules[0], when: [{ check: 'bogus' }] }, { ...DOC.rules[0], then: [{ effect: 'other' }] }] }
    const read = readRuleset('guard', JSON.stringify(doc))
    expect(read.ok && read.slots.map((s) => s.editable)).toEqual([false, false])
  })

  it('an editor edit writes the rule in the engine spelling and adds no default the rule did not have', () => {
    const read = readRuleset('guard', JSON.stringify(DOC))
    if (!read.ok) throw new Error('should read')
    const slot = read.slots[0]
    if (!slot.editable) throw new Error('editable')
    const edited = { ...slot, rule: { ...slot.rule, when: [{ check: 'line' as const, field: 'daysSupply', below: 30 }] } }
    const printed = JSON.parse(printRuleset({ ...read, slots: [edited, read.slots[1]] }))
    expect(printed.rules[0]).toEqual({ ...DOC.rules[0], when: [{ check: 'line', field: 'daysSupply', under: 30 }] })
  })

  it('a document that is not a JSON object, or has a rules value that is not an array, does not read', () => {
    expect(readRuleset('guard', '{').ok).toBe(false)
    expect(readRuleset('guard', '[]').ok).toBe(false)
    expect(readRuleset('guard', '{"rules":3}').ok).toBe(false)
    const none = readRuleset('guard', '{"schema":1}')
    expect(none.ok && none.slots).toEqual([])
  })
})

describe('errorAtBlock', () => {
  const read = readRuleset('guard', JSON.stringify(DOC))
  if (!read.ok) throw new Error('should read')
  const slots = read.slots

  it('rules[0].when[1].expr maps to rule 0, condition path [1], field expr', () => {
    expect(errorAtBlock('rules[0].when[1].expr', slots)).toEqual({ rule: 0, section: 'when', path: [1], field: 'expr' })
  })

  it('a nested block, an effect field and the rule itself', () => {
    expect(errorAtBlock('rules[1].when[0].conditions[0].inList', slots)).toEqual({ rule: 1, section: 'when', path: [0, 0], field: 'inList' })
    expect(errorAtBlock('rules[0].then[0].says.en', slots)).toEqual({ rule: 0, section: 'then', path: [0], field: 'says.en' })
    expect(errorAtBlock('rules[0].name.ar', slots)).toEqual({ rule: 0, section: null, path: [], field: 'name.ar' })
    expect(errorAtBlock('rules[1]', slots)).toEqual({ rule: 1, section: null, path: [], field: null })
  })

  it('a path into nothing shown maps to none', () => {
    expect(errorAtBlock('rules[5].when[0]', slots)).toBeNull()
    expect(errorAtBlock('rules[0].when[7].field', slots)).toBeNull()
    expect(errorAtBlock('rules[0].then[3]', slots)).toBeNull()
    expect(errorAtBlock('lists[0].filters', slots)).toBeNull()
    expect(errorAtBlock('', slots)).toBeNull()
    const odd = readRuleset('guard', JSON.stringify({ ...DOC, rules: [{ id: 'X', onUnknown: 'block', when: [], then: [] }] }))
    if (!odd.ok) throw new Error('should read')
    expect(errorAtBlock('rules[0].when[0]', odd.slots)).toBeNull()
  })
})

describe('rulesetIssues', () => {
  it('places each error on its rule as an issue in the editors spelling, and keeps the rest', () => {
    const read = readRuleset('guard', JSON.stringify(DOC))
    if (!read.ok) throw new Error('should read')
    const errors = [
      { path: 'rules[0].when[0].under', message: 'bad bound' },
      { path: 'rules[0].when[1].atLeast', message: 'bad age' },
      { path: 'lists[0]', message: 'bad list' },
    ]
    const { perRule, rest } = rulesetIssues(errors, read.slots)
    expect(rest).toEqual([{ path: 'lists[0]', message: 'bad list' }])
    expect(perRule[1]).toEqual([])
    expect(perRule[0]).toEqual([
      { ruleId: 'G-1', blockPath: 'when[0]', field: 'below', severity: 'error', en: 'bad bound', ar: 'bad bound' },
      { ruleId: 'G-1', blockPath: 'when[1]', field: 'value', severity: 'error', en: 'bad age', ar: 'bad age' },
    ])
  })
})
