/**
 * The OMS probe's screen flags (spec 430 D2, ticket 431): nine optional flags on the one
 * `SdDocumentWeb/Access` answer, read through one pure reader. An older SIS.Api sends none of
 * them, so an absent flag must read as denied — the leaves stay hidden until the server learns
 * the grant.
 */
import { describe, expect, it } from 'vitest'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { OMS_SCREEN_FLAGS, canOpenDonorRequests, omsGrants } from './access'

const NINE = [
  'canOpenDonorRequests',
  'canOpenDocumentPayments',
  'canOpenFailedTransfers',
  'canReRunFailedTransfer',
  'canOpenGeography',
  'canImportCities',
  'canImportDistricts',
  'canOpenDocumentSourceUsers',
  'canImportDocumentSourceUsers',
] as const

describe('omsGrants', () => {
  it('names exactly the nine D2 flags', () => {
    expect([...OMS_SCREEN_FLAGS].sort()).toEqual([...NINE].sort())
  })

  it('🚩 an absent flag is false for every D2 flag (an older server)', () => {
    const grants = omsGrants({ canOpenList: true, canOpenDetail: true })
    for (const flag of NINE) expect([flag, grants[flag]]).toEqual([flag, false])
  })

  it.each([null, undefined])('a %s answer grants nothing', (r) => {
    const grants = omsGrants(r)
    for (const flag of NINE) expect(grants[flag]).toBe(false)
  })

  it('each flag reads only its own field, and only an explicit true grants', () => {
    for (const flag of NINE) {
      const grants = omsGrants({ canOpenList: false, canOpenDetail: false, [flag]: true })
      for (const other of NINE) expect([other, grants[other]]).toEqual([other, other === flag])
    }
  })

  it('a malformed value is a denial, not a grant', () => {
    const malformed = { canOpenList: true, canOpenDetail: true, canOpenDonorRequests: 'yes' } as unknown as OmsAccessResult
    expect(omsGrants(malformed).canOpenDonorRequests).toBe(false)
  })

  it('canOpenDonorRequests is the reader, for the leaf and the page gate alike', () => {
    expect(canOpenDonorRequests({ canOpenList: false, canOpenDetail: false, canOpenDonorRequests: true })).toBe(true)
    expect(canOpenDonorRequests({ canOpenList: true, canOpenDetail: true })).toBe(false)
    expect(canOpenDonorRequests(undefined)).toBe(false)
  })
})
