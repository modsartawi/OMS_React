/**
 * Ticket 679 — the Rule pane's mini ruleset: the document read into the editors' rules and printed back, and a
 * reader error's path placed on the block it names.
 */
import { describe, expect, it } from 'vitest'
import { addSlot, errorAtBlock, moveSlot, printRuleset, readRuleset, rulesetIssues, rulesetLists } from './ruleset'

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

  it('a name and onUnknown edited in the editors are printed, and read back from the JSON into the editors', () => {
    const read = readRuleset('guard', JSON.stringify(DOC))
    if (!read.ok) throw new Error('should read')
    const [a, b] = read.slots
    if (!a.editable || !b.editable) throw new Error('editable')
    const named = { ...b, rule: { ...b.rule, name: { en: 'Insulin any', ar: 'أي إنسولين' }, onUnknown: 'warn' as const } }
    const renamed = { ...a, rule: { ...a.rule, name: { ...a.rule.name, en: 'Very long supply' } } }
    const text = printRuleset({ ...read, slots: [renamed, named] })
    const printed = JSON.parse(text)
    expect(printed.rules[0]).toEqual({ ...DOC.rules[0], name: { en: 'Very long supply', ar: 'صرف طويل' } })
    expect(printed.rules[1]).toEqual({ ...DOC.rules[1], name: { en: 'Insulin any', ar: 'أي إنسولين' }, onUnknown: 'warn' })
    // …and the JSON read back draws them in the editors.
    const back = readRuleset('guard', text)
    if (!back.ok) throw new Error('should read')
    const rules = back.slots.map((s) => (s.editable ? s.rule : null))
    expect(rules.map((r) => r?.name.en)).toEqual(['Very long supply', 'Insulin any'])
    expect(rules.map((r) => r?.onUnknown)).toEqual(['none', 'warn'])
  })

  it('onUnknown set back to none on a rule that had none drops it again (no default added)', () => {
    const read = readRuleset('guard', JSON.stringify(DOC))
    if (!read.ok) throw new Error('should read')
    const b = read.slots[1]
    if (!b.editable) throw new Error('editable')
    const warned = { ...b, rule: { ...b.rule, onUnknown: 'warn' as const } }
    const again = { ...warned, rule: { ...warned.rule, onUnknown: 'none' as const } }
    expect(JSON.parse(printRuleset({ ...read, slots: [read.slots[0], again] })).rules[1]).toEqual(DOC.rules[1])
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

// ── 680: coverage and category ──────────────────────────────────────────────────────────────

const LISTS = [{ id: 'L-INS', name: { en: 'Insulin', ar: 'إنسولين' }, filters: [{ articles: ['200021'], categories: [], attributes: [] }], include: [], exclude: [] }]

const COVERAGE = {
  schema: 1,
  kind: 'coverage',
  revision: 0,
  fields: [],
  lists: LISTS,
  rules: [
    { id: 'C-1', name: { en: 'Insulin cap', ar: 'سقف' }, when: [{ check: 'line', inList: 'L-INS' }], then: [{ effect: 'quantityCap', value: 1 }] },
    { id: 'C-2', when: [{ check: 'line', field: 'daysSupply', under: 30 }], then: [{ effect: 'deductible', percent: 10, overridesPayer: true }] },
  ],
}

const CATEGORY = {
  schema: 1,
  kind: 'category',
  revision: 0,
  rules: [
    { id: 'K-1', name: { en: 'Long', ar: 'طويل' }, when: [{ check: 'line', field: 'daysSupply', above: 90 }], then: [{ effect: 'setCategory', group: 'G2' }] },
    { id: 'K-2', state: 'live', when: [], then: [{ effect: 'setCategory', group: 'G3' }] },
  ],
}

describe('rulesetRoundTrip — coverage and category', () => {
  it('a coverage document is read into the editors and printed back unchanged, its lists kept', () => {
    const read = readRuleset('coverage', JSON.stringify(COVERAGE))
    if (!read.ok) throw new Error('should read')
    expect(read.slots.map((s) => s.editable)).toEqual([true, true])
    expect(JSON.stringify(JSON.parse(printRuleset(read)))).toBe(JSON.stringify(COVERAGE))
  })

  it('a category document is read into the editors and printed back unchanged', () => {
    const read = readRuleset('category', JSON.stringify(CATEGORY))
    if (!read.ok) throw new Error('should read')
    expect(read.slots.map((s) => s.editable)).toEqual([true, true])
    expect(JSON.stringify(JSON.parse(printRuleset(read)))).toBe(JSON.stringify(CATEGORY))
  })

  it('moving a category rule first is the only change printed', () => {
    const read = readRuleset('category', JSON.stringify(CATEGORY))
    if (!read.ok) throw new Error('should read')
    const printed = JSON.parse(printRuleset({ ...read, slots: moveSlot(read.slots, 1, 0) }))
    expect(printed).toEqual({ ...CATEGORY, rules: [CATEGORY.rules[1], CATEGORY.rules[0]] })
  })

  it('an editor edit of a coverage rule prints in the engine spelling and keeps its lists', () => {
    const read = readRuleset<{ id: string; when: unknown[]; then: unknown[] }>('coverage', JSON.stringify(COVERAGE))
    if (!read.ok) throw new Error('should read')
    const s = read.slots[1]
    if (!s.editable) throw new Error('editable')
    const edited = { ...s, rule: { ...s.rule, when: [{ check: 'line', field: 'daysSupply', below: 14 }] } }
    const printed = JSON.parse(printRuleset({ ...read, slots: [read.slots[0], edited] }))
    expect(printed.lists).toEqual(LISTS)
    expect(printed.rules[1]).toEqual({ ...COVERAGE.rules[1], when: [{ check: 'line', field: 'daysSupply', under: 14 }] })
  })

  it('an unknown block, an unknown effect or an effect the editors do not draw keeps the rule JSON-only, byte-for-byte', () => {
    const odd = [
      { id: 'C-7', when: [{ check: 'mystery', zeta: 1 }], then: [{ effect: 'covered', value: true }] },
      { id: 'C-8', when: [], then: [{ effect: 'refund', value: 3 }] },
      { id: 'C-9', when: [], then: [{ effect: 'quantityCap', value: 'one' }] },
      { id: 'C-10', when: [], then: [{ effect: 'covered', value: true }, { effect: 'covered', value: false }] },
    ]
    const doc = { ...COVERAGE, rules: [...odd, COVERAGE.rules[0]] }
    const read = readRuleset('coverage', JSON.stringify(doc))
    if (!read.ok) throw new Error('should read')
    expect(read.slots.map((s) => s.editable)).toEqual([false, false, false, false, true])
    expect(JSON.stringify(JSON.parse(printRuleset(read)))).toBe(JSON.stringify(doc))
    const cat = readRuleset('category', JSON.stringify({ ...CATEGORY, rules: [{ id: 'K-9', when: [], then: [{ effect: 'setCategory', group: 'G7' }] }, { id: 'K-8', when: [], then: [] }] }))
    expect(cat.ok && cat.slots.map((s) => s.editable)).toEqual([false, false])
  })

  it('a new rule of the kind is appended with a fresh id and its blank effect', () => {
    const cat = readRuleset('category', JSON.stringify(CATEGORY))
    const cov = readRuleset('coverage', JSON.stringify(COVERAGE))
    if (!cat.ok || !cov.ok) throw new Error('should read')
    const k = JSON.parse(printRuleset({ ...cat, slots: addSlot('category', cat.slots) })).rules[2]
    expect(k).toMatchObject({ id: 'K-003', when: [], then: [{ effect: 'setCategory', group: 'G2' }] })
    const c = JSON.parse(printRuleset({ ...cov, slots: addSlot('coverage', cov.slots) })).rules[2]
    expect(c).toMatchObject({ id: 'C-003', when: [], then: [] })
  })

  it('the lists the conditions name are the document\'s own, per kind', () => {
    const cov = readRuleset('coverage', JSON.stringify(COVERAGE))
    const cat = readRuleset('category', JSON.stringify(CATEGORY))
    expect(cov.ok && rulesetLists(cov).map((l) => l.id)).toEqual(['L-INS'])
    expect(cat.ok && rulesetLists(cat)).toEqual([])
  })

  it('a reader error on a coverage block is placed on it', () => {
    const read = readRuleset('coverage', JSON.stringify(COVERAGE))
    if (!read.ok) throw new Error('should read')
    const { perRule, rest } = rulesetIssues([{ path: 'rules[0].when[0].inList', message: 'no list' }, { path: 'rules[1].then[0].percent', message: 'bad' }], read.slots)
    expect(rest).toEqual([])
    expect(perRule[0]).toEqual([{ ruleId: 'C-1', blockPath: 'when[0]', field: 'inList', severity: 'error', en: 'no list', ar: 'no list' }])
    expect(perRule[1]).toEqual([{ ruleId: 'C-2', blockPath: 'then[0]', field: 'percent', severity: 'error', en: 'bad', ar: 'bad' }])
  })
})
