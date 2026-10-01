import type {
  SettlementChangeRequest,
  SettlementChangeRequestActResult,
  SettlementChangeRequestHistory,
  SettlementEntry,
} from '@/core/models/settlement'

/**
 * **Change-request answers, built from BackOffice 2191–2195's `## Web contract`
 * samples, field for field** (spec 342, ticket 343) — the read model the pure suite
 * and `tools/settlement-change-drive.mjs` are both built against.
 *
 * ⚠️ **Stubs of an unshipped wave.** The four doors live on BackOffice branch
 * `spec2149`, not yet on any SIS.Api this app can reach. Every shape below is the
 * contract's, and no field is invented: where the contract leaves a value open (the
 * requester of a waiting request), it is filled with this repo's own fixture staff.
 *
 * 🔑 **The History read is built FROM an account entry**, not typed beside it, so the
 * figures a drive serves on `Settlement/Account` and on `Settlement/ChangeRequest/History`
 * cannot disagree about the entry they describe. `spentAmount` is the one figure the
 * caller states — it is the SERVER's (`amount − remaining` net of reversals, computed
 * there), and this fixture does not compute it either.
 */

/** 2191's sample ids — the request and the entry its answers name. */
export const SAMPLE_REQUEST_ID = '01K6G8Z3N4QH5V2C7M9R1T0XYB'
export const SAMPLE_ENTRY_ID = '01K6F2A9W8E3R5T7Y1U4I6O8PA'

/** `NOT NULL` with a default: the server's *no time / no day*. */
export const UNSTAMPED = '0001-01-01T00:00:00'

/** The accountant who asked — this repo's fixture staff (`settlement-fixture.ts`). */
export const REQUESTER = { staffId: '30117', name: 'هدى القحطاني / Huda Al-Qahtani' }

/**
 * **2191's sample answer, verbatim** — a raise or approve that applied 300.000 to
 * entry 143. 2195 adds `businessDay` to every act response; a shortage carries the
 * year-1 day.
 */
export const APPLIED_SAMPLE: SettlementChangeRequestActResult = {
  accepted: true,
  refusalReason: '',
  changeRequestId: SAMPLE_REQUEST_ID,
  requestStatus: 'APPLIED',
  settlementEntryId: SAMPLE_ENTRY_ID,
  entryNumber: 143,
  amount: 300.0,
  remainingAmount: 300.0,
  spentAmount: 0.0,
  description: 'عجز نقدي — مراجعة سبتمبر',
  entryStatus: 'OPEN',
  businessDay: UNSTAMPED,
}

/** **2192's sample answer, verbatim** — refused `BELOW_SPENT` on entry 151, spent 350. */
export const BELOW_SPENT_SAMPLE: SettlementChangeRequestActResult = {
  accepted: false,
  refusalReason: 'BELOW_SPENT',
  changeRequestId: SAMPLE_REQUEST_ID,
  requestStatus: 'OPEN',
  settlementEntryId: SAMPLE_ENTRY_ID,
  entryNumber: 151,
  amount: 500.0,
  remainingAmount: 150.0,
  spentAmount: 350.0,
  description: 'فائض نقدي — مراجعة سبتمبر',
  entryStatus: 'OPEN',
  businessDay: UNSTAMPED,
}

type EntryLike = Pick<
  SettlementEntry,
  'settlementEntryId' | 'storeId' | 'entryNumber' | 'status' | 'amount' | 'remainingAmount' | 'reason' | 'businessDay'
>

/**
 * A request still **waiting** on an entry — 2191's row shape, `OPEN`, nothing decided.
 * Unchanged fields carry the same value in `old…` and `new…`, as the contract says.
 */
export function waitingRequestOn(
  entry: EntryLike,
  asked: Partial<Pick<SettlementChangeRequest, 'requestKind' | 'newAmount' | 'newDescription' | 'newBusinessDay'>> &
    Partial<Pick<SettlementChangeRequest, 'changeRequestId' | 'requestedByStaffId' | 'requestedByName' | 'requestedAt' | 'requestReason'>> = {},
): SettlementChangeRequest {
  return {
    changeRequestId: asked.changeRequestId ?? SAMPLE_REQUEST_ID,
    settlementEntryId: entry.settlementEntryId,
    storeId: entry.storeId,
    requestKind: asked.requestKind ?? 'CHANGE',
    status: 'OPEN',
    oldAmount: entry.amount,
    newAmount: asked.newAmount ?? entry.amount,
    oldDescription: entry.reason,
    newDescription: asked.newDescription ?? entry.reason,
    oldBusinessDay: entry.businessDay,
    newBusinessDay: asked.newBusinessDay ?? entry.businessDay,
    spentAtDecision: 0,
    requestedByStaffId: asked.requestedByStaffId ?? REQUESTER.staffId,
    requestedByName: asked.requestedByName ?? REQUESTER.name,
    requestedAt: asked.requestedAt ?? '2026-09-30T10:42:00',
    requestReason: asked.requestReason ?? 'المبلغ الصحيح حسب محضر الجرد',
    decidedByStaffId: '',
    decidedByName: '',
    decidedAt: UNSTAMPED,
    decisionReason: '',
  }
}

/** The History read of one entry, its figures the entry's own and `spentAmount` the caller's. */
export function historyOf(
  entry: EntryLike,
  read: { spentAmount: number; openRequest?: SettlementChangeRequest | null; requests?: SettlementChangeRequest[] },
): SettlementChangeRequestHistory {
  const openRequest = read.openRequest ?? null
  return {
    settlementEntryId: entry.settlementEntryId,
    openRequest,
    requests: read.requests ?? (openRequest ? [openRequest] : []),
    entryNumber: entry.entryNumber,
    entryStatus: entry.status,
    amount: entry.amount,
    remainingAmount: entry.remainingAmount,
    spentAmount: read.spentAmount,
  }
}

/** An accepted raise of `request` — `requestStatus: "OPEN"`, the entry's figures unchanged. */
export function raisedAnswerFor(
  entry: EntryLike,
  request: Pick<SettlementChangeRequest, 'changeRequestId'>,
  spentAmount: number,
): SettlementChangeRequestActResult {
  return {
    accepted: true,
    refusalReason: '',
    changeRequestId: request.changeRequestId,
    requestStatus: 'OPEN',
    settlementEntryId: entry.settlementEntryId,
    entryNumber: entry.entryNumber,
    amount: entry.amount,
    remainingAmount: entry.remainingAmount,
    spentAmount,
    description: entry.reason,
    entryStatus: entry.status,
    businessDay: entry.businessDay,
  }
}
