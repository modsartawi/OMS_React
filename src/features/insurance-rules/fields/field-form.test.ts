/**
 * Ticket 610 — adding a field to the registry: a source column, a key rules will name it by, an EN + AR
 * label, a scope, a type and an optional unit. A key is never reused, not even a retired one's (rules name
 * fields by key, so a reused key would silently re-point an old rule).
 */
import { describe, expect, it } from 'vitest'
import type { RegistryField } from '@/core/insurance-rules/registry'
import { fieldBody, fieldProblems, suggestKey, type FieldForm } from './field-form'

const field = (key: string, retired = false): RegistryField => ({
  key,
  label: { en: key, ar: key },
  scope: 'item',
  type: 'code',
  unit: null,
  source: `ItemInfo.${key}`,
  retired,
})
const existing = [field('ECode'), field('DCode', true)]
const form: FieldForm = { source: 'ItemInfo.HouseBrand', key: 'HouseBrand', labelEn: 'House brand', labelAr: 'العلامة الخاصة', scope: 'item', type: 'code', unit: '' }

describe('fieldProblems', () => {
  it('a complete form has none', () => {
    expect(fieldProblems(form, existing)).toEqual([])
  })
  it('a source, a well-formed key and both labels are required', () => {
    expect(fieldProblems({ ...form, source: ' ' }, existing)).toEqual(['sourceMissing'])
    expect(fieldProblems({ ...form, key: '' }, existing)).toEqual(['keyMissing'])
    expect(fieldProblems({ ...form, key: 'house brand' }, existing)).toEqual(['keyInvalid'])
    expect(fieldProblems({ ...form, labelAr: '' }, existing)).toEqual(['labelMissing'])
  })
  it('a key in use — live or retired, in any case — is taken', () => {
    expect(fieldProblems({ ...form, key: 'ecode' }, existing)).toEqual(['keyTaken'])
    expect(fieldProblems({ ...form, key: 'DCode' }, existing)).toEqual(['keyTaken'])
  })
  it('a dotted eligibility key is well formed', () => {
    expect(fieldProblems({ ...form, key: 'coverage.periodEnd', scope: 'eligibility', type: 'date' }, existing)).toEqual([])
  })
})

describe('fieldBody and suggestKey', () => {
  it('the POST body, trimmed, a blank unit as null', () => {
    expect(fieldBody({ ...form, labelEn: ' House brand ', unit: ' ' })).toEqual({
      key: 'HouseBrand',
      label: { en: 'House brand', ar: 'العلامة الخاصة' },
      scope: 'item',
      type: 'code',
      unit: null,
      source: 'ItemInfo.HouseBrand',
    })
  })
  it('the key a source suggests is its column', () => {
    expect(suggestKey('ItemInfo.HouseBrand')).toBe('HouseBrand')
    expect(suggestKey('ItemInfo.ECode / EDesc')).toBe('ECode')
    expect(suggestKey('')).toBe('')
  })
})
