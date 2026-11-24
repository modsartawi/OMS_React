/**
 * Parked returns (BackOffice spec 4212; the doors are BackOffice 4218's, `RefundLedgerWeb/ParkedReturns`). A **parked
 * return** waits at the till until its refund ledger rows (its **grains**) reach an end state. The wire is camelCased C#,
 * read field by field by the feature's `wire` module into these shapes.
 */

/** `ParkedReturnStates`. */
export type ParkedReturnState = 'NEEDS_HQ' | 'WAITING_FOR_PARTNER' | 'WAITING_FOR_STORE' | 'FINISHED'

/** `ParkedReturnNeedsHqReasons`: why nobody but HQ will move it. A return may carry several. */
export type NeedsHqReason = 'NO_STATUS_API' | 'ESCALATED' | 'AGED' | 'UNCHECKED_FAILURE' | 'MIXED' | 'ROWLESS'

/** `ParkedReturnParkReasons` (blank = unknown). */
export type ParkReason = 'AMBIGUOUS_ANSWER' | 'HELD_AT_COMPLETION'

/** `RefundLedgerStatus`. */
export type LedgerStatus = 'PENDING' | 'SUBMITTED' | 'REFUNDED' | 'FAILED'

/** The list's query, under the door's own names. A blank value is dropped by `@/core/api`'s `buildQuery`. */
export interface ParkedReturnsQuery {
  store: string
  partner: string
  ledgerStatus: string
  minAgeDays: number | null
  needsHq: boolean
  includeFinished: boolean
  transactionId: string
  /** 1-based. */
  page: number
  pageSize: number
}

/** One list row. Optional times read as '' when the server sends none. */
export interface ParkedReturnRow {
  transactionId: string
  storeCode: string
  registerId: string
  operatorId: string
  parkedAt: string
  state: string
  needsHqReasons: string[]
  /** False: a ledger row whose return the store never mirrored ("store details not received"). */
  storeDetailsReceived: boolean
  mirrorStatus: string
  partners: string[]
  ledgerStatuses: string[]
  grainCount: number
  refundAmount: number
  parkDeadline: string
  escalated: boolean
  cashRuled: boolean
  lastSettledBy: string
  lastSettledTime: string
}

export interface ParkedReturnsPage {
  total: number
  needsHqTotal: number
  rows: ParkedReturnRow[]
}

export interface ParkedReturnHeader {
  storeCode: string
  registerId: string
  operatorId: string
  customerId: string
  loyaltyId: string
  loyaltyMobile: string
  parkedAt: string
  mirrorStatus: string
  originalTransactionId: string
  originalReceiptNumber: string
  currency: string
  grandTotal: number
  parkReason: string
}

export interface ParkedReturnLine {
  lineNumber: number
  materialNumber: string
  description: string
  quantity: number
  unitOfMeasure: string
  grandTotal: number
  returnReasonCode: string
  originalLineNumber: number
  isVoided: boolean
}

export interface ParkedReturnTender {
  tenderNumber: number
  tenderType: string
  amount: number
  isRefund: boolean
  isParked: boolean
  /** The refund reference printed on the store's parked slip. */
  refundReference: string
  settlementState: string
}

export interface ParkedReturnGrain {
  refundId: string
  partner: string
  tenderType: string
  grainKey: string
  originalReference: string
  partnerRefundReference: string
  amount: number
  status: string
  hasStatusApi: boolean
  addedTime: string
  parkDeadline: string
  escalated: boolean
  awaitingHq: boolean
  settledBy: string
  settledTime: string
  cashRuled: boolean
  cashReason: string
  partnerEvidence: string
}

export interface ParkedReturnDetail {
  transactionId: string
  state: string
  needsHqReasons: string[]
  storeDetailsReceived: boolean
  resumeResolution: string
  canFinalize: boolean
  /** Null when the store never mirrored the return. */
  header: ParkedReturnHeader | null
  lines: ParkedReturnLine[]
  tenders: ParkedReturnTender[]
  grains: ParkedReturnGrain[]
}
