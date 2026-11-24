/**
 * The parked-returns doors' answers, read FIELD BY FIELD (BackOffice ticket 4224; contract in BackOffice 4218's comments).
 * Nothing is spread from the wire: an object is rebuilt from the agreed fields only. Missing lists read as empty, a
 * missing number as 0, a missing text or optional time as ''.
 */
import type {
  ParkedReturnDetail,
  ParkedReturnGrain,
  ParkedReturnHeader,
  ParkedReturnLine,
  ParkedReturnRow,
  ParkedReturnsPage,
  ParkedReturnTender,
} from '@/core/models/parked-returns'

type Raw = Record<string, unknown>

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const yes = (v: unknown): boolean => v === true
const list = <T>(v: unknown, read: (raw: Raw) => T): T[] => (Array.isArray(v) ? v.filter(isRaw).map(read) : [])
const words = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s) => s !== '') : [])

export const readRow = (r: Raw): ParkedReturnRow => ({
  transactionId: str(r.transactionId),
  storeCode: str(r.storeCode),
  registerId: str(r.registerId),
  operatorId: str(r.operatorId),
  parkedAt: str(r.parkedAt),
  state: str(r.state),
  needsHqReasons: words(r.needsHqReasons),
  storeDetailsReceived: yes(r.storeDetailsReceived),
  mirrorStatus: str(r.mirrorStatus),
  partners: words(r.partners),
  ledgerStatuses: words(r.ledgerStatuses),
  grainCount: num(r.grainCount),
  refundAmount: num(r.refundAmount),
  parkDeadline: str(r.parkDeadline),
  escalated: yes(r.escalated),
  cashRuled: yes(r.cashRuled),
  lastSettledBy: str(r.lastSettledBy),
  lastSettledTime: str(r.lastSettledTime),
})

/** `{ total, needsHqTotal, page, pageSize, rows }`. */
export function readListPage(raw: unknown): ParkedReturnsPage {
  if (!isRaw(raw)) return { total: 0, needsHqTotal: 0, rows: [] }
  return { total: num(raw.total), needsHqTotal: num(raw.needsHqTotal), rows: list(raw.rows, readRow) }
}

const readHeader = (r: Raw): ParkedReturnHeader => ({
  storeCode: str(r.storeCode),
  registerId: str(r.registerId),
  operatorId: str(r.operatorId),
  customerId: str(r.customerId),
  loyaltyId: str(r.loyaltyId),
  loyaltyMobile: str(r.loyaltyMobile),
  parkedAt: str(r.parkedAt),
  mirrorStatus: str(r.mirrorStatus),
  originalTransactionId: str(r.originalTransactionId),
  originalReceiptNumber: str(r.originalReceiptNumber),
  currency: str(r.currency),
  grandTotal: num(r.grandTotal),
  parkReason: str(r.parkReason),
})

const readLine = (r: Raw): ParkedReturnLine => ({
  lineNumber: num(r.lineNumber),
  materialNumber: str(r.materialNumber),
  description: str(r.description),
  quantity: num(r.quantity),
  unitOfMeasure: str(r.unitOfMeasure),
  grandTotal: num(r.grandTotal),
  returnReasonCode: str(r.returnReasonCode),
  originalLineNumber: num(r.originalLineNumber),
  isVoided: yes(r.isVoided),
})

const readTender = (r: Raw): ParkedReturnTender => ({
  tenderNumber: num(r.tenderNumber),
  tenderType: str(r.tenderType),
  amount: num(r.amount),
  isRefund: yes(r.isRefund),
  isParked: yes(r.isParked),
  refundReference: str(r.refundReference),
  settlementState: str(r.settlementState),
})

const readGrain = (r: Raw): ParkedReturnGrain => ({
  refundId: str(r.refundId),
  partner: str(r.partner),
  tenderType: str(r.tenderType),
  grainKey: str(r.grainKey),
  originalReference: str(r.originalReference),
  partnerRefundReference: str(r.partnerRefundReference),
  amount: num(r.amount),
  status: str(r.status),
  hasStatusApi: yes(r.hasStatusApi),
  addedTime: str(r.addedTime),
  parkDeadline: str(r.parkDeadline),
  escalated: yes(r.escalated),
  awaitingHq: yes(r.awaitingHq),
  settledBy: str(r.settledBy),
  settledTime: str(r.settledTime),
  cashRuled: yes(r.cashRuled),
  cashReason: str(r.cashReason),
  partnerEvidence: str(r.partnerEvidence),
})

/** `{ transactionId, state, needsHqReasons, storeDetailsReceived, resumeResolution, canFinalize, header?, lines, tenders, grains }`. */
export function readDetail(raw: unknown): ParkedReturnDetail {
  const r = isRaw(raw) ? raw : {}
  return {
    transactionId: str(r.transactionId),
    state: str(r.state),
    needsHqReasons: words(r.needsHqReasons),
    storeDetailsReceived: yes(r.storeDetailsReceived),
    resumeResolution: str(r.resumeResolution),
    canFinalize: yes(r.canFinalize),
    header: isRaw(r.header) ? readHeader(r.header) : null,
    lines: list(r.lines, readLine),
    tenders: list(r.tenders, readTender),
    grains: list(r.grains, readGrain),
  }
}
