/**
 * The OMS area's grants off the one permissions answer (oms 914, BackOffice spec 4002 row 43): each predicate reads its
 * own seed key, and the two combinations hold their half-grant cases.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type Permissions } from '@/core/permissions'
import {
  canChangeDetail,
  canCreateLocalFulfillmentReturn,
  canCreateReturn,
  canFixPickSupport,
  canForceLocalFulfillmentReturnRefund,
  canImportCities,
  canImportDistricts,
  canImportDocumentSourceUsers,
  canMarkDelivered,
  canMarkReturnedBack,
  canOpenDeliveryStatistics,
  canOpenDetail,
  canOpenDocumentPayments,
  canOpenDocumentSourceUsers,
  canOpenDonorRequests,
  canOpenFailedTransfers,
  canOpenGeography,
  canOpenList,
  canOpenPickSupport,
  canReRunFailedTransfer,
  canSeePickSupportSerial,
} from './access'

const holding = (...screens: string[]) => permissionsOf({ screens })

/** Brief row 43: each single-key flag and the key it reads, transcribed from the brief, not the code. */
const SINGLE: [string, (p: Permissions) => boolean, string][] = [
  ['canOpenList', canOpenList, 'DocumentList:03'],
  ['canOpenDetail', canOpenDetail, 'DocumentDetails:03'],
  ['canChangeDetail', canChangeDetail, 'DocumentDetails:02'],
  ['canMarkDelivered', canMarkDelivered, 'OmsMarkDelivered:06'],
  ['canMarkReturnedBack', canMarkReturnedBack, 'OmsReturnBack:06'],
  ['canOpenFailedTransfers', canOpenFailedTransfers, 'FailedDonorTransfers:03'],
  ['canReRunFailedTransfer', canReRunFailedTransfer, 'FailedDonorTransfers:06'],
  ['canOpenDonorRequests', canOpenDonorRequests, 'DonorRequestInquiry:03'],
  ['canOpenDocumentPayments', canOpenDocumentPayments, 'DocumentPaymentInquiry:03'],
  ['canImportCities', canImportCities, 'SdCityImport:03'],
  ['canImportDistricts', canImportDistricts, 'SdDistrictImport:03'],
  ['canOpenDocumentSourceUsers', canOpenDocumentSourceUsers, 'DocumentSourceUsersInquiry:03'],
  ['canImportDocumentSourceUsers', canImportDocumentSourceUsers, 'DocumentSourceUsersImport:03'],
  ['canOpenPickSupport', canOpenPickSupport, 'PickSupport:03'],
  ['canFixPickSupport', canFixPickSupport, 'PickSupport:06'],
  ['canSeePickSupportSerial', canSeePickSupportSerial, 'PickSupportSerial:03'],
  ['canCreateReturn', canCreateReturn, 'OmsCreateReturn:01'],
  ['canCreateLocalFulfillmentReturn', canCreateLocalFulfillmentReturn, 'LocalFulfillmentReturn:03'],
  ['canOpenDeliveryStatistics', canOpenDeliveryStatistics, 'DocumentList:03'],
]

describe('single-key OMS grants', () => {
  it.each(SINGLE)('%s reads exactly its own key', (_, can, key) => {
    expect(can(holding(key))).toBe(true)
    expect(can(holding())).toBe(false)
    // Every OTHER key of the area does not grant it (same-key aliases aside).
    const others = SINGLE.map(([, , k]) => k).filter((k) => k !== key)
    expect(can(holding(...others))).toBe(false)
  })

  it('an unanswered or failed answer grants nothing', () => {
    for (const [, can] of SINGLE) expect(can(permissionsOf(null))).toBe(false)
  })
})

describe('Cities & districts: either inquiry opens it', () => {
  it('city alone, district alone, or both', () => {
    expect(canOpenGeography(holding('SdCityInquiry:03'))).toBe(true)
    expect(canOpenGeography(holding('SdDistrictInquiry:03'))).toBe(true)
    expect(canOpenGeography(holding('SdCityInquiry:03', 'SdDistrictInquiry:03'))).toBe(true)
  })

  it('the import grants alone do not open it', () => {
    expect(canOpenGeography(holding('SdCityImport:03', 'SdDistrictImport:03'))).toBe(false)
  })
})

describe('LF force refund: 04 only beside 03', () => {
  it('half grant: 04 without 03 grants neither', () => {
    const only04 = holding('LocalFulfillmentReturn:04')
    expect(canForceLocalFulfillmentReturnRefund(only04)).toBe(false)
    expect(canCreateLocalFulfillmentReturn(only04)).toBe(false)
  })

  it('03 alone creates but never forces; both force', () => {
    expect(canForceLocalFulfillmentReturnRefund(holding('LocalFulfillmentReturn:03'))).toBe(false)
    expect(canForceLocalFulfillmentReturnRefund(holding('LocalFulfillmentReturn:03', 'LocalFulfillmentReturn:04'))).toBe(true)
  })

  it('neither bonded grant implies an LF one', () => {
    expect(canCreateLocalFulfillmentReturn(holding('OmsCreateReturn:01', 'DocumentDetails:02'))).toBe(false)
    expect(canCreateReturn(holding('LocalFulfillmentReturn:03'))).toBe(false)
  })
})
