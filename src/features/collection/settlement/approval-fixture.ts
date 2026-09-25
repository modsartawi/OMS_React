import type {
  SettlementAccount,
  SettlementBulkPreview,
  SettlementEntry,
  SettlementOpenLaneRow,
} from '@/core/models/settlement'

/**
 * **The approval cases** (ticket 309, BackOffice 1977 / 1978) — one branch whose
 * account holds every state a surplus can be in once a supervisor is in the loop,
 * the estate's pending worklist, and a SURPLUS upload whose large rows will wait.
 *
 * Its own module rather than a seventh branch in `settlement-fixture.ts`, because
 * that file's claim is *"the six hostile branches, and no others"* and its suites pin
 * exactly that. These cases are a different question — *what counts* — and they are
 * served over the same doors by `tools/settlement-approval-drive.mjs`.
 *
 * | entry | state | why it is here |
 * |---|---|---|
 * | 1201 | `OPEN` shortage 300 | a live figure the headline must keep |
 * | 1202 | `PENDING_APPROVAL` surplus 600 | the one a supervisor approves |
 * | 1203 | `PENDING_APPROVAL` surplus 750 | the one somebody else decides first — the refusal |
 * | 1204 | `REJECTED` surplus 700 | the accountant reads the supervisor's reason |
 * | 1205 | `OPEN` surplus 800, **self-approved** | a supervisor's own large surplus goes live, stamped with the poster |
 * | 1206 | `OPEN` surplus 120 | below the threshold — live as posted |
 *
 * 🔑 **The headline is 300 owed and 920 kept back, never 3,270.** 600 + 750 + 700 of
 * surplus sit on this account and none of it is money yet: the pending two wait for a
 * supervisor and the rejected one never will be. A headline that summed every
 * surplus row would tell the branch manager they may keep back 2,970 — 2,050 of which
 * no till can see.
 */

/** The server's default for an unstamped `NOT NULL` datetime — see `isStamped`. */
export const UNSTAMPED = '0001-01-01T00:00:00'

const HUDA = { staffId: '30117', name: 'هدى القحطاني / Huda Al-Qahtani' }
/** The accountant supervisor. The contract names a supervisor by staff id only. */
export const SUPERVISOR_ID = 'SUP1'
const MAJED = { staffId: SUPERVISOR_ID, name: 'ماجد العتيبي / Majed Al-Otaibi' }

export const APPROVAL_STORE = '0719'
export const APPROVAL_STORE_NAME = 'السلامة / Al-Salamah'

/** The reason the supervisor typed — Arabic, with Arabic-Indic digits, because the
 *  door stores it unicode-intact and the accountant must read it that way (1978). */
export const REJECTED_REASON = 'المبلغ مكرر مع القيد ١٢٣ — أعد الترحيل'

function entry(
  o: Partial<SettlementEntry> &
    Pick<SettlementEntry, 'settlementEntryId' | 'entryNumber' | 'entryKind' | 'amount' | 'reason' | 'postedAt'>,
): SettlementEntry {
  return {
    storeId: APPROVAL_STORE,
    remainingAmount: o.amount,
    status: 'OPEN',
    batchId: '',
    postedByStaffId: HUDA.staffId,
    postedByName: HUDA.name,
    closedByStaffId: '',
    closedAt: UNSTAMPED,
    closedReason: '',
    approvedByStaffId: '',
    approvedAt: UNSTAMPED,
    rejectedByStaffId: '',
    rejectedAt: UNSTAMPED,
    rejectedReason: '',
    ...o,
  }
}

export const PENDING_TO_APPROVE = '01J9APPR0719P1'
export const PENDING_TAKEN_FIRST = '01J9APPR0719P2'

export const APPROVAL_ENTRIES: SettlementEntry[] = [
  entry({
    settlementEntryId: '01J9APPR0719S1',
    entryNumber: 1201,
    entryKind: 'SHORTAGE',
    amount: 300,
    reason: 'عجز جرد شهر أغسطس',
    postedAt: '2026-09-20T10:05:00',
  }),
  entry({
    settlementEntryId: PENDING_TO_APPROVE,
    entryNumber: 1202,
    entryKind: 'SURPLUS',
    amount: 600,
    reason: 'مرتجع شبكة — عميل 5521',
    status: 'PENDING_APPROVAL',
    postedAt: '2026-09-23T14:40:00',
  }),
  entry({
    settlementEntryId: PENDING_TAKEN_FIRST,
    entryNumber: 1203,
    entryKind: 'SURPLUS',
    amount: 750,
    reason: 'مرتجع شبكة — عميل 5530',
    status: 'PENDING_APPROVAL',
    postedAt: '2026-09-24T09:12:00',
  }),
  entry({
    settlementEntryId: '01J9APPR0719R1',
    entryNumber: 1204,
    entryKind: 'SURPLUS',
    amount: 700,
    reason: 'مرتجع شبكة — عميل 5497',
    status: 'REJECTED',
    postedAt: '2026-09-22T11:30:00',
    rejectedByStaffId: MAJED.staffId,
    rejectedAt: '2026-09-24T18:40:02',
    rejectedReason: REJECTED_REASON,
  }),
  entry({
    // A supervisor's own large surplus: live at once, approved by the poster, at the
    // moment it was posted (1977 §2).
    settlementEntryId: '01J9APPR0719O2',
    entryNumber: 1205,
    entryKind: 'SURPLUS',
    amount: 800,
    reason: 'مرتجع شبكة — عميل 5410',
    postedAt: '2026-09-21T16:00:00',
    postedByStaffId: MAJED.staffId,
    postedByName: MAJED.name,
    approvedByStaffId: MAJED.staffId,
    approvedAt: '2026-09-21T16:00:00',
  }),
  entry({
    settlementEntryId: '01J9APPR0719O3',
    entryNumber: 1206,
    entryKind: 'SURPLUS',
    amount: 120,
    reason: 'مرتجع شبكة — عميل 5444',
    postedAt: '2026-09-19T12:20:00',
  }),
]

export const APPROVAL_ACCOUNT: SettlementAccount = {
  storeId: APPROVAL_STORE,
  storeName: APPROVAL_STORE_NAME,
  entries: APPROVAL_ENTRIES,
  consumptions: [],
}

/**
 * **The supervisor's queue** — `Settlement/Ledger?status=PENDING_APPROVAL&sort=age`,
 * the estate's pending surpluses across branches (story 8), oldest first as the door
 * sorts them.
 *
 * The two pending entries of 0719 plus one on another branch, so the queue is visibly
 * *across* the estate. Each row carries what story 9 asks a supervisor to see before
 * approving: the amount, the store, the accountant and the description.
 */
export const PENDING_LANE: SettlementOpenLaneRow[] = [
  {
    ...APPROVAL_ENTRIES.find((e) => e.entryNumber === 1202)!,
    storeName: APPROVAL_STORE_NAME,
    currencyKey: 'SAR',
    servedBy: HUDA.name,
    isMine: true,
    ageDays: 2,
  },
  {
    ...APPROVAL_ENTRIES.find((e) => e.entryNumber === 1203)!,
    storeName: APPROVAL_STORE_NAME,
    currencyKey: 'SAR',
    servedBy: HUDA.name,
    isMine: true,
    ageDays: 1,
  },
  {
    ...entry({
      settlementEntryId: '01J9APPR0688P1',
      entryNumber: 1207,
      entryKind: 'SURPLUS',
      amount: 512.75,
      reason: 'مرتجع شبكة — عميل 7002',
      status: 'PENDING_APPROVAL',
      postedAt: '2026-09-24T17:40:12',
    }),
    storeId: '0688',
    storeName: 'حطين / Hittin',
    // 🔑 Bahraini — the queue crosses currencies like every cross-estate list, so its
    // amounts are drawn per row and never totalled.
    currencyKey: 'BHD',
    servedBy: '',
    isMine: false,
    ageDays: 0,
  },
].sort((a, b) => (a.postedAt < b.postedAt ? -1 : a.postedAt > b.postedAt ? 1 : 0))

/**
 * **A SURPLUS upload whose large rows will wait** (1978 §3). The server marks each row
 * with `awaitsApproval`; waiting is neither an error nor a warning, so the file is
 * clean and commits.
 */
export const APPROVAL_PREVIEW: SettlementBulkPreview = {
  batchId: '01J9BATCHAPPROVAL',
  contentHash: 'sha256:5a0e91',
  entryKind: 'SURPLUS',
  rows: [
    bulkRow(2, '0142', 'الروضة / Al-Rawdah', 499.99, false),
    bulkRow(3, '0207', 'العليا / Al-Olaya', 500, true),
    bulkRow(4, '0331', 'النسيم / Al-Naseem', 1250.5, true),
    bulkRow(5, '0455', 'قرطبة / Qurtubah', 120, false),
  ],
  errors: [],
  warnings: [],
  rowCount: 4,
  canCommit: true,
  total: 2370.49,
}

function bulkRow(rowNumber: number, storeCode: string, storeName: string, amount: number, awaitsApproval: boolean) {
  return {
    rowNumber,
    storeCode,
    storeName,
    currencyKey: 'SAR',
    amount,
    fileAmount: amount,
    reason: 'فائض سبتمبر',
    awaitsApproval,
  }
}
