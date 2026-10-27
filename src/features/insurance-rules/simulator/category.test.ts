/** Ticket 617 / review 3126 P6a (story 61: "the simulator shows which rule set it"), on BackOffice 3145's built Categories/Simulate. */
import { describe, expect, it } from 'vitest'
import type { CategorySimulateResult } from '@/core/insurance-rules/coverage-model'
import { categorySimulateBody, lineCategory } from './category'

const ANSWER: CategorySimulateResult = {
  version: 3,
  lines: [
    { line: 1, item: '100245', insuranceItemCategory: 'Brand-IR', group: 'G2', source: 'default', ruleId: null, version: null, defaultCategory: 'Brand-IR', unknowns: [] },
    { line: 2, item: '200101', insuranceItemCategory: 'Generic', group: 'G1', source: 'rule', ruleId: 'K-002', version: 3, defaultCategory: 'Brand', unknowns: [] },
    { line: 3, item: '900001', insuranceItemCategory: null, group: null, source: 'none', ruleId: null, version: null, defaultCategory: null, unknowns: [] },
  ],
}

describe('the simulator’s per-line category', () => {
  it('categorySimulateBody_numbersTheLines — the guard request as typed, each line numbered from 1, no patient key', () => {
    const body = categorySimulateBody({
      request: { channel: 'nphies', store: 'P001', payer: 'BUPA', policy: null, class: null, lines: [{ item: '100245', qty: 1, unit: 'PC', icd: [], price: 12 }] },
      patientKey: '1023456783',
    })
    expect(body).toEqual({ request: { channel: 'nphies', store: 'P001', payer: 'BUPA', policy: null, class: null, lines: [{ line: 1, item: '100245', qty: 1, unit: 'PC', icd: [], price: 12 }] } })
  })

  it('lineCategory_readsTheSource — a rule (linked), the item default with its own spelling, or none', () => {
    expect(lineCategory(ANSWER, 2)).toEqual({ source: 'rule', group: 'G1', ruleId: 'K-002', category: 'Generic' })
    expect(lineCategory(ANSWER, 1)).toEqual({ source: 'default', group: 'G2', ruleId: null, category: 'Brand-IR' })
    expect(lineCategory(ANSWER, 3)).toEqual({ source: 'none', group: null, ruleId: null, category: null })
  })

  it('no answer, or no row for the line, shows nothing', () => {
    expect(lineCategory(undefined, 1)).toBeNull()
    expect(lineCategory(ANSWER, 9)).toBeNull()
  })
})
