// The insurance CATEGORY and COVERAGE rulesets (BackOffice spec 3126, doors 3145 + 3146 as BUILT; oms ticket 617).
// Two more documents beside the guard ruleset, saved WHOLE through the same draft doors, their conditions the guard
// language's (`GuardCondition`). In core because the simulator (612) and the live-doors ticket (618) read them too.
//
// From the brief ("HQ contract: coverage (3144, 3145, 3146)", which wins over older Changes lines):
// - category document `{ schema: 1, kind: "category", revision, lists?, rules: [{ id, name, folder?, state, window?,
//   audience?, when, then: [{ effect: "setCategory", group: G1|G2|G3 }] }] }` — exactly one effect, no `onUnknown`;
//   FIRST MATCH in document order wins, else the line keeps its ItemCustomer category (else the item master's);
// - coverage document, the same shape; ONE effect kind per rule, each optionally `overridesPayer: true`:
//   `covered | priorApproval | exceptionPrescriptions { value: bool }`, `priceCap | quantityCap | daysSupplyCap
//   { value: n }`, `deductible { percent?: 0-100, max?: n }` (the line's group), `segment { value: ELITE|SABIC|ARAMCO }`.
//   A rule sets LINE effects or INVOICE effects (segment, exceptionPrescriptions); an invoice rule reads no line block.
// - Per value the first holding rule that may set it wins (any rule where the payer said nothing, only an
//   `overridesPayer` rule where it did); every resolved value is `{ value, source, ruleId, version }`.
// - An approved category / coverage document publishes LIVE: no back-test, no promote, no per-rule shadow.

import type { GuardAudience, GuardCondition, GuardList, GuardRule, GuardState, Says } from './model'

/** The deductible groups SIS.Pricing reads, in order: Generic, Brand, NonMed. */
export const CATEGORY_GROUPS = ['G1', 'G2', 'G3'] as const
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]

export interface CategoryEffect {
  effect: 'setCategory'
  group: CategoryGroup
}

interface RuleBase {
  id: string
  name: Says
  /** A `/`-separated path ("Bupa contract"); absent for none. */
  folder?: string
  state: GuardState
  window?: GuardRule['window']
  audience?: GuardAudience | null
  when: GuardCondition[]
}

export interface CategoryRule extends RuleBase {
  /** Exactly one `setCategory`. */
  then: CategoryEffect[]
}

/** The per-invoice segments (3146), spelled as HQ spells them. */
export const COVERAGE_SEGMENTS = ['ELITE', 'SABIC', 'ARAMCO'] as const
export type CoverageSegment = (typeof COVERAGE_SEGMENTS)[number]

/** Effects on a LINE, then effects on the INVOICE (segment, exception prescriptions). */
export const LINE_EFFECTS = ['covered', 'priorApproval', 'deductible', 'priceCap', 'quantityCap', 'daysSupplyCap'] as const
export const INVOICE_EFFECTS = ['segment', 'exceptionPrescriptions'] as const
export const COVERAGE_EFFECTS = [...LINE_EFFECTS, ...INVOICE_EFFECTS] as const
export type CoverageEffectKind = (typeof COVERAGE_EFFECTS)[number]

/** Whether an effect sets a line's value or the invoice's. */
export const effectLevel = (kind: CoverageEffectKind): 'line' | 'invoice' => ((INVOICE_EFFECTS as readonly string[]).includes(kind) ? 'invoice' : 'line')

interface EffectBase {
  /** Present (true): the value replaces what the payer stated. Absent: it applies only where the payer said nothing. */
  overridesPayer?: true
}

export type CoverageEffect = EffectBase &
  (
    | { effect: 'covered' | 'priorApproval' | 'exceptionPrescriptions'; value: boolean }
    /** `priceCap` SAR per unit, `quantityCap` units, `daysSupplyCap` days. */
    | { effect: 'priceCap' | 'quantityCap' | 'daysSupplyCap'; value: number }
    /** `percent` 0–100 of the line's group, `max` SAR; either may be absent. */
    | { effect: 'deductible'; percent?: number; max?: number }
    | { effect: 'segment'; value: CoverageSegment }
  )

export interface CoverageRule extends RuleBase {
  /** One effect (one kind per rule). */
  then: CoverageEffect[]
}

export interface CategoryRuleset {
  schema: 1
  kind: 'category'
  revision: number
  lists?: GuardList[]
  rules: CategoryRule[]
}

export interface CoverageRuleset {
  schema: 1
  kind: 'coverage'
  revision: number
  lists?: GuardList[]
  rules: CoverageRule[]
}

export type InsuranceRuleKind = 'category' | 'coverage'
export type InsuranceRuleset = CategoryRuleset | CoverageRuleset
export type InsuranceRule = CategoryRule | CoverageRule

/** `GET InsuranceRules/Categories` row (3145): the guard row's shape with `group` (guard rows carry `group: null`). */
export interface CategoryRow {
  id: string
  name: Says
  folder?: string | null
  state: GuardState
  group: CategoryGroup | null
}

// ── Resolved values (Coverage/Resolve and Coverage/Simulate, 3146) ─────────────────────────────────

/** Where a resolved value came from: the payer's answer, a rule filling the payer's gap, a rule overriding the payer, nothing. */
export const RESOLVED_SOURCES = ['payer', 'rule', 'ruleOverridesPayer', 'none'] as const
export type ResolvedSource = (typeof RESOLVED_SOURCES)[number]

export interface ResolvedValue<T> {
  value: T | null
  source: ResolvedSource
  ruleId: string | null
  version: number | null
}

/** The mark a resolved value shows: the payer's own, a rule filling the gap, a rule overriding the payer, or none. */
export function resolvedMark(v: Pick<ResolvedValue<unknown>, 'source'> | null | undefined): 'payer' | 'fills' | 'overrides' | 'none' {
  switch (v?.source) {
    case 'payer':
      return 'payer'
    case 'rule':
      return 'fills'
    case 'ruleOverridesPayer':
      return 'overrides'
    default:
      return 'none'
  }
}

// ── Category Simulate (3145) ───────────────────────────────────────────────────────────────────

/** Who set a line's category: a category rule, the item's default (ItemCustomer, else the item master), or nothing. */
export type CategorySource = 'rule' | 'default' | 'none'

/** One line of `POST InsuranceRules/Categories/Simulate` → `{ version, lines }`. */
export interface CategoryLine {
  line: number
  item: string
  /** The category as stamped: Generic | Brand | NonMed from a rule, the default's own spelling (Brand-IR …) otherwise. */
  insuranceItemCategory: string | null
  group: CategoryGroup | null
  source: CategorySource
  ruleId: string | null
  version: number | null
  /** The item's own category before any rule (its spelling). */
  defaultCategory: string | null
  unknowns: unknown[]
}

export interface CategorySimulateResult {
  version: number | null
  lines: CategoryLine[]
}
