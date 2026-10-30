// The Review list and HQ exceptions as their doors send them (BackOffice 3135 + 3141; oms ticket 614).
// Only this feature reads them, so they live here, not in `core/insurance-rules`.
//
// Reconciled with 3135 / 3141 as built in oms 618: the wire rows (`ReviewReply`, `ExceptionReply`, `ExceptionLogReply`)
// are read by `reviewIn` / `exceptionIn` / `logIn` into the screen's model. Times are local wall-clock, no `Z`.

import { driftSignalIn, type DriftSignal, type DriftSignalReply } from '@/core/insurance-rules/drift'
import type { Says } from '@/core/models/rule-campaign'
import type { LocalDate } from '@/core/util/date-window'
import type { ExceptionScope } from './exception'

/** What a review row records: a pharmacist's override, an HQ exception used, or a request sent UNCHECKED. */
/** `refused` (review 3126, story 51): a Bupa order whose check carries a live REFUSE no exception passed. */
export const DECISION_KINDS = ['override', 'exception', 'unchecked', 'refused'] as const

/**
 * The kinds that are not a counter decision (spec 3271): nobody at a store did anything, so they carry no pharmacist
 * and no mark. They are read into a `ReviewDetail` and cleared with a note. A new kind (703, 708) adds its name
 * here, a `ReviewDetail` case in `detailOf`, and a case in `ReviewItems`' `ItemDetail`.
 */
export const ITEM_KINDS = ['monitor', 'notEvaluated', 'drift'] as const

/** Every kind this screen can offer as a filter. A row's own `kind` may be one the screen has never heard of. */
export const REVIEW_KINDS = [...DECISION_KINDS, ...ITEM_KINDS] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]

/** A kept payer message: `(source, id)`. A reference, never a fragment of the bundle. */
export interface MessageRef {
  source: string
  id: string
}

export const MONITOR_SEVERITIES = ['info', 'action'] as const
export type MonitorSeverity = (typeof MONITOR_SEVERITIES)[number]

/** What failed and so left an answer unread (A13). */
export const EVALUATION_FAILURES = ['watcher', 'monitor'] as const
export type EvaluationFailure = (typeof EVALUATION_FAILURES)[number]

/** What a row says beyond the columns every row has, by the kind it was read from. */
export type ReviewDetail =
  /** A counter decision: the store, pharmacist, patient and mark columns are its detail. */
  | { shape: 'decision' }
  /** A monitor fire (A2). Null severity: the server sent one this screen does not know, so no badge claims it. */
  | { shape: 'monitor'; severity: MonitorSeverity | null; text: Says; message: MessageRef | null }
  /** A failure, not a fire (A13): the answer that was left unread, and what failed if the server said. */
  | { shape: 'notEvaluated'; failure: EvaluationFailure | null; message: MessageRef | null }
  /** Payer drift (D5): who, what changed, and a sample that is a reference, never a fragment of the bundle. */
  | { shape: 'drift'; payer: string; signal: DriftSignal; sample: MessageRef | null }
  /** A kind the screen does not know: whatever text and message it carried, and never a throw. */
  | { shape: 'generic'; text: Says; message: MessageRef | null }

/** Who cleared an item, and why. */
export interface ReviewCleared {
  note: string
  by: string
  at: string
}

export const REVIEW_MARKS = ['ok', 'questioned'] as const
export type ReviewMark = (typeof REVIEW_MARKS)[number]

/** One row of `GET InsuranceRules/Review`. */
export interface ReviewRow {
  /** The decision row's id — `POST InsuranceRules/Review/{id}` marks it. */
  id: string
  /** As sent. Read `detail.shape` to branch: this may be a kind the screen has never heard of. */
  kind: string
  detail: ReviewDetail
  /** Item kinds only: who cleared it. Null on a decision, which is marked instead. */
  cleared: ReviewCleared | null
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
  /** A string, not `ReviewKind`: the door may add a kind before this screen knows it. */
  kind: string
  at: string
  store: string
  pharmacist: string
  /** 🚩 Item kinds' fields are guessed (door 3290; 711 reconciles): `text`, `message`, `failure`, `cleared`. */
  text?: Partial<Says> | null
  message?: MessageRef | null
  failure?: string | null
  /** 🚩 A drift item's fields are guessed (door 3293; 711 reconciles). */
  payer?: string | null
  signal?: DriftSignalReply | null
  sample?: MessageRef | null
  cleared?: ReviewCleared | null
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

const oneOf = <T extends string>(known: readonly T[], value: string | null | undefined): T | null =>
  known.find((k) => k === value?.toLowerCase()) ?? null

const textOf = (r: ReviewReply): Says => ({ en: r.text?.en ?? '', ar: r.text?.ar ?? '' })

function detailOf(r: ReviewReply): ReviewDetail {
  if ((DECISION_KINDS as readonly string[]).includes(r.kind)) return { shape: 'decision' }
  const message = r.message ?? null
  if (r.kind === 'monitor') return { shape: 'monitor', severity: oneOf(MONITOR_SEVERITIES, r.severity), text: textOf(r), message }
  if (r.kind === 'notEvaluated') return { shape: 'notEvaluated', failure: oneOf(EVALUATION_FAILURES, r.failure), message }
  if (r.kind === 'drift') return { shape: 'drift', payer: r.payer ?? '', signal: driftSignalIn(r.signal), sample: r.sample ?? null }
  return { shape: 'generic', text: textOf(r), message }
}

export const reviewIn = (r: ReviewReply): ReviewRow => ({
  id: r.id,
  kind: r.kind,
  detail: detailOf(r),
  cleared: r.cleared ?? null,
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
