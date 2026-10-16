/**
 * The OMS probe's screen flags (spec 430 D2, ticket 431): nine optional flags on the one
 * `SdDocumentWeb/Access` answer, read through one pure reader. An older SIS.Api sends none of
 * them, so an absent flag must read as denied — the leaves stay hidden until the server learns
 * the grant.
 */
import { describe, expect, it } from 'vitest'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { OMS_SCREEN_FLAGS, canFixPickSupport, canOpenDeliveryStatistics, canOpenPickSupport, canOpenDocumentPayments, canOpenDonorRequests, canOpenFailedTransfers, canOpenGeography, omsGrants } from './access'

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
/** The two Pick support flags (ticket 496, brief 2691; BackOffice 2731). */
const PICK = ['canOpenPickSupport', 'canFixPickSupport'] as const
const ALL = [...NINE, ...PICK] as const

describe('omsGrants', () => {
  it('names exactly the nine D2 flags and the two Pick support flags', () => {
    expect([...OMS_SCREEN_FLAGS].sort()).toEqual([...ALL].sort())
  })

  it('🚩 an absent flag is false for every D2 flag (an older server)', () => {
    const grants = omsGrants({ canOpenList: true, canOpenDetail: true })
    for (const flag of ALL) expect([flag, grants[flag]]).toEqual([flag, false])
  })

  it.each([null, undefined])('a %s answer grants nothing', (r) => {
    const grants = omsGrants(r)
    for (const flag of ALL) expect(grants[flag]).toBe(false)
  })

  it('each flag reads only its own field, and only an explicit true grants', () => {
    for (const flag of ALL) {
      const grants = omsGrants({ canOpenList: false, canOpenDetail: false, [flag]: true })
      for (const other of ALL) expect([other, grants[other]]).toEqual([other, other === flag])
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

  it('canOpenDocumentPayments reads only its own flag (ticket 433)', () => {
    expect(canOpenDocumentPayments({ canOpenList: false, canOpenDetail: false, canOpenDocumentPayments: true })).toBe(true)
    expect(canOpenDocumentPayments({ canOpenList: true, canOpenDetail: true, canOpenDonorRequests: true })).toBe(false)
    expect(canOpenDocumentPayments(null)).toBe(false)
  })

  it('canOpenFailedTransfers reads only its own flag, not the re-run one (ticket 434)', () => {
    expect(canOpenFailedTransfers({ canOpenList: false, canOpenDetail: false, canOpenFailedTransfers: true })).toBe(true)
    expect(canOpenFailedTransfers({ canOpenList: true, canOpenDetail: true, canReRunFailedTransfer: true })).toBe(false)
    expect(canOpenFailedTransfers(undefined)).toBe(false)
  })

  it('canOpenGeography reads only its own flag, not the import ones (ticket 436)', () => {
    expect(canOpenGeography({ canOpenList: false, canOpenDetail: false, canOpenGeography: true })).toBe(true)
    expect(canOpenGeography({ canOpenList: true, canOpenDetail: true, canImportCities: true, canImportDistricts: true })).toBe(false)
    expect(canOpenGeography(undefined)).toBe(false)
  })
})

describe('canOpenDeliveryStatistics', () => {
  it('reads the OMS list grant the door checks, and fails closed on anything else', () => {
    expect(canOpenDeliveryStatistics({ canOpenList: true, canOpenDetail: false })).toBe(true)
    expect(canOpenDeliveryStatistics({ canOpenList: false, canOpenDetail: true, canOpenDonorRequests: true })).toBe(false)
    expect(canOpenDeliveryStatistics(null)).toBe(false)
    expect(canOpenDeliveryStatistics(undefined)).toBe(false)
  })
})

describe('Pick support (ticket 496)', () => {
  it('canOpenPickSupport grants only on an explicit true', () => {
    expect(canOpenPickSupport({ canOpenList: false, canOpenDetail: false, canOpenPickSupport: true })).toBe(true)
    expect(canOpenPickSupport({ canOpenList: true, canOpenDetail: true })).toBe(false)
    expect(canOpenPickSupport({ canOpenList: true, canOpenDetail: true, canOpenPickSupport: false })).toBe(false)
    expect(canOpenPickSupport({ canOpenList: true, canOpenDetail: true, canFixPickSupport: true })).toBe(false)
    expect(canOpenPickSupport({ canOpenList: true, canOpenDetail: true, canOpenPickSupport: 'true' } as unknown as OmsAccessResult)).toBe(false)
    expect(canOpenPickSupport(null)).toBe(false)
    expect(canOpenPickSupport(undefined)).toBe(false)
  })

  it('canFixPickSupport grants only on an explicit true, and reads only its own flag', () => {
    expect(canFixPickSupport({ canOpenList: false, canOpenDetail: false, canFixPickSupport: true })).toBe(true)
    expect(canFixPickSupport({ canOpenList: true, canOpenDetail: true, canOpenPickSupport: true })).toBe(false)
    expect(canFixPickSupport({ canOpenList: true, canOpenDetail: true, canFixPickSupport: 1 } as unknown as OmsAccessResult)).toBe(false)
    expect(canFixPickSupport(null)).toBe(false)
    expect(canFixPickSupport(undefined)).toBe(false)
  })
})
