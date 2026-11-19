import { describe, expect, it } from 'vitest'
import { isPatientKey, normalisePatientKey } from './patient-key'

describe('a patient key (BackOffice spec 4015)', () => {
  it('a National ID or Iqama is the bare 10 digits from 1 or 2', () => {
    expect(normalisePatientKey(' 1012345678 ')).toBe('1012345678')
    expect(normalisePatientKey('2412345678')).toBe('2412345678')
    expect(normalisePatientKey('3012345678')).toBeNull()
    expect(normalisePatientKey('101234567')).toBeNull()
  })

  it('a VP, BN, DP or PPN number is TYPE:VALUE, upper case', () => {
    expect(normalisePatientKey('BN:4668104765')).toBe('BN:4668104765')
    expect(normalisePatientKey(' bn : 4668104765 ')).toBe('BN:4668104765')
    expect(normalisePatientKey('ppn:p1234567')).toBe('PPN:P1234567')
    expect(normalisePatientKey('VP:1234567890123456')).toBe('VP:1234567890123456')
    expect(normalisePatientKey('DP:2412345678')).toBe('DP:2412345678')
  })

  it('refuses NI: / PRC:, an unknown type, an empty or long or non-alphanumeric value', () => {
    expect(isPatientKey('NI:1012345678')).toBe(false)
    expect(isPatientKey('PRC:2412345678')).toBe(false)
    expect(isPatientKey('PP:P1234567')).toBe(false)
    expect(isPatientKey('BN:')).toBe(false)
    expect(isPatientKey('VP:12345678901234567')).toBe(false)
    expect(isPatientKey('PPN:P-123')).toBe(false)
    expect(isPatientKey('')).toBe(false)
  })
})
