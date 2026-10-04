import type { SettlementChangeQueueRow } from '@/core/models/settlement'
import { UNSTAMPED } from './change-request-fixture'

/**
 * **The supervisor's change-request queue, as BackOffice 2285 recorded it** (spec 342 W9,
 * ticket 353) — `GET Settlement/ChangeRequest/Open`'s `data` array.
 *
 * 🔑 **`RECORDED_ROW` is the recording in 2285's `## Comments`, verbatim** — the row its
 * `OpenQueue_LabelsTheBranch` test took from the real door handler: a BHD branch, three
 * fils, Arabic server text and fractional seconds on `requestedAt`. The projection is
 * built from it field for field (`change-queue.test.ts`).
 *
 * The other rows are the shapes 2285's `## Web contract` names beside it, each built from
 * the recording so no field is invented: its illustrative SAR sample, a `DELETE` (its
 * `newAmount` = `oldAmount` and the same description, as History records it), a theft
 * day-move, and a request whose entry is missing (`entryNumber` 0, `''` kind and status).
 *
 * ⚠️ Stubs of a door merged on BackOffice `pricing2` but not on every server; the drive
 * (`tools/settlement-change-drive.mjs`) serves exactly these.
 */

/** 2285's recorded row, verbatim (field order as recorded: the queue's own, then History's). */
export const RECORDED_ROW: SettlementChangeQueueRow = {
  storeName: 'صيدلية المنامة / Manama',
  currencyKey: 'BHD',
  entryNumber: 18712,
  entryKind: 'SHORTAGE',
  entryStatus: 'OPEN',
  amount: 12.345,
  remainingAmount: 12.345,
  spentAmount: 0.0,
  changeRequestId: '06GG2XW7S68WHDN66G7PYY23Q7',
  settlementEntryId: '06GG2XW7324YJ8CWQQJPYY2DW0',
  storeId: 'Z42F',
  requestKind: 'CHANGE',
  status: 'OPEN',
  oldAmount: 12.345,
  newAmount: 10.5,
  oldDescription: 'اختبار التسوية',
  newDescription: 'اختبار التسوية',
  oldBusinessDay: UNSTAMPED,
  newBusinessDay: UNSTAMPED,
  spentAtDecision: 0.0,
  requestedByStaffId: 'ACCCR2162',
  requestedByName: 'Accountant 2162',
  requestedAt: '2026-10-03T14:12:53.1934499',
  requestReason: 'رقم خاطئ — ٣٥٠ بدلاً من ٣٠٠',
  decidedByStaffId: '',
  decidedByName: '',
  decidedAt: UNSTAMPED,
  decisionReason: '',
}

/** 2285's `## Web contract` sample — a SAR shortage asked down from 350 to 300. */
export const CONTRACT_ROW: SettlementChangeQueueRow = {
  ...RECORDED_ROW,
  changeRequestId: '01K6M3Q8Z4F2R7T9V1X3B5D7G9',
  settlementEntryId: '01K6H0A2C4E6G8J0K2M4P6R8T0',
  storeId: 'P019',
  storeName: 'Al Olaya Pharmacy',
  currencyKey: 'SAR',
  oldAmount: 350.0,
  newAmount: 300.0,
  oldDescription: 'Short at close',
  newDescription: 'Short at close',
  requestedByStaffId: '10442',
  requestedByName: 'Accountant Name',
  requestedAt: '2026-10-02T11:42:07',
  requestReason: 'Typed 350, the Z report says 300',
  entryNumber: 1187,
  amount: 350.0,
  remainingAmount: 350.0,
  spentAmount: 0.0,
}

/** A `DELETE` — `newAmount` = `oldAmount`, the same description (2285): nothing differs. */
export const DELETE_ROW: SettlementChangeQueueRow = {
  ...CONTRACT_ROW,
  changeRequestId: '01K6M4A0B1C2D3E4F5G6H7J8K9',
  settlementEntryId: '01K6H1B3D5F7H9K1M3P5R7T9V1',
  entryNumber: 1190,
  entryKind: 'SURPLUS',
  requestKind: 'DELETE',
  oldAmount: 80.0,
  newAmount: 80.0,
  oldDescription: 'Over at close',
  newDescription: 'Over at close',
  amount: 80.0,
  remainingAmount: 80.0,
  requestedAt: '2026-10-02T15:03:11.52',
  requestReason: 'Posted twice',
}

/** A theft whose day is asked to move, and its amount and description with it. */
export const THEFT_DAY_ROW: SettlementChangeQueueRow = {
  ...CONTRACT_ROW,
  changeRequestId: '01K6M5C2D3E4F5G6H7J8K9M0N1',
  settlementEntryId: '01K6H2C4E6G8J0K2M4P6R8T0V2',
  entryNumber: 1203,
  entryKind: 'THEFT',
  oldAmount: 640.0,
  newAmount: 600.0,
  oldDescription: 'Till 2 theft',
  newDescription: 'Till 2 theft — police report 4471',
  oldBusinessDay: '2026-09-28T00:00:00',
  newBusinessDay: '2026-09-27T00:00:00',
  amount: 640.0,
  remainingAmount: 640.0,
  requestedAt: '2026-10-03T08:20:00',
  requestReason: 'The theft was on the 27th',
}

/** A request whose entry is missing — still listed, `entryNumber` 0, `''` kind and status (2285). */
export const ORPHAN_ROW: SettlementChangeQueueRow = {
  ...CONTRACT_ROW,
  changeRequestId: '01K6M6D3E4F5G6H7J8K9M0N1P2',
  settlementEntryId: '01K6H3D5F7H9K1M3P5R7T9V1X3',
  entryNumber: 0,
  entryKind: '',
  entryStatus: '',
  amount: 0,
  remainingAmount: 0,
  spentAmount: 0,
  requestedAt: '2026-10-03T16:45:30',
}

/** The queue as the door answers it — oldest first (`requestedAt`, then the id). */
export const CHANGE_QUEUE: SettlementChangeQueueRow[] = [CONTRACT_ROW, DELETE_ROW, THEFT_DAY_ROW, RECORDED_ROW, ORPHAN_ROW]
