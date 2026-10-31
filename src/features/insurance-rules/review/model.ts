// The Review list and HQ exceptions as their doors send them (BackOffice 3135 + 3141; oms ticket 614).
// Only this feature reads them, so they live here, not in `core/insurance-rules`.
//
// Reconciled with 3135 / 3141 as built in oms 618: the wire rows (`ReviewReply`, `ExceptionReply`, `ExceptionLogReply`)
// are read by `reviewIn` / `exceptionIn` / `logIn` into the screen's model. Times are local wall-clock, no `Z`.
// Reconciled with 3290, 3293, 3295 and 3296 as built in oms 711: `GuardReviewItem`'s item fields, and the door's kind spellings.

import { driftSignalIn, type DriftSignal } from '@/core/insurance-rules/drift'
import type { Says } from '@/core/models/rule-campaign'
import type { LocalDate } from '@/core/util/date-window'
import type { ExceptionScope } from './exception'

/** What a review row records: a pharmacist's override, an HQ exception used, or a request sent UNCHECKED. */
/** `refused` (review 3126, story 51): a Bupa order whose check carries a live REFUSE no exception passed. */
export const DECISION_KINDS = ['override', 'exception', 'unchecked', 'refused'] as const

/**
 * The kinds that are not a counter decision (spec 3271), spelled as the door's `kind` filter takes them: nobody at a store
 * did anything, so they are read into a `ReviewDetail`. Drift is cleared with a note; the others are marked like a decision.
 * A new kind adds its name here, a `ReviewDetail` case in `detailOf`, and a case in `ReviewItems`' `ItemDetail`.
 */
export const ITEM_KINDS = ['monitor', 'not-evaluated', 'drift', 'upload-due', 'ig-package'] as const

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

/** Why a workbook upload is due (door 3296): a new package, or seen codes no loaded workbook lists. */
export const UPLOAD_DUE_REASONS = ['newPackage', 'unlistedCode'] as const
export type UploadDueReason = (typeof UPLOAD_DUE_REASONS)[number]

export interface PackageRename {
  from: string
  to: string
}

/** One part of an IG package's diff (door 3295): the names added, removed and renamed. */
export interface PackageDiffPart {
  added: string[]
  removed: string[]
  renamed: PackageRename[]
}

export const PACKAGE_GROUPS = ['profiles', 'extensions', 'codeSystems'] as const
export type PackageGroup = (typeof PACKAGE_GROUPS)[number]
export type PackageDiff = Record<PackageGroup, PackageDiffPart>

export const PACKAGE_CHANGES = ['added', 'removed', 'renamed'] as const
export type PackageChange = (typeof PACKAGE_CHANGES)[number]

export interface PackageDiffLine {
  change: PackageChange
  name: string
  renamedTo: string | null
}

export interface PackageDiffGroup {
  group: PackageGroup
  count: number
  lines: PackageDiffLine[]
}

/** A catalog field a new package no longer reads cleanly (door 3295). `ok` is left out. */
export const REVALIDATION_PROBLEMS = ['noMatches', 'misfit', 'badPath', 'notProbed'] as const
export type RevalidationProblem = (typeof REVALIDATION_PROBLEMS)[number]

export interface RevalidatedField {
  key: string
  status: RevalidationProblem
  why: string | null
}

/** The groups of a package diff that moved, in a fixed order; a group nothing happened to is left out. */
export function packageDiffGroups(diff: PackageDiff): PackageDiffGroup[] {
  return PACKAGE_GROUPS.flatMap((group) => {
    const part = diff[group]
    const lines: PackageDiffLine[] = [
      ...part.added.map((name) => ({ change: 'added' as const, name, renamedTo: null })),
      ...part.removed.map((name) => ({ change: 'removed' as const, name, renamedTo: null })),
      ...part.renamed.map((r) => ({ change: 'renamed' as const, name: r.from, renamedTo: r.to })),
    ]
    return lines.length ? [{ group, count: lines.length, lines }] : []
  })
}

/** What a row says beyond the columns every row has, by the kind it was read from. */
export type ReviewDetail =
  /** A counter decision: the store, pharmacist, patient and mark columns are its detail. */
  | { shape: 'decision' }
  /** A monitor fire (A2). Null severity: the server sent one this screen does not know, so no badge claims it. */
  | { shape: 'monitor'; severity: MonitorSeverity | null; text: Says; message: MessageRef | null }
  /** A failure, not a fire (A13): the answer that was left unread, and the server's error if it gave one. */
  | { shape: 'notEvaluated'; error: string | null; message: MessageRef | null }
  /** A workbook should be uploaded (door 3296). `codes` is a sample of `codeCount`. Null closedBy: still open. */
  | { shape: 'uploadDue'; why: UploadDueReason; version: string | null; codeCount: number; codes: { system: string; code: string }[]; closedBy: number | null }
  /** The IG package changed (door 3295); the door keeps the previous package's hash, not its version. */
  | { shape: 'package'; version: string | null; diff: PackageDiff; revalidation: RevalidatedField[] }
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
  /** A drift item only: who cleared it. Every other row is marked instead. */
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
  /** A monitor item's words, placeholders filled. */
  en?: string | null
  ar?: string | null
  /** A monitor or not-evaluated item's kept answer. */
  messageSource?: string | null
  messageId?: string | null
  answerVersion?: string | null
  lines?: string | null
  error?: string | null
  /** A drift item (door 3293): `signal`, `subject` and the two rates read by `driftSignalIn`. */
  payer?: string | null
  sampleSource?: string | null
  sampleId?: string | null
  sampleVersion?: string | null
  signal?: string | null
  subject?: string | null
  trailingRate?: number | null
  baselineRate?: number | null
  igPackage?: {
    name?: string | null
    version?: string | null
    diff?: { [G in PackageGroup]?: Partial<PackageDiffPart> | null } | null
    revalidation?: { key: string; status: string; why?: string | null }[] | null
  } | null
  uploadDue?: { packageVersion?: string | null; codeCount?: number | null; codes?: { system: string; code: string }[] | null; isOpen?: boolean | null; closedByVersion?: number | null } | null
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
  /** `mark: 'cleared'` is a drift item's clearing, not a reviewer's mark. */
  mark: { mark: string; note: string | null; by: string; at: string } | null
}

const oneOf = <T extends string>(known: readonly T[], value: string | null | undefined): T | null =>
  known.find((k) => k === value?.toLowerCase()) ?? null

const textOf = (r: ReviewReply): Says => ({ en: r.en ?? '', ar: r.ar ?? '' })

const refOf = (source: string | null | undefined, id: string | null | undefined): MessageRef | null => (id ? { source: source ?? '', id } : null)

const diffPart = (p: Partial<PackageDiffPart> | null | undefined): PackageDiffPart => ({ added: p?.added ?? [], removed: p?.removed ?? [], renamed: p?.renamed ?? [] })

function detailOf(r: ReviewReply): ReviewDetail {
  if ((DECISION_KINDS as readonly string[]).includes(r.kind)) return { shape: 'decision' }
  const message = refOf(r.messageSource, r.messageId)
  if (r.kind === 'monitor') return { shape: 'monitor', severity: oneOf(MONITOR_SEVERITIES, r.severity), text: textOf(r), message }
  if (r.kind === 'not-evaluated') return { shape: 'notEvaluated', error: r.error || null, message }
  if (r.kind === 'upload-due') {
    const due = r.uploadDue
    const codes = due?.codes ?? []
    return {
      shape: 'uploadDue',
      why: (due?.codeCount ?? 0) > 0 ? 'unlistedCode' : 'newPackage',
      version: due?.packageVersion || null,
      codeCount: due?.codeCount ?? 0,
      codes,
      closedBy: due?.isOpen === false ? (due.closedByVersion ?? 0) : null,
    }
  }
  if (r.kind === 'ig-package') {
    const p = r.igPackage
    return {
      shape: 'package',
      version: p?.version || null,
      diff: { profiles: diffPart(p?.diff?.profiles), extensions: diffPart(p?.diff?.extensions), codeSystems: diffPart(p?.diff?.codeSystems) },
      revalidation: (p?.revalidation ?? []).flatMap((f) => {
        const status = REVALIDATION_PROBLEMS.find((k) => k === f.status)
        return status ? [{ key: f.key, status, why: f.why || null }] : []
      }),
    }
  }
  if (r.kind === 'drift') return { shape: 'drift', payer: r.payer ?? '', signal: driftSignalIn(r), sample: refOf(r.sampleSource, r.sampleId) }
  return { shape: 'generic', text: textOf(r), message }
}

export const reviewIn = (r: ReviewReply): ReviewRow => ({
  id: r.id,
  kind: r.kind,
  detail: detailOf(r),
  cleared: r.mark?.mark === 'cleared' ? { note: r.mark.note ?? '', by: r.mark.by, at: r.mark.at } : null,
  at: r.at,
  store: r.store ?? '',
  pharmacist: r.pharmacist ?? '',
  patientKey: r.patient ?? '',
  ruleId: r.ruleId || null,
  item: r.item ? { code: r.item, name: '' } : null,
  reason: r.reason || null,
  note: r.note || null,
  exceptionId: r.exceptionId || null,
  mark: oneOf(REVIEW_MARKS, r.mark?.mark),
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
