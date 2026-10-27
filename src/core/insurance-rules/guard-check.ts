// The guard check as an OMS order carries it (BackOffice spec 3126; doors 3127/3128/3134 for the check and
// its answers, 3142/3143 for the order). Shapes copied from the brief's "Guard check" and "OMS contract:
// guards on an order" sections. Used by oms ticket 616 only: the order list's guard state and the guard
// dialog on Delivery details. In core because the dialog is drawn by the OMS document feature and a
// feature may not import another (the `core/dispatch/ReleaseLockDialog` precedent).
//
// ⚠️ Stubbed until oms 618. Fields marked GUESS are not spelled by the brief; 618 reconciles them.

import type { GuardSeverity } from './model'

/** A line's outcome: the most severe fired rule decides it, an HQ exception passes it. */
export const GUARD_LINE_OUTCOMES = ['pass', 'refuse', 'override', 'warn', 'exception'] as const
export type GuardLineOutcome = (typeof GUARD_LINE_OUTCOMES)[number]

/**
 * The suggestion a template offers (3093 `suggest`): at most so many units, or so many days' supply.
 * GUESS: the check's `suggestion` takes the template's `suggest` shape with its placeholder filled.
 */
export interface GuardSuggestion {
  maxQuantity?: string | number
  maxDaysSupply?: string | number
}

/** One rule that fired on a line. `en` / `ar` are the rule's message, filled by the engine. */
export interface GuardFired {
  ruleId: string
  version: number
  severity: GuardSeverity
  en: string
  ar: string
  codes: { conflict: string; nphies: string }
  suggestion?: GuardSuggestion | null
  /** Set when an HQ exception passed this rule for this patient. */
  exceptionId?: string | null
}

export interface GuardCheckLine {
  /** The order line's number (`SdDocumentLineModel.lineNumber`). */
  line: number
  outcome: GuardLineOutcome
  fired: GuardFired[]
  /** Facts the engine did not know (unknown days-supply, …). */
  unknowns: string[]
}

/** Order detail's `guards` (3142): the last check of the order, as `POST Guards/Check` answered it. */
export interface OrderGuards {
  checkId: string
  /** The hash of the lines checked: an answer for different lines is refused. */
  lineHash: string
  lines: GuardCheckLine[]
}

/** The order list and find-by-id rows' `guardState` (3142). */
export const ORDER_GUARD_STATES = ['none', 'actionNeeded', 'pending', 'unchecked'] as const
export type OrderGuardState = (typeof ORDER_GUARD_STATES)[number]

/** An NCPDP code of `GET Guards/Reasons`. An inactive code is never offered. */
export interface GuardReasonCode {
  code: string
  en: string
  ar: string
  active: boolean
}

/**
 * `GET Guards/Reasons`. The brief: "plus per-template `accepts` and `caps`".
 * GUESS: `accepts` is keyed by RULE id (a fired rule names no template) → the reason codes the rule takes;
 * a rule absent from it asks no reason. `caps` is keyed by reason code → how many more times this user may
 * give it; a code absent from it is uncapped.
 */
export interface GuardReasons {
  intervention: GuardReasonCode[]
  outcome: GuardReasonCode[]
  reason: GuardReasonCode[]
  accepts?: Record<string, string[]>
  caps?: Record<string, number>
}

/** One answer of `POST Guards/{checkId}/Answer`. */
export interface GuardAnswer {
  line: number
  ruleId: string
  ack?: true
  intervention?: string
  outcome?: string
  reason?: string
  note?: string
}

export interface GuardAnswerBody {
  lineHash: string
  user: string
  answers: GuardAnswer[]
}

export interface GuardAnswerResult {
  decisionId: string
}

/** `POST …/Guards/Release` — needs the release grant. */
export interface GuardReleaseBody {
  reason: string
}
