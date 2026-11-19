/**
 * The insurance manager's pattern doors on the wire (oms 924; BackOffice spec 4050, tickets 4055 and 4056): the
 * thresholds the nightly job finds and scores cases with, their change log, the reveal log, and the body that adds a
 * confirmed case's patient to the blocked-patient list. Beside `./insurance-patterns` (922's case models), in a file of
 * its own so the parallel slices of spec 4050 never edit one file.
 *
 * 🚩 GUESSED: BackOffice 4055 and 4056 are not built. These are the shapes the spec 4050 implementers agreed, camelCased
 * as SIS.Api serialises; reconcile every field when the doors land.
 *
 * 🔒 **No patient field exists here, and none may be added.** The reveal log says who revealed WHICH CASE, when and why —
 * never whom (BackOffice 4055: "It never returns the revealed identity"). The block names no patient: the server reads
 * the patient off the confirmed case. `src/features/insurance/patterns/manager-no-identity.test.ts` holds this file to it.
 *
 * Dates are the server's LOCAL wall clock as ISO strings without a zone (`no-utc-time`).
 */

/** A threshold the nightly job reads (`InsurancePatternSetting`, BackOffice 4051), as `GET …/Settings` lists it. */
export interface PatternSetting {
  /** The server's name, e.g. `WindowDays`. */
  name: string
  /** Null: the server sent no number for it. */
  value: number | null
}

/** One logged change of a threshold (BackOffice 4055): from what to what, who and when. */
export interface PatternSettingChange {
  name: string
  oldValue: number | null
  newValue: number | null
  by: string
  at: string
}

/**
 * `GET` and `PUT Insurance/Patterns/Settings` — the thresholds and their change log. The server also sends each
 * threshold's `min` and `max`; they are NOT kept: the page validates against its own ONE ranges table
 * (`features/insurance/patterns/settings.ts`), so an out-of-range value is refused before the call.
 */
export interface PatternSettings {
  settings: PatternSetting[]
  changes: PatternSettingChange[]
}

/** `PUT Insurance/Patterns/Settings` — the thresholds that changed. No actor: the server reads it off the session. */
export interface PatternSettingsBody {
  settings: { name: string; value: number }[]
}

/** One row of the reveal log: who revealed which case's patient, when and why (written by 4053's reveal, read by 4055). */
export interface PatternReveal {
  caseId: string
  caseNumber: string
  /** The user who revealed. */
  by: string
  at: string
  /** Their reason as typed (4056's block writes `block`). */
  reason: string
}

/** A page of the reveal log, newest first (the server's order). */
export interface PatternRevealsPage {
  items: PatternReveal[]
  totalMatches: number
}

/** `GET Insurance/Patterns/Reveals` — its filters and page, as sent. Empty values are dropped by `@/core/api`. */
export interface PatternRevealsQuery {
  /** `yyyy-MM-dd`, local, inclusive. */
  from?: string
  /** `yyyy-MM-dd`, local, inclusive. */
  to?: string
  /** A user name: the one who revealed. */
  user?: string
  caseId?: string
  skip: number
  take: number
}

/** The kind of finding a blocked-patient entry names (BackOffice 3965's `ReasonKind`). */
export type PatternBlockReasonKind = 'abuse' | 'fraud'

/**
 * `POST Insurance/Patterns/Cases/{caseId}/Block` (BackOffice 4056). It goes through the blocked-patient list's own change
 * path with the reference "Case {caseNumber}", set by the server. No patient and no actor: the server reads both.
 */
export interface PatternBlockBody {
  reasonKind: PatternBlockReasonKind
  /** The reporting payer: a note (3965), never a narrowing of the block. */
  payer?: string
  /** `yyyy-MM-dd`; absent = the day it is added (3965). */
  startsOn?: string
  /** `yyyy-MM-dd`; absent = no end. */
  endsOn?: string
}
