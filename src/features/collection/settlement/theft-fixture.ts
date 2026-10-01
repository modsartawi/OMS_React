import type {
  SettlementAccount,
  SettlementEntry,
  SettlementOpenLaneRow,
  SettlementPostResult,
} from '@/core/models/settlement'

/**
 * **The theft cases** (ticket 339) — the envelopes BackOffice 2150 records under its
 * `## Web contract`, as one branch's account and the ledger rows behind it.
 *
 * Its own module for `approval-fixture.ts`'s reason: a different question (*what moves
 * no cash*), served over the same doors by `tools/settlement-theft-drive.mjs` and pinned
 * by `theft.test.ts`.
 *
 * | entry | state | why it is here |
 * |---|---|---|
 * | 1410 | `OPEN` shortage 200 | a live figure the headline must keep |
 * | 1411 | `OPEN` surplus 150 | the other one |
 * | 1412 | `PENDING_APPROVAL` theft 3,000 | **the contract's own sample row**, the one a supervisor decides |
 * | 1413 | `OPEN` theft 450.75 | approved: live, never consumed, in neither figure |
 * | 1414 | `REJECTED` theft 900 | ended unused; no shortage was posted for it |
 *
 * 🔑 **The headline is 200 of shortage and 150 of surplus, never 600.75.** An approved
 * theft is stored `OPEN` with `remainingAmount == amount`, so a rule of the shape *"not
 * SHORTAGE, therefore SURPLUS"* would put 450.75 of stolen money into what the branch
 * may keep back.
 */

/** The server's default for an unstamped `NOT NULL` datetime, and for *no day*. */
const NONE = '0001-01-01T00:00:00'

const DUHA = { staffId: '4466', name: 'ضحى' }
const SUPERVISOR_ID = 'SUP1'

export const THEFT_STORE = 'P019'
export const THEFT_STORE_NAME = 'Al-Dawaa P019'

function entry(
  o: Partial<SettlementEntry> &
    Pick<SettlementEntry, 'settlementEntryId' | 'entryNumber' | 'entryKind' | 'amount' | 'reason' | 'postedAt'>,
): SettlementEntry {
  return {
    storeId: THEFT_STORE,
    remainingAmount: o.amount,
    status: 'OPEN',
    batchId: '',
    postedByStaffId: DUHA.staffId,
    postedByName: DUHA.name,
    closedByStaffId: '',
    closedAt: NONE,
    closedReason: '',
    approvedByStaffId: '',
    approvedAt: NONE,
    rejectedByStaffId: '',
    rejectedAt: NONE,
    rejectedReason: '',
    businessDay: NONE,
    ...o,
  }
}

export const PENDING_THEFT_ID = '01K6CQ7Y3T9V2N8M4R5B6D7F8G'
export const APPROVED_THEFT_ID = '01K6CQ7Y3T9V2N8M4R5B6D7F9A'

export const THEFT_ENTRIES: SettlementEntry[] = [
  entry({
    settlementEntryId: '01K6CQ7Y3T9V2N8M4R5B6D7F7S',
    entryNumber: 1410,
    entryKind: 'SHORTAGE',
    amount: 200,
    reason: 'عجز جرد سبتمبر',
    postedAt: '2026-09-25T09:30:00',
  }),
  entry({
    settlementEntryId: '01K6CQ7Y3T9V2N8M4R5B6D7F7T',
    entryNumber: 1411,
    entryKind: 'SURPLUS',
    amount: 150,
    reason: 'مرتجع شبكة — عميل 8801',
    postedAt: '2026-09-26T13:10:00',
  }),
  // 🔑 The contract's sample, field for field.
  entry({
    settlementEntryId: PENDING_THEFT_ID,
    entryNumber: 1412,
    entryKind: 'THEFT',
    amount: 3000,
    reason: 'سرقة من الخزنة - بلاغ رقم 5521',
    status: 'PENDING_APPROVAL',
    postedAt: '2026-09-30T10:14:32.517',
    businessDay: '2026-09-27T00:00:00',
  }),
  entry({
    settlementEntryId: APPROVED_THEFT_ID,
    entryNumber: 1413,
    entryKind: 'THEFT',
    amount: 450.75,
    reason: 'سرقة من الدرج - بلاغ رقم 5498',
    postedAt: '2026-09-22T11:02:10',
    approvedByStaffId: SUPERVISOR_ID,
    approvedAt: '2026-09-23T08:45:00',
    businessDay: '2026-09-20T00:00:00',
  }),
  entry({
    settlementEntryId: '01K6CQ7Y3T9V2N8M4R5B6D7F9B',
    entryNumber: 1414,
    entryKind: 'THEFT',
    amount: 900,
    reason: 'سرقة - بلاغ رقم 5470',
    status: 'REJECTED',
    postedAt: '2026-09-23T15:20:00',
    rejectedByStaffId: SUPERVISOR_ID,
    rejectedAt: '2026-09-24T09:00:00',
    rejectedReason: 'لا يوجد بلاغ مرفق',
    businessDay: '2026-09-22T00:00:00',
  }),
]

/** `Settlement/Account` — ⚠️ `businessDay` on every row, and **no day figures**: those
 *  ride on ledger rows only (the contract says so in as many words). */
export const THEFT_ACCOUNT: SettlementAccount = {
  storeId: THEFT_STORE,
  storeName: THEFT_STORE_NAME,
  entries: THEFT_ENTRIES,
  consumptions: [],
}

/** What the named day's shifts came to — filled on a theft in ANY status. */
const DAY_FIGURES: Record<number, Pick<SettlementOpenLaneRow, 'daySystemCash' | 'dayCountedCash' | 'dayCashVariance'>> = {
  // The contract's sample: 3,500 of system cash, 500 counted — 3,000 short.
  1412: { daySystemCash: 3500, dayCountedCash: 500, dayCashVariance: -3000 },
  1413: { daySystemCash: 1200, dayCountedCash: 749.25, dayCashVariance: -450.75 },
  // A day that counted MORE than the system expected — nothing was missing.
  1414: { daySystemCash: 2100, dayCountedCash: 2110, dayCashVariance: 10 },
}
const NO_DAY_FIGURES = { daySystemCash: null, dayCountedCash: null, dayCashVariance: null }

/** `Settlement/Ledger` rows for the same entries, oldest first as `sort=age` answers. */
export const THEFT_LEDGER: SettlementOpenLaneRow[] = THEFT_ENTRIES.map((e) => ({
  ...e,
  storeName: THEFT_STORE_NAME,
  currencyKey: 'SAR',
  ...(DAY_FIGURES[e.entryNumber] ?? NO_DAY_FIGURES),
  openChangeRequestId: '',
  servedBy: DUHA.name,
  isMine: true,
  ageDays: 3,
})).sort((a, b) => (a.postedAt < b.postedAt ? -1 : a.postedAt > b.postedAt ? 1 : 0))

/** `POST Settlement/Post` answering a theft — the contract's sample `data`, narrowed to
 *  the fields this client declares. */
export const THEFT_POST_RESULT: SettlementPostResult = {
  settlementEntryId: PENDING_THEFT_ID,
  entryNumber: 1412,
  amount: 3000,
  status: 'PENDING_APPROVAL',
  businessDay: '2026-09-27T00:00:00',
}
