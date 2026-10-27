// The Review list and HQ exceptions as their doors send them (BackOffice 3135 + 3141; oms ticket 614).
// Only this feature reads them, so they live here, not in `core/insurance-rules`.
//
// ⚠️ PROVISIONAL: the brief spells the doors and the bodies they TAKE, not the rows they return. Every row
// field below is a guess recorded on ticket 614 for 618 to reconcile. Times are local wall-clock, no `Z`.

import type { LocalDate } from '@/core/util/date-window'
import type { ExceptionScope } from './exception'

/** What a review row records: a pharmacist's override, an HQ exception used, or a request sent UNCHECKED. */
export const REVIEW_KINDS = ['override', 'exception', 'unchecked'] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]

export const REVIEW_MARKS = ['ok', 'questioned'] as const
export type ReviewMark = (typeof REVIEW_MARKS)[number]

/** A coded word with its EN/AR twins (`GET Guards/Reasons` entries). */
export interface CodedWord {
  code: string
  en: string
  ar: string
  active: boolean
}

/** `GET Guards/Reasons` (3134). Only `reason` is read here. */
export interface GuardReasons {
  intervention: CodedWord[]
  outcome: CodedWord[]
  reason: CodedWord[]
}

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

/** One row of `GET InsuranceRules/Exceptions` (the list door itself is a guess). */
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
  uses: number
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
}
