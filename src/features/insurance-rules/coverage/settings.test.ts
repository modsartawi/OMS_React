/** Ticket 617 (BackOffice 3144 as built) — an insurer's settings are refused in words before the PUT; the log reads what changed. */
import { describe, expect, it } from 'vitest'
import { blankSettings, settingsChanges, settingsFieldWord, settingsProblems, type InsurerSettings } from './settings'

const BUPA: InsurerSettings = {
  payer: '0001100041',
  hasFixedDiscount: true,
  fixedDiscountPct: 15,
  receivableCustomer: '0001100041',
  createsInsuranceCoupon: false,
  memberId: { minLength: 8, maxLength: 8, pattern: '^\\d{8}$' },
  daysSupply: { min: 1, max: 180, default: 30 },
  directDispense: true,
  fullQuantityReturnsOnly: false,
  brandMaxWhenZero: false,
  benefitCategories: [
    { source: 'benefit', code: '66', meaning: 'genericCopay' },
    { source: 'benefit', code: '57', meaning: 'brandCopay' },
    { source: 'tob', code: 'maxcopay', meaning: 'nonMedCopayMax' },
  ],
  payerPins: ['Vitality'],
  updatedBy: 'ins.huda',
  updatedAt: '2026-10-20T09:30:00',
}

const problems = (s: InsurerSettings) => settingsProblems(s).map((p) => (p.at === undefined ? p.problem : `${p.problem}@${p.at}`))

describe('settingsProblems', () => {
  it('Bupa as seeded has none; neither has a blank insurer (0 and empty inherit the estate default)', () => {
    expect(problems(BUPA)).toEqual([])
    expect(problems(blankSettings('0001100099'))).toEqual([])
  })

  it('a discount outside 0–100 %, member-id lengths the wrong way round, a pattern that does not parse', () => {
    expect(problems({ ...BUPA, fixedDiscountPct: 101, memberId: { minLength: 10, maxLength: 8, pattern: '^(\\d' } })).toEqual(['discountRange', 'memberIdLength', 'memberIdPattern'])
  })

  it('days supply: whole, not negative, the least not above the most, the default between them', () => {
    expect(problems({ ...BUPA, daysSupply: { min: 100, max: 90, default: 95 } })).toEqual(['daysSupplyRange'])
    expect(problems({ ...BUPA, daysSupply: { min: 1, max: 90, default: 120 } })).toEqual(['daysSupplyDefault'])
    expect(problems({ ...BUPA, daysSupply: { min: -1, max: 0, default: 0 } })).toEqual(['daysSupplyRange'])
  })

  it('benefit codes: each present and mapped once per source; pins: present and once each', () => {
    const benefitCategories = [...BUPA.benefitCategories, { source: 'benefit' as const, code: '57', meaning: 'genericCopay' }, { source: 'tob' as const, code: '57', meaning: 'dayBenefit' }, { source: 'benefit' as const, code: ' ', meaning: 'dayBenefit' }]
    expect(problems({ ...BUPA, benefitCategories, payerPins: ['Vitality', 'vitality', ''] })).toEqual(['benefitCodeTwice@3', 'benefitCodeMissing@5', 'pinTwice@1', 'pinMissing@2'])
  })
})

describe('settingsChanges', () => {
  it('settingsChanges_namesEachFieldThatMoved — before and after, the stamp and note left out', () => {
    const after = { ...BUPA, fixedDiscountPct: 14.5, payerPins: ['Vitality', 'Gold'], note: 'new contract', updatedBy: 'msartawi', updatedAt: '2026-10-27T10:00:00' }
    expect(settingsChanges(BUPA, after)).toEqual([
      { field: 'fixedDiscountPct', from: '15', to: '14.5' },
      { field: 'payerPins[1]', from: null, to: 'Gold' },
    ])
  })
  it('a PUT that created the insurer (before null) lists what it set', () => {
    const created = settingsChanges(null, { ...blankSettings('0001100099'), fixedDiscountPct: 5 })
    expect(created).toContainEqual({ field: 'fixedDiscountPct', from: null, to: '5' })
    expect(created.some((c) => c.field === 'payer')).toBe(true)
  })
})

describe('settingsFieldWord', () => {
  it('names a log path by a locale key per settings field — a list row by its 1-based number — and leaves an unknown path as written', () => {
    expect(settingsFieldWord('fixedDiscountPct')).toEqual({ key: 'log.field.fixedDiscountPct' })
    expect(settingsFieldWord('memberId.minLength')).toEqual({ key: 'log.field.memberId.minLength' })
    expect(settingsFieldWord('daysSupply.default')).toEqual({ key: 'log.field.daysSupply.default' })
    expect(settingsFieldWord('benefitCategories[2].meaning')).toEqual({ key: 'log.field.benefitCategories.meaning', n: 3 })
    expect(settingsFieldWord('payerPins[0]')).toEqual({ key: 'log.field.payerPins', n: 1 })
    expect(settingsFieldWord('somethingNew')).toBeNull()
    expect(settingsFieldWord('memberId.colour')).toBeNull()
  })
})
