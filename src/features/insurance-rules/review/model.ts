// The Review list and HQ exceptions as their doors send them (BackOffice 3135 + 3141; oms ticket 614).
// Only this feature reads them, so they live here, not in `core/insurance-rules`.
//
// Reconciled with 3135 / 3141 as built in oms 618: the wire rows (`ReviewReply`, `ExceptionReply`, `ExceptionLogReply`)
// are read by `reviewIn` / `exceptionIn` / `logIn` into the screen's model. Times are local wall-clock, no `Z`.

import type { LocalDate } from '@/core/util/date-window'
import type { ExceptionScope } from './exception'

/** What a review row records: a pharmacist's override, an HQ exception used, or a request sent UNCHECKED. */
/** `refused` (review 3126, story 51): a Bupa order whose check carries a live REFUSE no exception passed. */
export const REVIEW_KINDS = ['override', 'exception', 'unchecked', 'refused'] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]

export const REVIEW_MARKS = ['ok', 'questioned'] as const
export type ReviewMark = (typeof REVIEW_MARKS)[number]

/** One row of `GET InsuranceRules/Review`. */
export interface ReviewRow {
  /** The decision row's id — `POST InsuranceRules/Review/{id}` marks it. */
  id: string
  kind: ReviewKind
  /** Local moment of the decision. */
  at: string
  store: string
  pharmacist: string
  /** As the server sends it — masked where the reader has no patient grant. */
  patientKey: string
  /** Null on an UNCHECKED request (no rule ran). */
  ruleId: string | null
  item: { code: string; name: string } | null
  /** The reason code given (an override), or the exception's reason. */
  reason: string | null
  note: string | null
  /** The exception used, on a `kind: exception` row. */
  exceptionId: string | null
  mark: ReviewMark | null
  markNote: string | null
  markedBy: string | null
  markedAt: string | null
}

/** One row of `GET InsuranceRules/Review` as built (3141): `item` a comma list, `patient` masked, `mark` an object. */
export interface ReviewReply {
  id: string
  kind: ReviewKind
  at: string
  store: string
  pharmacist: string
  channel?: string | null
  sourceRef?: string | null
  ruleId: string | null
  ruleVersion?: number | null
  severity?: string | null
  item: string | null
  patient: string | null
  intervention?: string | null
  outcome?: string | null
  reason: string | null
  note: string | null
  exceptionId: string | null
  mark: { mark: ReviewMark; note: string | null; by: string; at: string } | null
}

export const reviewIn = (r: ReviewReply): ReviewRow => ({
  id: r.id,
  kind: r.kind,
  at: r.at,
  store: r.store ?? '',
  pharmacist: r.pharmacist ?? '',
  patientKey: r.patient ?? '',
  ruleId: r.ruleId || null,
  item: r.item ? { code: r.item, name: '' } : null,
  reason: r.reason || null,
  note: r.note || null,
  exceptionId: r.exceptionId || null,
  mark: r.mark?.mark ?? null,
  markNote: r.mark?.note || null,
  markedBy: r.mark?.by || null,
  markedAt: r.mark?.at || null,
})

/** One exception as `GET / POST InsuranceRules/Exceptions` and `…/{id}/Revoke` send it (3135). */
export interface ExceptionReply {
  exceptionId: string
  patientKey: string
  ruleId: string | null
  /** One of the three set, the others null. */
  scope: { item?: string | null; sameKind?: string | null; list?: string | null }
  validUntil: LocalDate
  reason: string
  note: string
  issuedBy: string
  issuedAt: string
  revokedBy: string | null
  revokedAt: string | null
  revokeNote: string | null
  active: boolean
}

export function exceptionIn(e: ExceptionReply): GuardException {
  const s = e.scope ?? {}
  const scope: ExceptionScope = s.item ? { item: s.item } : s.sameKind ? { sameKind: s.sameKind } : { list: s.list ?? '' }
  return {
    id: e.exceptionId,
    patientKey: e.patientKey,
    ruleId: e.ruleId || null,
    scope,
    validUntil: e.validUntil,
    reason: e.reason,
    note: e.note,
    issuedBy: e.issuedBy,
    issuedAt: e.issuedAt,
    revokedBy: e.revokedBy || null,
    revokedAt: e.revokedAt || null,
    revokeNote: e.revokeNote || null,
    uses: null,
  }
}

/** One row of `GET InsuranceRules/Exceptions/{id}/Log` as built (3135). */
export interface ExceptionLogReply {
  at: string
  by: string
  action: ExceptionLogKind
  note: string
  checkId: string | null
  channel: string | null
  sourceRef: string | null
  line: number | null
  ruleId: string | null
  severity: string | null
  store: string | null
}

export const logIn = (l: ExceptionLogReply): ExceptionLogEntry => ({
  at: l.at,
  kind: l.action,
  by: l.by,
  store: l.store || null,
  ruleId: l.ruleId || null,
  sourceRef: l.sourceRef || null,
  note: l.note || null,
})

/** One exception of the list. */
export interface GuardException {
  id: string
  patientKey: string
  /** Null = every guard. */
  ruleId: string | null
  scope: ExceptionScope
  validUntil: LocalDate
  reason: string
  note: string
  issuedBy: string
  issuedAt: string
  revokedBy: string | null
  revokedAt: string | null
  revokeNote?: string | null
  /** HQ's list carries no use count (the log has every use): null. */
  uses: number | null
}

export const EXCEPTION_LOG_KINDS = ['issue', 'revoke', 'use'] as const
export type ExceptionLogKind = (typeof EXCEPTION_LOG_KINDS)[number]

/** One entry of `GET InsuranceRules/Exceptions/{id}/Log`: issue, revoke and every use. */
export interface ExceptionLogEntry {
  at: string
  kind: ExceptionLogKind
  by: string
  /** On a use: where and on which request. */
  store: string | null
  ruleId: string | null
  sourceRef: string | null
  /** The issue's or the revoke's note. */
  note?: string | null
}
