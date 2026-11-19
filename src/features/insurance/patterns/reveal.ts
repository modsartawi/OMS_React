/**
 * The investigator's reveal of a case's patient (oms 923; BackOffice spec 4050 story 15, door 4053
 * `POST …/Cases/{caseId}/Reveal`). Pure: the dialog reads its problem from here, and the door sends only a body this
 * module made.
 *
 * 🔒 What the door answers (the patient key and the member id) is NOT a model and does not live in
 * `@/core/models/insurance-patterns` (`./no-identity.test.ts` holds that file to it). It is read here, handed to the
 * caller, and held in the reveal dialog's own state only: never the query client, the URL, storage, a log or a toast
 * (`./reveal-contract.test.ts`).
 */
import { isBareDenial } from '@/core/api'

/**
 * The fewest characters a reason has, once trimmed: BackOffice 4053 refuses a shorter one. Counted as the server counts
 * a string (UTF-16 units), so an Arabic reason counts letter by letter as an English one.
 */
export const REASON_MIN = 10

/**
 * The most characters a reason has, once trimmed. BackOffice 4053 keeps it in an `NVARCHAR(250)` and clamps it; the
 * client refuses past this rather than let the log keep a reason cut short.
 */
export const REASON_MAX = 250

/** Why a reason cannot be sent: too short or too long, once trimmed. */
export type RevealProblem = 'short' | 'tooLong'

export function revealProblem(reason: string): RevealProblem | null {
  const length = reason.trim().length
  if (length < REASON_MIN) return 'short'
  if (length > REASON_MAX) return 'tooLong'
  return null
}

/** `POST …/Reveal`'s body. No actor: the server reads it off the session. */
export interface RevealBody {
  reason: string
}

/** The body sent for a reason: trimmed, or null when the reason has a problem. */
export function revealBody(reason: string): RevealBody | null {
  if (revealProblem(reason)) return null
  return { reason: reason.trim() }
}

/** What a reveal shows: the patient key (ADR 0140) and the member id. An empty member id: the server gave none. */
export interface RevealedPatient {
  patientKey: string
  memberId: string
}

/** Thrown before any request when the reason would not be sent (too short or too long). */
export class RevealNotSentError extends Error {
  constructor() {
    super('reveal not sent')
    this.name = 'RevealNotSentError'
  }
}

/**
 * Thrown when the door answers without a patient key. 4053 writes its log row first and answers the patient only once
 * that write held, so an answer with nobody in it is never shown as a reveal, nor said to be logged.
 */
export class RevealEmptyError extends Error {
  constructor() {
    super('reveal answered no patient')
    this.name = 'RevealEmptyError'
  }
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')

/**
 * The door's answer, read FIELD BY FIELD: the patient key and the member id, and nothing else a server might send (a
 * policy, a name). Null when it carries no patient key.
 */
export function readRevealedPatient(raw: unknown): RevealedPatient | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const answer = raw as Record<string, unknown>
  const patientKey = text(answer.patientKey)
  if (patientKey === '') return null
  return { patientKey, memberId: text(answer.memberId) }
}

/**
 * Why a reveal failed, for the dialog's words: `denied` a bare 403 (the grant filter refused before any handler ran, so
 * no sentence came back: the dialog names the grant), `empty` an answer with nobody in it, `refused` anything else (the
 * server's own sentence through `apiErrorMessage`, or the dialog's fallback). None of them shows anybody.
 */
export type RevealFailure = 'denied' | 'empty' | 'refused'

export function revealFailure(error: unknown): RevealFailure {
  if (error instanceof RevealEmptyError) return 'empty'
  if (isBareDenial(error)) return 'denied'
  return 'refused'
}
