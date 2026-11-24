/**
 * The settle actions' pure half (BackOffice ticket 4225, spec 4212 stories 14-22; doors BackOffice 4219,
 * `POST RefundLedgerWeb/Grains/{refundId}/Settle` and `POST RefundLedgerWeb/ParkedReturns/{transactionId}/ResolveRowless`).
 * No React, no `t`: what may be sent, which buttons a grain offers, and a refusal's sentence key.
 */
import { apiErrorCode, isBareDenial } from '@/core/api'

/** `ParkedReturnSettleOutcomes`. */
export type SettleOutcome = 'REFUNDED' | 'VOID_AFTER_CHECK' | 'PAY_IN_CASH'

/** The settle door's body. Reason and evidence are Pay-in-cash only. */
export interface SettleRequest {
  outcome: SettleOutcome
  reason?: string
  partnerEvidence?: string
}

/** Pay in cash: why, at most the server's 500 (`ParkedReturnSettleRequest.Reason`). */
export const CASH_REASON_MAX = 500
/** Pay in cash: what the partner's dashboard showed, at most the server's 1000 (`PartnerEvidence`). */
export const CASH_EVIDENCE_MAX = 1000

/** Text cut at a width — the dialog's fields never hold more than the server keeps. */
export const clampTo = (text: string, max: number): string => (text.length > max ? text.slice(0, max) : text)

export interface CashCommit {
  canCommit: boolean
  reasonMissing: boolean
  evidenceMissing: boolean
  reasonTooLong: boolean
  evidenceTooLong: boolean
  /** The body to send, or null while it may not be sent. */
  body: SettleRequest | null
}

/**
 * Pay in cash may be sent only with BOTH a reason and what the partner's dashboard showed (story 17), each non-blank and
 * within its width once trimmed — never twice at once.
 */
export function cashCommit({ reason, evidence, pending }: { reason: string; evidence: string; pending: boolean }): CashCommit {
  const r = reason.trim()
  const e = evidence.trim()
  const reasonMissing = r === ''
  const evidenceMissing = e === ''
  const reasonTooLong = r.length > CASH_REASON_MAX
  const evidenceTooLong = e.length > CASH_EVIDENCE_MAX
  const canCommit = !pending && !reasonMissing && !evidenceMissing && !reasonTooLong && !evidenceTooLong
  return {
    canCommit,
    reasonMissing,
    evidenceMissing,
    reasonTooLong,
    evidenceTooLong,
    body: canCommit ? { outcome: 'PAY_IN_CASH', reason: r, partnerEvidence: e } : null,
  }
}

const IN_FLIGHT = ['PENDING', 'SUBMITTED']

/**
 * The settle buttons one grain offers, in the server's own preconditions (BackOffice 4219 / 4215): nothing without the
 * settle right (story 23), on a return finished at the till, or on a grain a person already settled (story 21).
 * Refunded is for an in-flight grain; Void after check and Pay in cash for an in-flight grain or a FAILED one nobody
 * settled yet (story 18: the reconciler's FAILED is a guess until HQ checks it). A refunded grain is an end state.
 */
export function grainActions(
  grain: { status: string; settledBy: string },
  { canSettle, returnState }: { canSettle: boolean; returnState: string },
): SettleOutcome[] {
  if (!canSettle || returnState === 'FINISHED' || grain.settledBy.trim() !== '') return []
  if (IN_FLIGHT.includes(grain.status)) return ['REFUNDED', 'VOID_AFTER_CHECK', 'PAY_IN_CASH']
  if (grain.status === 'FAILED') return ['VOID_AFTER_CHECK', 'PAY_IN_CASH']
  return []
}

/**
 * "Resolve row-less" (story 20): a return the store mirrored as parked with NO ledger row, not finished at the till, and
 * only with the settle right. A return with any grain is settled grain by grain instead (the server refuses it as
 * `PARKED_RETURN_NOT_ROWLESS`).
 */
export function canResolveRowless(
  detail: { state: string; header: unknown; grains: readonly unknown[] },
  canSettle: boolean,
): boolean {
  return canSettle && detail.state !== 'FINISHED' && detail.header !== null && detail.grains.length === 0
}

/** `ParkedReturnSettleErrorCodes` (BackOffice 4219), in the server's check order. */
export const SETTLE_REFUSAL_CODES = [
  'PARKED_RETURN_NO_SETTLER',
  'PARKED_RETURN_INVALID_OUTCOME',
  'PARKED_RETURN_REASON_REQUIRED',
  'PARKED_RETURN_EVIDENCE_REQUIRED',
  'PARKED_RETURN_NOT_FOUND',
  'PARKED_RETURN_ALREADY_SETTLED',
  'PARKED_RETURN_FINISHED_AT_TILL',
  'PARKED_RETURN_NOT_SETTLEABLE',
  'PARKED_RETURN_SETTLED_CONCURRENTLY',
  'PARKED_RETURN_INVALID_STATUS',
  'PARKED_RETURN_NOT_ROWLESS',
] as const

export type SettleRefusalCode = (typeof SETTLE_REFUSAL_CODES)[number]

/**
 * A settle or row-less refusal as a sentence key in the `parked-returns` namespace (`refusal.<code>`), or
 * `refusal.noSettleRight` for a bare 403 (the grant filter, before any handler). `null` for anything else — an unknown
 * code, a server fault, a bug: the caller shows the server's own message then.
 */
export function settleRefusalKey(err: unknown): string | null {
  if (isBareDenial(err)) return 'refusal.noSettleRight'
  const code = apiErrorCode(err)
  return code && (SETTLE_REFUSAL_CODES as readonly string[]).includes(code) ? `refusal.${code}` : null
}

/** The row-less resolve form, as typed (the amount stays text until it is sent). */
export interface RowlessForm {
  status: string
  partner: string
  tenderType: string
  originalReference: string
  amount: string
  storeCode: string
  operatorId: string
}

/** The row-less door's body (`ParkedReturnRowlessResolveRequest`; the press key is left to the server's whole-return default). */
export interface RowlessRequest {
  status: 'REFUNDED' | 'FAILED'
  partner: string
  tenderType: string
  originalReference: string
  storeCode: string
  operatorId: string
  amount: number
}

/**
 * The form starts from what the store mirrored: its store and cashier, and — when exactly ONE refund tender parked — that
 * tender's type and amount. The outcome and the partner are always HQ's to choose.
 */
export function rowlessSeed(detail: {
  header: { storeCode: string; operatorId: string } | null
  tenders: readonly { tenderType: string; amount: number; isRefund: boolean; isParked: boolean }[]
}): RowlessForm {
  const parked = detail.tenders.filter((t) => t.isRefund && t.isParked)
  const one = parked.length === 1 ? parked[0] : null
  return {
    status: '',
    partner: '',
    tenderType: one?.tenderType ?? '',
    originalReference: '',
    amount: one ? String(one.amount) : '',
    storeCode: detail.header?.storeCode ?? '',
    operatorId: detail.header?.operatorId ?? '',
  }
}

/** The row-less resolve may be sent with an outcome (REFUNDED or FAILED), a partner, a tender and an amount above zero. */
export function rowlessCommit(form: RowlessForm, pending: boolean): { canCommit: boolean; body: RowlessRequest | null } {
  const status = form.status === 'REFUNDED' || form.status === 'FAILED' ? form.status : null
  const partner = form.partner.trim()
  const tenderType = form.tenderType.trim()
  const amountText = form.amount.trim()
  const amount = amountText === '' ? NaN : Number(amountText)
  if (pending || !status || partner === '' || tenderType === '' || !Number.isFinite(amount) || amount <= 0)
    return { canCommit: false, body: null }
  return {
    canCommit: true,
    body: {
      status,
      partner,
      tenderType,
      originalReference: form.originalReference.trim(),
      storeCode: form.storeCode.trim(),
      operatorId: form.operatorId.trim(),
      amount,
    },
  }
}
