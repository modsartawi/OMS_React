/**
 * The insurance-view grant (spec 3389, client tickets 786–789): one more optional flag of the OMS
 * probe. It guards health data, so only an explicit `true` grants — an older SIS.Api omits it.
 */
import { describe, expect, it } from 'vitest'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { omsGrants } from './access'
import { canViewInsurance } from './insurance-grant'

describe('canViewInsurance', () => {
  it('grants on an explicit true', () => {
    expect(canViewInsurance({ canOpenList: true, canOpenDetail: true, canViewInsurance: true })).toBe(true)
  })

  it('🚩 an absent flag is a denial (today’s server)', () => {
    expect(canViewInsurance({ canOpenList: true, canOpenDetail: true })).toBe(false)
  })

  it.each([null, undefined])('a %s answer grants nothing', (r) => {
    expect(canViewInsurance(r)).toBe(false)
  })

  it('a malformed value is a denial', () => {
    const malformed = { canOpenList: true, canOpenDetail: true, canViewInsurance: 'yes' } as unknown as OmsAccessResult
    expect(canViewInsurance(malformed)).toBe(false)
  })

  it('no other OMS grant implies it', () => {
    const everything = Object.fromEntries(Object.keys(omsGrants(null)).map((k) => [k, true]))
    expect(canViewInsurance({ canOpenList: true, canOpenDetail: true, ...everything })).toBe(false)
  })
})
