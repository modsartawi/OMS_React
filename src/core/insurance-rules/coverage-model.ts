// The insurance CATEGORY and COVERAGE rulesets (BackOffice spec 3126, doors 3145 + 3146; oms ticket 617). Two
// more documents beside the guard ruleset, saved WHOLE through the same draft doors
// (`rulesetDraftDoors('Categories' | 'Coverage')` in `./api`), their conditions the guard language's
// (`GuardCondition`: groups, NOT, registry facts, patient / policy lists). In core because the simulator (612)
// and the live-doors ticket (618) read them too.
//
// From the brief ("HQ contract: coverage"):
// - category effect `{ effect: "setCategory", group: "G1|G2|G3" }` — Generic / Brand / NonMed; FIRST MATCH in
//   rule order wins, over the item master's `ItemCustomer.InsuranceItemCategory` default;
// - coverage effects `covered`, `priorApproval`, `deductible { pct, max }`, `priceCap`, `qtyCap`, `segment`, each
//   with `overridesPayer: bool` — a value fills only what the payer did not send, unless it overrides the payer.
//
// ⚠️ PROVISIONAL (617), 618 reconciles: the brief spells `deductible { pct, max }` and the effect names only. The
// other effects' value fields (`covered`, `required`, `max`, `maxQuantity` / `maxDaysSupply`, `segment`), the
// documents' `schema` / `kind` and the rule's `then` array (one category effect, any number of coverage effects)
// are guessed after the guard ruleset's shape.

import type { GuardCondition, GuardState, Says } from './model'

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
  /** A `/`-separated path ("Bupa contract"); empty for none. */
  folder: string
  state: GuardState
  when: GuardCondition[]
}

export interface CategoryRule extends RuleBase {
  then: CategoryEffect[]
}

/** The per-invoice segments (3146: Elite / SABIC / ARAMCO). */
export const COVERAGE_SEGMENTS = ['Elite', 'SABIC', 'ARAMCO'] as const
export type CoverageSegment = (typeof COVERAGE_SEGMENTS)[number]

export const COVERAGE_EFFECTS = ['covered', 'priorApproval', 'deductible', 'priceCap', 'qtyCap', 'segment'] as const
export type CoverageEffectKind = (typeof COVERAGE_EFFECTS)[number]

interface EffectBase {
  /** False: the value fills only what the payer left out. True: it replaces what the payer sent (shown, recorded). */
  overridesPayer: boolean
}

export type CoverageEffect = EffectBase &
  (
    | { effect: 'covered'; covered: boolean }
    | { effect: 'priorApproval'; required: boolean }
    /** `pct` 0–100 of the line; `max` in SAR, null = no cap. */
    | { effect: 'deductible'; pct: number; max: number | null }
    /** The most the insurer pays per unit, SAR. */
    | { effect: 'priceCap'; max: number }
    | { effect: 'qtyCap'; maxQuantity: number | null; maxDaysSupply: number | null }
    | { effect: 'segment'; segment: CoverageSegment }
  )

export interface CoverageRule extends RuleBase {
  then: CoverageEffect[]
}

export interface CategoryRuleset {
  schema: 1
  kind: 'category'
  revision: number
  rules: CategoryRule[]
}

export interface CoverageRuleset {
  schema: 1
  kind: 'coverage'
  revision: number
  rules: CoverageRule[]
}

export type InsuranceRuleKind = 'category' | 'coverage'
export type InsuranceRuleset = CategoryRuleset | CoverageRuleset
export type InsuranceRule = CategoryRule | CoverageRule
