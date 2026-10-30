/** Oms 692 (BackOffice spec 3271; 3262 V1, C1-C5): the catalog's grouping, the key a pick writes, and the stubbed rows. */
import { describe, expect, it } from 'vitest'
import { FHIR_CATALOG } from '../../../tools/fhir-rules-stubs-692.mjs'
import { COVERAGE_FIELDS, FIELDS } from '../../../tools/insurance-rules-stubs.mjs'
import rulesEn from '@/locales/en/insurance-rules.json'
import rulesAr from '@/locales/ar/insurance-rules.json'
import fieldsEn from '@/locales/en/insurance-fields.json'
import fieldsAr from '@/locales/ar/insurance-fields.json'
import { CHANNEL_ANSWERS, FHIR_LEVELS, FHIR_MESSAGES, factKey, groupCatalog, pickedFact, type FhirCatalogRow } from './fhir-catalog'
import { guardRuleIn, guardRuleOut } from './guard-wire'

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
const find = (moment: string, level: string, key: string) => {
  const r = FHIR_CATALOG.find((x) => x.moment === moment && x.level === level && x.key === key)
  if (!r) throw new Error(`no row ${moment}/${level}/${key}`)
  return r
}

describe('factKey: the rule key a pick stores', () => {
  it.each([
    ['eligibility', 'message', 'coverage.class', '$eligibility.coverage.class'],
    ['claim', 'message', 'total', '$claim.total'],
    ['claimResponse', 'message', 'outcome', '$claimResponse.outcome'],
    ['claim', 'line', 'quantity', '$line.claim.quantity'],
    ['claimResponse', 'line', 'copay', '$line.claimResponse.copay'],
  ] as const)('%s %s %s', (moment, level, key, expected) => {
    expect(factKey(row({ moment, level, key }))).toBe(expected)
  })
})

describe('groupCatalog: by message, then message-level against line-level', () => {
  it('holds the messages in story order, message level first, and keeps each row in its group', () => {
    const groups = groupCatalog([
      row({ moment: 'claimResponse', level: 'line', key: 'copay' }),
      row({ moment: 'payment', key: 'paid' }),
      row({ moment: 'claim', level: 'line', key: 'net' }),
      row({ moment: 'claim', key: 'total' }),
      row({ moment: 'eligibility', key: 'a' }),
      row({ moment: 'communication', key: 'sent' }),
      row({ moment: 'eligibility', key: 'b' }),
    ])
    expect(groups.map((g) => [g.message, g.levels.map((l) => [l.level, l.rows.map((r) => r.key)])])).toEqual([
      ['eligibility', [['message', ['a', 'b']]]],
      ['claim', [['message', ['total']], ['line', ['net']]]],
      ['claimResponse', [['line', ['copay']]]],
      ['communication', [['message', ['sent']]]],
      ['payment', [['message', ['paid']]]],
    ])
  })
})

describe('pickedFact: the block a pick leaves', () => {
  it('a counted type starts as a bound, anything else as codes', () => {
    expect(pickedFact(row({ moment: 'claim', level: 'line', key: 'quantity', type: 'number' }))).toEqual({ path: '$line.claim.quantity', op: 'atLeast', value: 0 })
    expect(pickedFact(row({ moment: 'claimResponse', key: 'outcome', type: 'code' }))).toEqual({ path: '$claimResponse.outcome', op: 'anyOf', value: [] })
  })
})

describe('the stubbed rows hold C1-C5', () => {
  it("C1: line copay reads `copay`, never the workbook's `coPay`", () => {
    expect(find('claimResponse', 'line', 'copay').fhirPath).toBe("adjudication.where(category.coding.code = 'copay').amount")
  })
  it('C2: the not-in-force reason reads the root and is legacy, pointing at site eligibility', () => {
    const r = find('eligibility', 'message', 'response.notInForceReason')
    expect(r.fhirPath.startsWith("extension('http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-not-in-force-reason')")).toBe(true)
    expect(r.legacy).toEqual({ removedOn: '2022-04-20', replacement: 'response.siteEligibility' })
  })
  it('C3: site eligibility reads root and insurance, with codes made distinct', () => {
    const u = 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-siteEligibility'
    expect(find('eligibility', 'message', 'response.siteEligibility').fhirPath).toBe(`(extension('${u}') | insurance.extension('${u}')).value.ofType(CodeableConcept).coding.code.distinct()`)
  })
  it('C4: the selection reason names its extension', () => {
    expect(find('claim', 'line', 'selectionReason').fhirPath).toContain("extension('http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-pharmacist-Selection-Reason')")
  })
  it('C5: `benefit.allowed` is the three-way choice', () => {
    const r = find('eligibility', 'message', 'benefit[*].allowed')
    expect(r.fhirPath.endsWith('.allowed')).toBe(true)
    expect(r.choice).toEqual(['unsignedInt', 'string', 'money'])
  })
  it('the phase-1 eligibility keys keep their names and types', () => {
    for (const f of [...FIELDS, ...COVERAGE_FIELDS].filter((x) => x.scope === 'eligibility')) {
      expect([f.key, find('eligibility', 'message', f.key).type]).toEqual([f.key, f.type])
    }
  })
  it('no rule key repeats', () => {
    const keys = FHIR_CATALOG.map(factKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('the catalog words, in both languages', () => {
  const leaves = (o: object, at = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? leaves(v as object, `${at}${k}.`) : [`${at}${k}`]))
  it('every message, level, answer and type has a word, and ar mirrors en', () => {
    const keys = leaves(rulesEn.catalog)
    expect(leaves(rulesAr.catalog).sort()).toEqual([...keys].sort())
    expect(leaves(fieldsAr.catalog).sort()).toEqual(leaves(fieldsEn.catalog).sort())
    const types = [...new Set(FHIR_CATALOG.map((r) => r.type))]
    for (const k of [...FHIR_MESSAGES.map((m) => `message.${m}`), ...FHIR_LEVELS.map((l) => `level.${l}`), ...CHANNEL_ANSWERS.map((a) => `answer.${a}`), ...types.map((ty) => `type.${ty}`)]) expect(keys).toContain(k)
  })
})

describe('a FHIR fact on the guard wire', () => {
  const rule = (when: unknown[]) => ({ id: 'G-1', name: { en: 'a', ar: 'ب' }, when, then: [] })
  it.each([
    [{ check: 'claim', field: 'total', atLeast: 100 }, { check: 'fact', path: '$claim.total', op: 'atLeast', value: 100 }],
    [{ check: 'claimResponse', field: 'outcome', anyOf: ['rejected'] }, { check: 'fact', path: '$claimResponse.outcome', op: 'anyOf', value: ['rejected'] }],
    [{ check: 'line', field: 'claim.quantity', under: 5 }, { check: 'fact', path: '$line.claim.quantity', op: 'below', value: 5 }],
    [{ check: 'line', field: 'claimResponse.copay', atLeast: 1 }, { check: 'fact', path: '$line.claimResponse.copay', op: 'atLeast', value: 1 }],
    [{ check: 'eligibility', field: 'coverage.class', anyOf: ['A'] }, { check: 'fact', path: '$eligibility.coverage.class', op: 'anyOf', value: ['A'] }],
  ])('%j reads as its key and goes back unchanged', (wire, editor) => {
    const read = guardRuleIn(rule([wire]))
    expect(read.when).toEqual([editor])
    expect((guardRuleOut(read) as { when: unknown[] }).when).toEqual([wire])
  })
  it('a phase-1 line block stays a line block', () => {
    expect(guardRuleIn(rule([{ check: 'line', field: 'daysSupply', under: 5 }])).when).toEqual([{ check: 'line', field: 'daysSupply', below: 5 }])
  })
})
