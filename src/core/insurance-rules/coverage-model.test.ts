/** Ticket 617 (realigned to BackOffice 3146 as built) — a resolved value's mark, and which effects are the invoice's. */
import { describe, expect, it } from 'vitest'
import { effectLevel, resolvedMark } from './coverage-model'

describe('coverage model', () => {
  it('resolvedMark_readsTheSource — payer, a rule filling the gap, a rule overriding the payer, none', () => {
    expect(resolvedMark({ source: 'payer' })).toBe('payer')
    expect(resolvedMark({ source: 'rule' })).toBe('fills')
    expect(resolvedMark({ source: 'ruleOverridesPayer' })).toBe('overrides')
    expect(resolvedMark({ source: 'none' })).toBe('none')
    expect(resolvedMark(null)).toBe('none')
  })
  it('segment and exception prescriptions are the invoice’s; the rest are a line’s', () => {
    expect(effectLevel('segment')).toBe('invoice')
    expect(effectLevel('exceptionPrescriptions')).toBe('invoice')
    expect(effectLevel('deductible')).toBe('line')
    expect(effectLevel('daysSupplyCap')).toBe('line')
  })
})
