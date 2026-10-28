/** Ticket 617 — the palette's facts come from the Fields registry (610), eligibility facts included. */
import { describe, expect, it } from 'vitest'
import type { RegistryField } from './registry'
import { dateFields, factFields, factKind, factPath, fieldOfPath, lineFields } from './registry-facts'

const f = (key: string, scope: RegistryField['scope'], type: RegistryField['type'], unit: string | null = null, retired = false): RegistryField => ({
  key,
  label: { en: key, ar: key },
  scope,
  type,
  unit,
  source: 'test',
  retired,
})

const FIELDS: RegistryField[] = [
  f('ECode', 'item', 'text'),
  f('OldGroup', 'item', 'text', null, true),
  f('daysSupply', 'request', 'number', 'days'),
  f('payer', 'request', 'text'),
  f('age', 'patient', 'number', 'years'),
  f('coverage.periodEnd', 'eligibility', 'date'),
  f('benefit.dayBenefit', 'eligibility', 'number', 'SAR'),
  f('idfPriority', 'line', 'number'),
]

describe('registry facts', () => {
  it('a field is read by its scope and key', () => {
    expect(factPath(FIELDS[5])).toBe('$eligibility.coverage.periodEnd')
    expect(factPath(FIELDS[4])).toBe('$patient.age')
    expect(fieldOfPath(FIELDS, '$eligibility.benefit.dayBenefit')?.key).toBe('benefit.dayBenefit')
    expect(fieldOfPath(FIELDS, '$patient.weight')).toBeUndefined()
  })

  it('eligibilityFacts_appearInThePalette — live fields of every scope but item fields and dates, retired ones left out', () => {
    // An item field is a list's attribute filter in SIS.Rules, never a block of its own (oms 618).
    expect(factFields(FIELDS).map((x) => x.key)).toEqual(['daysSupply', 'payer', 'age', 'benefit.dayBenefit', 'idfPriority'])
    expect(dateFields(FIELDS).map((x) => x.key)).toEqual(['coverage.periodEnd'])
    expect(lineFields(FIELDS).map((x) => x.key)).toEqual(['daysSupply', 'idfPriority'])
  })

  it('a number compares, a date is after / before, anything else matches codes', () => {
    expect([factKind(FIELDS[2]), factKind(FIELDS[5]), factKind(FIELDS[0])]).toEqual(['number', 'date', 'codes'])
  })
})
