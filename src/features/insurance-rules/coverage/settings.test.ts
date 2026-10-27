/** Ticket 617 — an insurer's settings are refused in words before the PUT, never sent half-wrong. */
import { describe, expect, it } from 'vitest'
import { settingsProblems, type InsurerSettings } from './settings'

const BUPA: InsurerSettings = {
  payer: 'BUPA',
  fixedDiscountPct: 15,
  receivableCustomer: '1000123',
  memberId: { length: 8, format: '^\\d{8}$' },
  benefitCategories: [
    { code: '66', meaning: 'genericCopay' },
    { code: '57', meaning: 'brandCopay' },
    { code: '13', meaning: 'dayBenefit' },
  ],
  daysSupply: { min: 1, max: 180 },
  directDispense: { allowed: true, defaultDayBenefit: 500 },
  payerPins: [{ documentType: 'ZINV', payer: 'BUPA-01' }],
}

const problems = (s: InsurerSettings) => settingsProblems(s).map((p) => (p.at === undefined ? p.problem : `${p.problem}@${p.at}`))

describe('settingsProblems', () => {
  it('Bupa as seeded has none', () => {
    expect(problems(BUPA)).toEqual([])
  })

  it('a discount outside 0–100 %, a member-id length that is not a whole number, a format that does not parse', () => {
    expect(problems({ ...BUPA, fixedDiscountPct: 101, memberId: { length: 7.5, format: '^(\\d' } })).toEqual(['discountRange', 'memberIdLength', 'memberIdFormat'])
    expect(problems({ ...BUPA, fixedDiscountPct: null, memberId: { length: null, format: null } })).toEqual([])
  })

  it('days supply: at least 1, and the least not above the most', () => {
    expect(problems({ ...BUPA, daysSupply: { min: 100, max: 90 } })).toEqual(['daysSupplyRange'])
    expect(problems({ ...BUPA, daysSupply: { min: 0, max: 90 } })).toEqual(['daysSupplyRange'])
  })

  it('benefit codes: each one present and mapped once; pins: one per document type', () => {
    const benefitCategories = [...BUPA.benefitCategories, { code: '57', meaning: 'genericCopay' }, { code: ' ', meaning: 'dayBenefit' }]
    const payerPins = [...BUPA.payerPins, { documentType: 'ZINV', payer: '' }]
    expect(problems({ ...BUPA, benefitCategories, payerPins })).toEqual(['benefitCodeTwice@3', 'benefitCodeMissing@4', 'pinDocumentTypeTwice@1', 'pinPayerMissing@1'])
  })

  it('a direct-dispense default day benefit is not negative', () => {
    expect(problems({ ...BUPA, directDispense: { allowed: true, defaultDayBenefit: -1 } })).toEqual(['dayBenefitNegative'])
  })
})
