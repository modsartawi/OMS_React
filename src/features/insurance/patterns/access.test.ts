/**
 * Oms 922 (BackOffice spec 4050, 4053) — the pattern screens' grants, read off the ONE permissions answer (oms 914).
 * Reconciled with BackOffice 4053/4055's seed: the CONTROLLER `InsurancePattern` — 03 view, 02 mark, 06 reveal, 01 manage.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { canBlockPatient, canManagePatterns, canMarkCase, canOpenPatternCases, canRevealPatient } from './access'

const holding = (...screens: string[]) => permissionsOf({ screens })
const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })
const failed = permissionsFromQuery({ isPending: false, isError: true, data: undefined })

describe('each predicate reads its own key and nothing else', () => {
  it('view opens the list and a case: InsurancePattern:03', () => {
    expect(canOpenPatternCases(holding('InsurancePattern:03'))).toBe(true)
    expect(canOpenPatternCases(holding('InsurancePattern:06', 'InsurancePattern:02', 'InsurancePattern:01'))).toBe(false)
  })

  it('mark sets a case’s status with a note: InsurancePattern:02', () => {
    expect(canMarkCase(holding('InsurancePattern:02'))).toBe(true)
    expect(canMarkCase(holding('InsurancePattern:03', 'InsurancePattern:06', 'InsurancePattern:01'))).toBe(false)
  })

  it('reveal shows the patient: InsurancePattern:06', () => {
    expect(canRevealPatient(holding('InsurancePattern:06'))).toBe(true)
    expect(canRevealPatient(holding('InsurancePattern:03', 'InsurancePattern:02', 'InsurancePattern:01'))).toBe(false)
  })

  it('manage tunes the settings and reads the reveal log: InsurancePattern:01 — not 02, which is mark', () => {
    expect(canManagePatterns(holding('InsurancePattern:01'))).toBe(true)
    expect(canManagePatterns(holding('InsurancePattern:03', 'InsurancePattern:06', 'InsurancePattern:02'))).toBe(false)
  })

  it('the blocked-patient list is changed on 3965’s own key, InsurancePatientBlock:02 — reading it (:03) is not enough', () => {
    expect(canBlockPatient(holding('InsurancePatientBlock:02'))).toBe(true)
    expect(canBlockPatient(holding('InsurancePatientBlock:03'))).toBe(false)
  })
})

describe('the insurance-rules grants open none of them', () => {
  it('a rule author or the patient-list reader holds no pattern grant', () => {
    const p = holding('InsuranceRuleAuthoring:03', 'InsurancePatientBlock:03', 'InsurancePayerMonth:03')
    for (const can of [canOpenPatternCases, canMarkCase, canRevealPatient, canManagePatterns, canBlockPatient]) expect(can(p)).toBe(false)
  })
})

describe('fails closed', () => {
  it('no answer, a pending answer or a failed one grants nothing', () => {
    for (const p of [permissionsOf(null), pending, failed])
      for (const can of [canOpenPatternCases, canMarkCase, canRevealPatient, canManagePatterns, canBlockPatient]) expect(can(p)).toBe(false)
  })
})
