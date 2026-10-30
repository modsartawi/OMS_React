/** Oms 693 (BackOffice spec 3271, stories 15+16, F8-F12): what a fact's type and cardinality allow, and how each reads. */
import { describe, expect, it } from 'vitest'
import type { KeySentence, SentenceValue } from '@/core/rules/sentence'
import rulesEn from '@/locales/en/insurance-rules.json'
import rulesAr from '@/locales/ar/insurance-rules.json'
import guardsEn from '@/locales/en/insurance-guards.json'
import guardsAr from '@/locales/ar/insurance-guards.json'
import {
  amountProblem,
  currencyProblem,
  factOfEligibility,
  factShapeOf,
  factTestFor,
  operatorsFor,
  quantityProblem,
  rowOfPath,
  unitProblem,
  usesFhirFacts,
  withOp,
  type FactShape,
} from './fact-tests'
import { pickedFact, type FhirCatalogRow } from './fhir-catalog'
import { guardRuleIn, guardRuleOut } from './guard-wire'
import type { FactCondition, GuardCondition } from './model'
import { conditionSentence } from './sentence'

const shape = (type: FactShape['type'], cardinality: FactShape['cardinality'] = 'single', over: Partial<FactShape> = {}): FactShape => ({ type, cardinality, system: null, unit: null, known: true, ...over })
const row = (over: Partial<FhirCatalogRow>): FhirCatalogRow => ({
  key: 'k',
  label: { en: 'K', ar: 'ك' },
  moment: 'claim',
  level: 'message',
  type: 'text',
  unit: null,
  fhirPath: 'k',
  cardinality: 'single',
  system: null,
  channels: [],
  parameter: null,
  choice: null,
  legacy: null,
  retired: false,
  ...over,
})

describe('operators follow the type and the cardinality', () => {
  it.each([
    ['number', ['atLeast', 'below']],
    ['money', ['atLeast', 'below']],
    ['quantity', ['atLeast', 'below']],
    ['code', ['anyOf', 'noneOf']],
    ['text', ['anyOf', 'noneOf']],
    ['flag', ['is']],
    ['date', ['before', 'onOrBefore', 'after', 'onOrAfter']],
  ] as const)('a single %s fact offers no list operator', (type, ops) => {
    expect(operatorsFor(shape(type))).toEqual(ops)
  })
  it('a list of codes is tested any of, none of, or by its count', () => {
    expect(operatorsFor(shape('code', 'list'))).toEqual(['anyOf', 'noneOf', 'countAtLeast', 'countBelow'])
  })
  it('a list of amounts can only be counted: any of has nothing to match by', () => {
    expect(operatorsFor(shape('money', 'list'))).toEqual(['countAtLeast', 'countBelow'])
  })
})

describe('a typed value refused at the field', () => {
  it.each(['0', '100', '100.5', '100.500', '0.001'])('the amount %s is taken', (s) => expect(amountProblem(s)).toBeNull())
  it('more than 3 decimals is refused, never rounded', () => {
    expect(amountProblem('100.5001')).toBe('decimals')
  })
  it.each(['', '  '])('an empty amount (%j) is refused', (s) => expect(amountProblem(s)).toBe('empty'))
  it.each(['1,5', 'abc', '-1', '1.', '.5'])('the amount %s is not one', (s) => expect(amountProblem(s)).toBe('shape'))
  it('a currency is three capitals', () => {
    expect(currencyProblem('BHD')).toBeNull()
    expect(currencyProblem('sar')).toBe('currency')
    expect(currencyProblem('')).toBe('currency')
  })
  it('a quantity takes any decimals, and its unit is not blank', () => {
    expect(quantityProblem('2.12345')).toBeNull()
    expect(quantityProblem('x')).toBe('shape')
    expect(unitProblem('mg')).toBeNull()
    expect(unitProblem(' ')).toBe('unit')
  })
})

describe('where a test starts', () => {
  it('money in the fact\'s currency else SAR, as a string', () => {
    expect(factTestFor(shape('money'))).toEqual({ op: 'atLeast', value: { amount: '0', currency: 'SAR' } })
    expect(factTestFor(shape('money', 'single', { unit: 'BHD' }))).toEqual({ op: 'atLeast', value: { amount: '0', currency: 'BHD' } })
  })
  it('a quantity in the fact\'s unit, a code in its declared system, a flag on yes', () => {
    expect(factTestFor(shape('quantity', 'single', { unit: 'd' }))).toEqual({ op: 'atLeast', value: { value: '0', unit: 'd' } })
    expect(factTestFor(shape('code', 'single', { system: 'urn:s' }))).toEqual({ op: 'anyOf', value: [], system: 'urn:s' })
    expect(factTestFor(shape('flag'))).toEqual({ op: 'is', value: true })
  })
  it('a pick writes its key and the test its type allows', () => {
    expect(pickedFact(row({ moment: 'claim', key: 'total', type: 'money' }))).toEqual({ path: '$claim.total', op: 'atLeast', value: { amount: '0', currency: 'SAR' } })
    expect(pickedFact(row({ moment: 'claim', key: 'dx', type: 'code', cardinality: 'list', system: 'urn:icd' }))).toEqual({ path: '$claim.dx', op: 'anyOf', value: [], system: 'urn:icd' })
  })
  it('an operator of the same family keeps the value; another family starts afresh', () => {
    const c: FactCondition = { check: 'fact', path: '$claim.dx', op: 'anyOf', value: ['A'], system: 'urn:icd' }
    const list = shape('code', 'list', { system: 'urn:icd' })
    expect(withOp(c, 'noneOf', list)).toEqual({ ...c, op: 'noneOf' })
    expect(withOp(c, 'countAtLeast', list)).toEqual({ check: 'fact', path: '$claim.dx', op: 'countAtLeast', value: 1 })
    expect(withOp({ ...c, op: 'countAtLeast', value: 3, system: undefined }, 'anyOf', list)).toEqual({ ...c, value: [] })
  })
})

describe('a fact\'s shape', () => {
  const catalog = [row({ moment: 'eligibility', key: 'benefit[*].network', type: 'code', system: 'urn:n' }), row({ key: 'total', type: 'money' })]
  it('a catalog row decides, a bracket parameter finding its [*] row', () => {
    expect(rowOfPath(catalog, '$eligibility.benefit[OPD].network')?.system).toBe('urn:n')
    expect(factShapeOf({ check: 'fact', path: '$claim.total', op: 'atLeast', value: 0 }, catalog, [])).toMatchObject({ type: 'money', known: true })
  })
  it('a registry fact keeps its phase-1 reading: a flag is still read by codes', () => {
    const fields = [{ key: 'f', label: { en: 'f', ar: 'f' }, scope: 'request', type: 'flag', unit: null, source: '', retired: false }] as const
    expect(factShapeOf({ check: 'fact', path: '$request.f', op: 'anyOf', value: [] }, [], fields)).toMatchObject({ type: 'text', known: true })
  })
  it('with no catalog (denied, not loaded) the value says what it is', () => {
    expect(factShapeOf({ check: 'fact', path: '$claim.x', op: 'atLeast', value: { amount: '1', currency: 'SAR' } }, [], [])).toMatchObject({ type: 'money', known: false })
    expect(factShapeOf({ check: 'fact', path: '$claim.x', op: 'anyOf', value: [], system: 'urn:s' }, [], [])).toMatchObject({ type: 'code', system: 'urn:s' })
  })
  it('only a rule reading a FHIR message wants the catalog', () => {
    const fact = (path: string): GuardCondition => ({ check: 'fact', path, op: 'atLeast', value: 0 })
    expect(usesFhirFacts([fact('$patient.age')])).toBe(false)
    expect(usesFhirFacts([{ check: 'group', mode: 'all', conditions: [fact('$line.claim.quantity')] }])).toBe(true)
    expect(usesFhirFacts([{ check: 'eligibility', field: 'a', is: true }])).toBe(true)
  })
})

describe('an eligibility flag or day stays its block on the wire, and edits as a fact', () => {
  it('one `is` or a day test', () => {
    expect(factOfEligibility({ check: 'eligibility', field: 'response.inForce', is: false, not: true })).toEqual({ check: 'fact', path: '$eligibility.response.inForce', op: 'is', value: false, not: true })
    expect(factOfEligibility({ check: 'eligibility', field: 'coverage.periodEnd', before: '2026-12-31' })).toEqual({ check: 'fact', path: '$eligibility.coverage.periodEnd', op: 'before', value: '2026-12-31' })
  })
  it('a relative day, or two tests, stays as written', () => {
    expect(factOfEligibility({ check: 'eligibility', field: 'coverage.periodEnd', before: 'today+30' })).toBeNull()
    expect(factOfEligibility({ check: 'eligibility', field: 'a', after: '2026-01-01', before: '2026-12-31' })).toBeNull()
    expect(factOfEligibility({ check: 'eligibility', field: 'a', atMost: 1 })).toBeNull()
  })
})

describe('each new condition on the guard wire', () => {
  const rule = (when: unknown[]) => ({ id: 'G-1', name: { en: 'a', ar: 'ب' }, when, then: [] })
  const money = { amount: '100.500', currency: 'BHD' }
  const SYS = 'http://nphies.sa/terminology/CodeSystem/adjudication-outcome'
  it.each([
    ['money', { check: 'claim', field: 'total', atLeast: money }, { check: 'fact', path: '$claim.total', op: 'atLeast', value: money }],
    ['money below', { check: 'line', field: 'claimResponse.copay', under: money }, { check: 'fact', path: '$line.claimResponse.copay', op: 'below', value: money }],
    ['quantity', { check: 'eligibility', field: 'coverage.copayPctQty', atLeast: { value: '20', unit: '%' } }, { check: 'fact', path: '$eligibility.coverage.copayPctQty', op: 'atLeast', value: { value: '20', unit: '%' } }],
    ['code', { check: 'claimResponse', field: 'outcome', anyOf: ['rejected'], system: SYS }, { check: 'fact', path: '$claimResponse.outcome', op: 'anyOf', value: ['rejected'], system: SYS }],
    ['code none of', { check: 'claimResponse', field: 'outcome', noneOf: ['approved'], system: SYS }, { check: 'fact', path: '$claimResponse.outcome', op: 'noneOf', value: ['approved'], system: SYS }],
    ['list none of', { check: 'claim', field: 'diagnoses', noneOf: ['E11'] }, { check: 'fact', path: '$claim.diagnoses', op: 'noneOf', value: ['E11'] }],
    ['count', { check: 'claim', field: 'diagnoses', count: { atLeast: 2 } }, { check: 'fact', path: '$claim.diagnoses', op: 'countAtLeast', value: 2 }],
    ['count below', { check: 'line', field: 'claimResponse.reasons', count: { under: 1 } }, { check: 'fact', path: '$line.claimResponse.reasons', op: 'countBelow', value: 1 }],
    ['flag', { check: 'claim', field: 'hasAttachment', is: false }, { check: 'fact', path: '$claim.hasAttachment', op: 'is', value: false }],
    ['day', { check: 'claim', field: 'created', onOrAfter: '2026-01-01' }, { check: 'fact', path: '$claim.created', op: 'onOrAfter', value: '2026-01-01' }],
    ['NOT', { check: 'claim', field: 'total', under: money, not: true }, { check: 'fact', path: '$claim.total', op: 'below', value: money, not: true }],
  ])('%s reads as its fact and goes back unchanged', (_n, wire, editor) => {
    const read = guardRuleIn(rule([wire]))
    expect(read.when).toEqual([editor])
    expect((guardRuleOut(read) as { when: unknown[] }).when).toEqual([wire])
  })
  it('money stays a string through JSON, never a float', () => {
    const out = guardRuleOut(guardRuleIn(rule([{ check: 'claim', field: 'total', atLeast: { amount: '0.100', currency: 'BHD' } }])))
    expect(JSON.stringify(out.when)).toContain('"amount":"0.100"')
  })
  it('a phase-1 none-of is still any-of under NOT, and an eligibility flag stays its block', () => {
    const when = [{ check: 'fact', path: '$request.channel', op: 'noneOf', value: ['oms'] }] as GuardCondition[]
    expect((guardRuleOut({ ...guardRuleIn(rule([])), when }) as { when: unknown[] }).when).toEqual([{ check: 'request', field: 'channel', anyOf: ['oms'], not: true }])
    const flag = { check: 'eligibility', field: 'response.inForce', is: true }
    expect(guardRuleIn(rule([flag])).when).toEqual([flag])
  })
  it('a flag picked on an eligibility key is written as the block a phase-1 reader knows', () => {
    const when = [{ check: 'fact', path: '$eligibility.response.inForce', op: 'is', value: true }] as GuardCondition[]
    expect((guardRuleOut({ ...guardRuleIn(rule([])), when }) as { when: unknown[] }).when).toEqual([{ check: 'eligibility', field: 'response.inForce', is: true }])
  })
})

// Worked by hand from the locale, so a word moved in either file shows here.
function read(s: KeySentence, locale: Record<string, unknown>): string {
  const template = s.key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)?.[p], locale) as string
  const value = (v: SentenceValue): string => {
    if (v.kind === 'code') return v.code
    if (v.kind === 'number') return String(v.n)
    if (v.kind === 'says') return v.says.en
    if (v.kind === 'day') return v.day
    if (v.kind === 'list') return v.items.map(value).join(' | ')
    if (v.kind === 'phrase') return read(v.sentence as KeySentence, locale)
    return ''
  }
  return template.replace(/<\/?\w+>/g, '').replace(/\{\{(\w+)\}\}/g, (_, k: string) => value(s.values[k]))
}

describe('the sentence reads each in words, in both languages', () => {
  const catalog = [row({ moment: 'claim', key: 'total', label: { en: 'Request total', ar: 'الإجمالي' }, type: 'money' })]
  const say = (c: FactCondition, locale: Record<string, unknown> = rulesEn) => {
    const n = conditionSentence(c, { rule: { filters: [] }, lists: [], catalog })
    return [read(n.sentence as KeySentence, locale), ...n.clauses.map((x) => read(x as KeySentence, locale))].join('; ')
  }
  const fact = (path: string, op: FactCondition['op'], value: FactCondition['value'], system?: string): FactCondition => ({ check: 'fact', path, op, value, ...(system ? { system } : {}) })
  it.each([
    [fact('$claim.total', 'atLeast', { amount: '100.500', currency: 'BHD' }), 'Request total is at least BHD 100.500'],
    [fact('$claim.total', 'below', { amount: '5', currency: 'SAR' }), 'Request total is below SAR 5'],
    [fact('$claim.q', 'atLeast', { value: '30', unit: 'd' }), '$claim.q is at least 30 d'],
    [fact('$claim.o', 'anyOf', ['a', 'b'], 'urn:s'), '$claim.o is any of a | b; in the code system urn:s'],
    [fact('$claim.o', 'noneOf', ['a'], 'urn:s'), '$claim.o is none of a; in the code system urn:s'],
    [fact('$claim.dx', 'countAtLeast', 2), 'the number of values of $claim.dx is at least 2'],
    [fact('$claim.dx', 'countBelow', 1), 'the number of values of $claim.dx is below 1'],
    [fact('$claim.f', 'is', true), '$claim.f is yes'],
    [fact('$claim.f', 'is', false), '$claim.f is no'],
    [fact('$claim.d', 'onOrAfter', '2026-01-01'), '$claim.d is on or after 2026-01-01'],
  ])('%j', (c, words) => expect(say(c)).toBe(words))
  it('Arabic has the same sentences, in Arabic', () => {
    const ar = say(fact('$claim.total', 'atLeast', { amount: '1', currency: 'SAR' }), rulesAr)
    expect(ar).toContain('SAR 1')
    expect(ar).toMatch(/[؀-ۿ]/)
    expect(say(fact('$claim.dx', 'countBelow', 1), rulesAr)).toMatch(/[؀-ۿ]/)
  })
  it('every operator has its word for the editor in both languages', () => {
    for (const op of ['countAtLeast', 'countBelow', 'is', 'before', 'onOrBefore', 'after', 'onOrAfter'])
      for (const locale of [guardsEn, guardsAr]) expect((locale.editor.factOp as Record<string, string>)[op]).toBeTruthy()
  })
})
