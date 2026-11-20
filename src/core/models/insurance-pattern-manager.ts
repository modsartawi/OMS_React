/**
 * The insurance manager's pattern doors (oms 924; BackOffice spec 4050, tickets 4055 and 4056): the thresholds the
 * nightly job finds and scores cases with, their change log, the reveal log, and the body that adds a confirmed case's
 * patient to the blocked-patient list. Beside `./insurance-patterns` (922's case models), in a file of its own so the
 * parallel slices of spec 4050 never edit one file.
 *
 * Reconciled with BackOffice 4055/4056 as built (routes `InsuranceRules/Patterns/...`). These are the CLIENT's models:
 * the wire's own spellings (`key`, `changedBy`, `revealedBy`, `{ page, pageSize, total, rows }`, the flat settings PUT,
 * the block's `expiresOn`) are read and written in `features/insurance/patterns/manager-wire.ts` and `settings.ts`.
 *
 * 🔒 **No patient field exists here, and none may be added.** The reveal log says who revealed WHICH CASE, when and why —
 * never whom (BackOffice 4055: "It never returns the revealed identity"). The block names no patient: the server reads
 * the patient off the confirmed case. `src/features/insurance/patterns/manager-no-identity.test.ts` holds this file to it.
 *
 * Dates are the server's LOCAL wall clock as ISO strings without a zone (`no-utc-time`).
 */

/** A threshold the nightly job reads (`InsurancePatternSetting`, BackOffice 4051), as `GET …/Settings` lists it. */
export interface PatternSetting {
  /** The server's key, e.g. `WindowDays`. */
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
 * `GET` and `PUT InsuranceRules/Patterns/Settings` — the thresholds and their change log. The server also sends each
 * threshold's `defaultValue`, `min`, `max` and `wholeNumber`; they are NOT kept: the page validates against its own ONE
 * ranges table (`features/insurance/patterns/settings.ts`, the same ranges), so an out-of-range value is refused before
 * the call.
 */
export interface PatternSettings {
  settings: PatternSetting[]
  changes: PatternSettingChange[]
}

/**
 * `PUT InsuranceRules/Patterns/Settings` — FLAT, the thresholds that changed only, each under its camelCased key (the
 * server binds them case-insensitively). No actor: the server reads it off the session.
 */
export interface PatternSettingsBody {
  windowDays?: number
  minStores?: number
  maxKmPerHour?: number
  minTravelKm?: number
  overlapShare?: number
  caseQuietDays?: number
  lookbackDays?: number
}

/** One row of the reveal log: who revealed which case's patient, when and why (written by 4053's reveal, read by 4055). */
export interface PatternReveal {
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

/** `GET InsuranceRules/Patterns/Reveals` — its filters and page, as sent. Empty values are dropped by `@/core/api`. */
export interface PatternRevealsQuery {
  /** `yyyy-MM-dd`, local, inclusive. */
  from?: string
  /** `yyyy-MM-dd`, local, inclusive. */
  to?: string
  /** A user name: the one who revealed. */
  user?: string
  /** One case's reveals: its case number. */
  case?: string
  /** 1-based. */
  page: number
  pageSize: number
}

/** The kind of finding a blocked-patient entry names (BackOffice 3965's `ReasonKind`). */
export type PatternBlockReasonKind = 'abuse' | 'fraud'

/**
 * `POST InsuranceRules/Patterns/Cases/{caseNumber}/Block` (BackOffice 4056). It goes through the blocked-patient list's
 * own change path with the reference "Case {caseNumber}", set by the server. No patient and no actor: the server reads
 * both.
 */
export interface PatternBlockBody {
  reasonKind: PatternBlockReasonKind
  /** The reporting payer: a note (3965), never a narrowing of the block. */
  payer?: string
  /** `yyyy-MM-dd`; absent = the day it is added (3965). */
  startsOn?: string
  /** `yyyy-MM-dd`; absent = no end. (The form calls it its end, `endsOn`.) */
  expiresOn?: string
}
