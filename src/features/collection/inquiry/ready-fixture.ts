import type { CollectionReadyRow } from '@/core/models/collection'

/**
 * Ready for collection rows (ticket 317). The first two are BackOffice 1994's
 * `## Web contract` sample **verbatim**; the rest are the hostile cases the
 * contract names but its sample does not show.
 */

/** 1994's DAY sample, verbatim. */
export const READY_DAY: CollectionReadyRow = {
  kind: 'DAY',
  storeId: 'P019',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  currencyKey: 'SAR',
  businessDay: '2026-09-20T00:00:00',
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X0Y',
  zNumber: 412,
  settlementDocumentId: '',
  entryNumber: 0,
  cashToHandOver: 1000.5,
  surplusDeducted: 250.0,
  readySince: '2026-09-20T23:05:12',
  daysWaiting: 5,
}

/** 1994's SETTLEMENT sample, verbatim. */
export const READY_RECEIPT: CollectionReadyRow = {
  kind: 'SETTLEMENT',
  storeId: 'P019',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  currencyKey: 'SAR',
  businessDay: null,
  shiftId: '',
  zNumber: null,
  settlementDocumentId: '01K5ZC1A2B3C4D5E6F7G8H9J0K',
  entryNumber: 143,
  cashToHandOver: 120.5,
  surplusDeducted: null,
  readySince: '2026-09-23T10:41:00',
  daysWaiting: 2,
}

/** A day whose Z has not reached head office: no Z, no figures — absences, not zeros. */
export const READY_DAY_NO_Z: CollectionReadyRow = {
  ...READY_DAY,
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X1A',
  businessDay: '2026-09-24T00:00:00',
  zNumber: null,
  cashToHandOver: null,
  surplusDeducted: null,
  readySince: '2026-09-24T22:58:00',
  daysWaiting: 1,
}

/** A Bahraini day with no profit center recorded: 3 decimals, the code alone as storeText. */
export const READY_DAY_BHD: CollectionReadyRow = {
  ...READY_DAY,
  storeId: 'B004',
  storeName: 'Al-Dawaa Manama',
  profitCenter: '',
  storeText: 'B004',
  currencyKey: 'BHD',
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X2B',
  zNumber: 77,
  cashToHandOver: 95.255,
  surplusDeducted: 0,
  readySince: '2026-09-21T23:30:00',
  daysWaiting: 4,
}

/** A receipt whose shortage entry is gone (`entryNumber: 0`). */
export const READY_RECEIPT_ORPHAN: CollectionReadyRow = {
  ...READY_RECEIPT,
  settlementDocumentId: '01K5ZC1A2B3C4D5E6F7G8H9J1M',
  entryNumber: 0,
}
