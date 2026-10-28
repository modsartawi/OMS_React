// The guard check as an OMS order carries it (BackOffice spec 3126; doors 3127/3128/3134 for the check and
// its answers, 3142/3143 for the order). Shapes copied from the brief's "Guard check" and "OMS contract:
// guards on an order" sections. Used by oms ticket 616 only: the order list's guard state and the guard
// dialog on Delivery details. In core because the dialog is drawn by the OMS document feature and a
// feature may not import another (the `core/dispatch/ReleaseLockDialog` precedent).
//
// Reconciled with 3134 / 3143 as built in oms 618: the detail's `guards` carries its own `state` (the detail row has no
// `guardState`), `GET Guards/Reasons` is read by `reasonsIn`, Recheck / Release answer the order's guard row (`OrderGuardRow`).

import type { GuardSeverity } from './model'

/** A line's outcome: the most severe fired rule decides it, an HQ exception passes it. */
export const GUARD_LINE_OUTCOMES = ['pass', 'refuse', 'override', 'warn', 'exception'] as const
export type GuardLineOutcome = (typeof GUARD_LINE_OUTCOMES)[number]

/** The suggestion a rule offers, its placeholder filled (3130): `{ maxQuantity: number|null, maxDaysSupply: number|null }`. */
export interface GuardSuggestion {
  maxQuantity?: string | number | null
  maxDaysSupply?: string | number | null
}

/** One rule that fired on a line. `en` / `ar` are the rule's message, filled by the engine. */
export interface GuardFired {
  ruleId: string
  version: number
  severity: GuardSeverity
  en: string
  ar: string
  /** Either may be null (3127: a block with no NPHIES code). */
  codes: { conflict: string | null; nphies: string | null }
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

/** Order detail's `guards` (3143 as built): where the order stands and its last check, as `POST Guards/Check` answered it. */
export interface OrderGuards {
  /** The detail row carries no `guardState`: this is the order's. */
  state?: OrderGuardState
  checkId: string
  /** The hash of the lines checked: an answer for different lines is refused. */
  lineHash: string
  decisionId?: string | null
  checkedAt?: string | null
  /** Why the check could not run (`pending`), or why the order is `unchecked` (a passport holder). */
  failure?: string | null
  releasedBy?: string | null
  releaseReason?: string | null
  lines: GuardCheckLine[]
}

/** `POST Oms/Orders/{documentNo}/Guards/Recheck | Release` → the order's guard row (not its lines: read the order again). */
export interface OrderGuardRow {
  documentNo: string
  guardState: OrderGuardState
  checkId: string
  lineHash: string
  decisionId: string
  checkedAt: string
  failure: string
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
 * The reasons as the screens read them (`reasonsIn` over `GET Guards/Reasons?checkId=`, 3134 as built): `accepts` keyed
 * by rule id → the reason codes an OVERRIDE of it must name (a rule that requires none is absent); `caps` keyed by
 * reason code → how many more times it may be given on this check — HQ names the reasons already past their cap
 * (`capped`), so such a code reads 0 and any other is uncapped.
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
  /**
   * The rule's suggestion applied to the line (stories 6 / 35, "a suggestion with Apply"): a CHANGE answer — the line
   * goes on with the suggested quantity or days-supply. GUESS (review 3126 P2): the brief's answer spells no change;
   * this takes the fired rule's `suggestion` as sent.
   */
  change?: GuardSuggestion
}

export interface GuardAnswerBody {
  lineHash: string
  user: string
  answers: GuardAnswer[]
}

/** `GET Guards/Reasons` as built (3134). */
export interface GuardReasonsReply {
  intervention: GuardReasonCode[]
  outcome: GuardReasonCode[]
  reason: GuardReasonCode[]
  rules?: { ruleId: string; accepts: { intervention: string[]; outcome: string[]; reason: string[] }; reasonRequired: boolean; caps: { reason: string; count: number; days: number; neverOnList: string | null }[] }[]
  capped?: { line: number; ruleId: string; reason: string }[]
}

export function reasonsIn(r: GuardReasonsReply | null | undefined): GuardReasons {
  const accepts: Record<string, string[]> = {}
  for (const rule of r?.rules ?? []) if (rule.reasonRequired) accepts[rule.ruleId] = rule.accepts?.reason ?? []
  // A reason a rule caps at n uses may be given at most n times in one answer (HQ also counts the patient's history and
  // refuses past it, 409 GUARDS_REASON_CAPPED); one already past its cap on this check, not at all.
  const caps: Record<string, number> = {}
  for (const rule of r?.rules ?? []) for (const c of rule.caps ?? []) caps[c.reason] = Math.min(caps[c.reason] ?? Infinity, c.count)
  for (const c of r?.capped ?? []) caps[c.reason] = 0
  return { intervention: r?.intervention ?? [], outcome: r?.outcome ?? [], reason: r?.reason ?? [], accepts, caps }
}

export interface GuardAnswerResult {
  decisionId: string
}

/** `POST …/Guards/Release` — needs the release grant. */
export interface GuardReleaseBody {
  reason: string
}
