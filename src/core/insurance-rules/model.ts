// The insurance guard rules as HQ stores them (BackOffice spec 3126, oms ticket 607). Shapes are copied
// from the brief's contract — `BackOffice/.issues/assets/3126-oms-react-insurance-rules-brief.md` ("Guard
// ruleset", "HQ contract: authoring (3139)") — and the rule shape and blocks from
// `assets/3093-guard-templates.md`. A guessed field must not appear here: when a BackOffice door ticket
// changes a spelling it records it under the brief's "Changes", and oms ticket 618 reconciles it here.
//
// Every date on the wire is LOCAL wall-clock (`yyyy-MM-dd`, or `yyyy-MM-ddTHH:mm:ss`), never with a `Z`.
// Lists and fields are referenced by id or key, never by name, so a rename never breaks a rule.
//
// Shared by every insurance-rules feature (607 list + rule page, 608 editor, 609 templates, 610 lists,
// 611 approval, 612 simulator) — it lives in core because a feature may not import another.

import type { Says } from '@/core/models/rule-campaign'

export type { Says }

// ── States, severities, flags ────────────────────────────────────────────────────────────────

/** A guard rule's life: an author's draft → waiting for approval → shadow (fires, stops nothing) → live. */
export const GUARD_STATES = ['draft', 'waiting', 'shadow', 'live', 'disabled'] as const
export type GuardState = (typeof GUARD_STATES)[number]

/** The severities, HEAVIEST FIRST: the most severe decides the line (brief, "Rules the screens must keep"). */
export const GUARD_SEVERITIES = ['REFUSE', 'OVERRIDE', 'WARN'] as const
export type GuardSeverity = (typeof GUARD_SEVERITIES)[number]

/** Weight of a severity: 0 is the heaviest. Sort ascending to read REFUSE > OVERRIDE > WARN. */
export const severityRank = (s: GuardSeverity): number => GUARD_SEVERITIES.indexOf(s)

/** The heaviest of some severities, or null when there are none. */
export function mostSevere(severities: readonly GuardSeverity[]): GuardSeverity | null {
  let best: GuardSeverity | null = null
  for (const s of severities) if (best === null || severityRank(s) < severityRank(best)) best = s
  return best
}

/** What the metrics flagged on a rule (`GET InsuranceRules/Guards`, `GET InsuranceRules/Flags`). */
export const GUARD_FLAG_KINDS = ['noisy', 'silent', 'jump'] as const
export type GuardFlagKind = (typeof GUARD_FLAG_KINDS)[number]

export interface GuardFlag {
  kind: GuardFlagKind
  /** Local day or moment the flag was raised. */
  since: string
}

// ── The list row (`GET InsuranceRules/Guards`, 3139) ────────────────────────────────────────

/**
 * One rule as the Guards list reads it: "id, name EN/AR, folder, state, severity, last fired, and flags".
 * ⚠️ PROVISIONAL spelling of `lastFired` — the brief names the datum, not the field; 3139 owns it.
 */
export interface GuardRuleRow {
  id: string
  name: Says
  /** A `/`-separated path ("Chronic/Diabetes"); empty for a rule in no folder. */
  folder: string
  state: GuardState
  severity: GuardSeverity
  /** Local moment of the last fire, or null when the rule never fired. */
  lastFired: string | null
  flags: GuardFlag[]
}

// ── The guard ruleset document (`GET / PUT InsuranceRules/Guards/Draft`, 3139) ──────────────

/**
 * An attribute filter of an item list: a registry field (`ECode`, …) by key, and ANY OF or NONE OF these codes
 * (610; the brief spells `anyOf`, the spec "anyOf | noneOf" — exactly one of the two is present).
 */
export type GuardListAttribute = { field: string; anyOf: string[]; noneOf?: never } | { field: string; noneOf: string[]; anyOf?: never }

export interface GuardListFilter {
  articles: string[]
  categories: string[]
  attributes: GuardListAttribute[]
}

/** An item list of the ruleset, referenced from a rule's filters by `id`. */
export interface GuardList {
  id: string
  name: Says
  filters: GuardListFilter[]
  /** Other ruleset lists (by id) added to / taken from what the filters match — three lists deep, no cycle (610). */
  include: string[]
  exclude: string[]
}

/** A rule's filter: a local id (`items`, `glp1`) the conditions name, bound to a ruleset list by id. */
export interface GuardRuleFilter {
  id: string
  list: string
}

/** `sameItem` · `sameKind` (E-code) · `sameClass` · `list:<filter id>`. */
export type GuardMatch = 'sameItem' | 'sameKind' | 'sameClass' | `list:${string}`

interface ConditionBase {
  /** NOT on any condition (K13). */
  not?: boolean
}

/** The patient's past dispenses within a window. */
export interface HistoryCondition extends ConditionBase {
  check: 'history'
  match: GuardMatch
  windowDays: number
  measure: 'dispenses' | 'quantity' | 'distinctStores'
  atLeast: number
  includeThisLine: boolean
  excludeSameKind?: boolean
  /**
   * Count only past dispenses with the same payer / policy / channel / store as this request (story 8); absent =
   * estate-wide, the default. PROVISIONAL spelling (review 3126 P4): the spec names the narrowing, not the field.
   */
  narrowTo?: HistoryNarrow[]
}

/** What a history guard may narrow to (story 8). */
export const HISTORY_NARROWS = ['payer', 'policy', 'channel', 'store'] as const
export type HistoryNarrow = (typeof HISTORY_NARROWS)[number]

/** Refill too soon: days before the last supply is due, or a share of it consumed. */
export interface SupplyCondition extends ConditionBase {
  check: 'supply'
  match: GuardMatch
  eligibleDaysBeforeDue?: number
  eligibleDaysBeforeDueFor?: { list: string; value: number }[]
  /** The percentage form, 0–1, for a payer that states one. */
  consumedBelow?: number
  accumulate?: { surplusDays: number; overDays: number }
  unknownSupply?: { assumeDays: number }
}

/** A fact of the request line itself: a field above / below / after a value, or the item in a list. */
export interface LineCondition extends ConditionBase {
  check: 'line'
  field?: string
  above?: number
  below?: number
  /** A local day, or a `$`-path (`$eligibility.coverage.periodEnd`). */
  after?: string
  /** A filter id of the rule. */
  inList?: string
}

/** Requests counted per pharmacist or store (WARN / shadow only, K7). */
export interface VolumeCondition extends ConditionBase {
  check: 'volume'
  by: 'pharmacist' | 'store'
  match: GuardMatch
  window: 'day' | 'week' | 'month'
  atLeast: number
  includeThisLine: boolean
}

/** The live SFDA edition, joined per item by `SfdaCode`. */
export interface SfdaCondition extends ConditionBase {
  check: 'sfda'
  status?: 'notMarketed'
  /** Tolerance in SAR above the SFDA public price. */
  priceAbove?: number
  packMismatch?: boolean
}

/** The live CHI formulary edition. */
export interface FormularyCondition extends ConditionBase {
  check: 'formulary'
  indication?: 'listed' | 'notListed'
  edit?: 'QL' | 'PA' | 'AGE' | 'G'
}

/** The patient is on a patient list (by id). */
export interface PatientCondition extends ConditionBase {
  check: 'patient'
  inList: string
}

/** The policy is on a policy list (by id). */
export interface PolicyCondition extends ConditionBase {
  check: 'policy'
  inList: string
}

/**
 * A typed fact of the patient or the request (3131, 3102 F6), named by its `$`-path (`$patient.age`,
 * `$request.payer`, `$line.icd`): a number compared with a unit, or codes matched any of / none of (an ICD-10-AM
 * code may end in `*` for a prefix match). ⚠️ PROVISIONAL spelling (oms 608): the brief names the facts and the
 * palette ("patient / request conditions"), not the block; 3131 owns it, 618 reconciles.
 */
export interface FactCondition extends ConditionBase {
  check: 'fact'
  path: string
  op: 'atLeast' | 'below' | 'anyOf' | 'noneOf'
  /** A number for `atLeast` / `below`; codes for `anyOf` / `noneOf`. */
  value: number | string[]
}

/**
 * An operator-first decimal expression over `$`-paths, the 2737 language (`@/core/rules/expr`), true when it
 * holds. ⚠️ PROVISIONAL spelling (oms 608): `formula` holds the expression text; 3131 owns it.
 */
export interface FormulaCondition extends ConditionBase {
  check: 'formula'
  formula: string
}

/** All of / any of, nested up to three levels (K13). */
export interface GroupCondition extends ConditionBase {
  check: 'group'
  mode: 'all' | 'any'
  conditions: GuardCondition[]
}

export type GuardCondition =
  | HistoryCondition
  | SupplyCondition
  | LineCondition
  | VolumeCondition
  | SfdaCondition
  | FormularyCondition
  | PatientCondition
  | PolicyCondition
  | FactCondition
  | FormulaCondition
  | GroupCondition

export type GuardCheck = GuardCondition['check']

/** The reference blocks (SFDA, CHI formulary) — they start in shadow (K17). */
export const REFERENCE_CHECKS: readonly GuardCheck[] = ['sfda', 'formulary']

/** What the guard says and does when it fires. */
export interface GuardEffect {
  effect: 'guard'
  severity: GuardSeverity
  /** EN + AR message with `{placeholder}`s. `{lastStore}` is never offered in phase 1. */
  says: Says
  /** Default from the first firing block (K11); the author may override. */
  codes?: { conflict?: string | null; nphies?: string | null } | null
  /** A suggestion to the pharmacist: `{ maxQuantity: "{remaining}" }`, `{ maxDaysSupply: "{daysToPeriodEnd}" }`. */
  suggest?: Record<string, string | number> | null
}

/** The channels a guard is checked on. */
export const GUARD_CHANNELS = ['nphies', 'waseel', 'oms', 'bupa'] as const
export type GuardChannel = (typeof GUARD_CHANNELS)[number]

/**
 * Who a rule checks: channels, stores (none = every store), and patient / policy lists left out of it (story 16,
 * "exclude a VIP patient list"). PROVISIONAL spelling of the two exclude fields (review 3126 P4); 3131 owns it.
 */
export interface GuardAudience {
  channels: GuardChannel[]
  stores: string[]
  excludePatientLists?: string[]
  excludePolicyLists?: string[]
}

export interface GuardRule {
  id: string
  name: Says
  folder: string
  state: GuardState
  /** Local day the rule went into shadow; absent unless shadow. */
  shadowSince?: string | null
  /** `until` null = open-ended. */
  window?: { from?: string | null; until?: string | null } | null
  audience?: GuardAudience | null
  filters: GuardRuleFilter[]
  when: GuardCondition[]
  /** none = an unknown fact never fires the rule; warn = it warns (K10). */
  onUnknown: 'none' | 'warn'
  then: GuardEffect[]
}

/** The guard ruleset — its own document with its own version line (K1). */
export interface GuardRuleset {
  schema: 1
  kind: 'guard'
  /** A PUT with a stale revision is answered 409. */
  revision: number
  lists: GuardList[]
  rules: GuardRule[]
}

/** The severity a rule decides with: the heaviest of its effects. */
export const ruleSeverity = (rule: Pick<GuardRule, 'then'>): GuardSeverity | null => mostSevere(rule.then.map((e) => e.severity))

/** The insurance-rules area's URL prefix and its leaves (the route layout is `app/insurance-rules-routes`). */
export const INSURANCE_RULES_PATH = '/insurance-rules'
export const guardsPath = (folder?: string | null): string =>
  `${INSURANCE_RULES_PATH}/guards${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`
export const guardRulePath = (id: string): string => `${INSURANCE_RULES_PATH}/guards/${encodeURIComponent(id)}`
/** 608 — the guard editor: one rule of the draft, and a new rule (`guards/new`). */
export const guardEditPath = (id: string): string => `${guardRulePath(id)}/edit`
export const GUARD_NEW_PATH = `${INSURANCE_RULES_PATH}/guards/new`
