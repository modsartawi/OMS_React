import type { Permissions, ScreenKey } from '@/core/permissions'

// The OMS area's grants, read off the one permissions answer (oms 909, BackOffice spec 4002; brief row 43). Pure: no
// React, no `t`. The menu leaf, the page gate and the buttons take the same predicate, so they cannot disagree.
//
// Each predicate is one seed-spelled `BackOfficeScreen` key, except the two combinations the server's old probe
// computed: Cities & districts (either inquiry) and the LF force refund (04 only beside 03).

const key = (k: ScreenKey) => (p: Permissions): boolean => p.has(k)

/** Delivery Documents list — `DocumentList:03`. */
export const canOpenList = key('DocumentList:03')

/** Document Details, the deep-linkable screen — `DocumentDetails:03`. */
export const canOpenDetail = key('DocumentDetails:03')

/**
 * Document Details' change doors (ticket 521) — `DocumentDetails:02`. On top of `canOpenDetail`, never instead of it:
 * the screen still opens on `canOpenDetail` alone.
 */
export const canChangeDetail = key('DocumentDetails:02')

/** Mark delivered (BackOffice 2417) — `OmsMarkDelivered:06`. */
export const canMarkDelivered = key('OmsMarkDelivered:06')

/** Mark returned back (oms 838) — `OmsReturnBack:06`. Independent of Mark delivered both ways. */
export const canMarkReturnedBack = key('OmsReturnBack:06')

/** Create return (ticket 521) — `OmsCreateReturn:01`. Change does not imply it. */
export const canCreateReturn = key('OmsCreateReturn:01')

/** Donor requests (ticket 431) — `DonorRequestInquiry:03`. */
export const canOpenDonorRequests = key('DonorRequestInquiry:03')

/** Document payments (ticket 433) — `DocumentPaymentInquiry:03`. */
export const canOpenDocumentPayments = key('DocumentPaymentInquiry:03')

/** Failed donor transfers (ticket 434) — `FailedDonorTransfers:03`. */
export const canOpenFailedTransfers = key('FailedDonorTransfers:03')

/** The failed transfer's re-run — `FailedDonorTransfers:06`. */
export const canReRunFailedTransfer = key('FailedDonorTransfers:06')

/** Cities & districts (ticket 436): either inquiry opens the screen — `SdCityInquiry:03 || SdDistrictInquiry:03`. */
export const canOpenGeography = (p: Permissions): boolean => p.has('SdCityInquiry:03') || p.has('SdDistrictInquiry:03')

/** City import — `SdCityImport:03`. */
export const canImportCities = key('SdCityImport:03')

/** District import — `SdDistrictImport:03`. */
export const canImportDistricts = key('SdDistrictImport:03')

/** Document source users (ticket 438) — `DocumentSourceUsersInquiry:03`. */
export const canOpenDocumentSourceUsers = key('DocumentSourceUsersInquiry:03')

/** Document source users import — `DocumentSourceUsersImport:03`. */
export const canImportDocumentSourceUsers = key('DocumentSourceUsersImport:03')

/**
 * Delivery statistics (ticket 484): not a screen of its own — the door checks the OMS LIST grant, so this reads
 * `DocumentList:03`. If the owner swaps in a dedicated statistics grant, only this changes.
 */
export const canOpenDeliveryStatistics = key('DocumentList:03')

/** Pick support (ticket 496) — `PickSupport:03`. */
export const canOpenPickSupport = key('PickSupport:03')

/** Pick support's fix (ticket 497) — `PickSupport:06`. Hide the button without it. */
export const canFixPickSupport = key('PickSupport:06')

/**
 * Pick support's serial grant (ticket 540) — `PickSupportSerial:03`. ADVISORY: it words the search hint and the
 * "restricted" note. Whether a serial is drawn is the server's per-unit `serialWithheld`, never this.
 */
export const canSeePickSupportSerial = key('PickSupportSerial:03')

/** Create a local fulfillment return (ticket 760) — `LocalFulfillmentReturn:03`. The bonded return does not imply it. */
export const canCreateLocalFulfillmentReturn = key('LocalFulfillmentReturn:03')

/** Force-refund an LF return (spec 759 F5) — `LocalFulfillmentReturn:04`, and only beside 03. */
export const canForceLocalFulfillmentReturnRefund = (p: Permissions): boolean =>
  p.has('LocalFulfillmentReturn:03') && p.has('LocalFulfillmentReturn:04')
