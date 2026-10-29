// What the guided ƒx helper offers a GUARD formula (oms 657): the `$`-paths a guard formula may read, the
// functions and operators that type-check there, and ready-made guard tests. Pure, no React. HQ sends none
// of it — like the promotion's guide (`@/core/rules/formula-guide`) it is the client's, written to the
// engine as SIS.Rules reads a guard formula (`{ check: "formula", expr }`, a TRUE/FALSE expression):
//
// - the paths MIRROR `SIS.Rules/Language/RulesetReader.Guards.cs` — its `FactPaths` dictionary (every typed
//   patient / request / line fact, with its type) plus `EligibilityPathType`, which takes the eligibility keys
//   of `GuardEligibility.cs` (`GuardEligibilityKeys`) that are a number, a text or a flag. A DATE key
//   (`coverage.periodEnd`, `response.birthDate` …) and the line's `icd` / `supplyEndsOn` are NOT formula paths:
//   the engine reads them with a block's tests only, so they are not offered here;
// - a guard formula has no item filters and no item list (`ExpressionContext.OfPaths`), so the promotion's
//   `items` / `sum` / `count` cannot be used in it and are left out; `abs` and `in` / `list` are added;
// - every recipe is text `@/core/rules/expr` reads, and a true/false test over these paths.
// The words around each entry are the `insurance-guards` bundle's (`fx.*`).
import type { RuleFormulaFunction, RuleFormulaType } from '@/core/rules/formula-guide'

/** The Fields tab's groups, in order. */
export const GUARD_FX_GROUPS = ['patient', 'request', 'line', 'eligibility'] as const
export type GuardFxGroup = (typeof GUARD_FX_GROUPS)[number]

/** A path a guard formula may read. `insert` is what a click puts in (a key placeholder selected), `words` its bundle key. */
export interface GuardFxField {
  path: string
  type: RuleFormulaType
  group: GuardFxGroup
  /** A parameterised key's placeholder (`<code>`), selected once inserted so typing replaces it. */
  placeholder?: string
  /** Its words: `fx.field.<words>` in `insurance-guards`. */
  words: string
}

/** The placeholder of a benefit or table-of-benefits code. */
export const CODE_PLACEHOLDER = '<code>'

const field = (path: string, type: RuleFormulaType, group: GuardFxGroup): GuardFxField => ({ path, type, group, words: path })
const keyed = (path: string, type: RuleFormulaType, words: string): GuardFxField => ({ path, type, group: 'eligibility', placeholder: CODE_PLACEHOLDER, words })

/** The benefit fields `GuardEligibilityKeys.BenefitFields` types: `benefit[<code>].<field>`. */
const BENEFIT_FIELDS: [string, RuleFormulaType][] = [
  ['name', 'text'],
  ['term', 'text'],
  ['unit', 'text'],
  ['benefit', 'number'],
  ['approvalLimit', 'number'],
  ['copayPct', 'number'],
  ['copayMax', 'number'],
]

export const GUARD_FX_FIELDS: readonly GuardFxField[] = [
  // FactPaths — patient
  field('patient.age', 'number', 'patient'),
  field('patient.gender', 'text', 'patient'),
  field('patient.idType', 'text', 'patient'),
  // FactPaths — request
  field('request.payer', 'text', 'request'),
  field('request.policy', 'text', 'request'),
  field('request.class', 'text', 'request'),
  field('request.channel', 'text', 'request'),
  field('request.store', 'text', 'request'),
  field('request.pharmacist', 'text', 'request'),
  // FactPaths — line (the engine types the price a number; SAR, so its badge is money)
  field('line.item', 'text', 'line'),
  field('line.eCode', 'text', 'line'),
  field('line.dCode', 'text', 'line'),
  field('line.daysSupply', 'number', 'line'),
  field('line.quantity', 'number', 'line'),
  field('line.price', 'money', 'line'),
  field('line.idfPriority', 'number', 'line'),
  // EligibilityPathType — GuardEligibilityKeys' fixed keys that are a text or a flag (no number among them; dates left out)
  field('eligibility.response.payer', 'text', 'eligibility'),
  field('eligibility.response.outcome', 'text', 'eligibility'),
  field('eligibility.response.inForce', 'bool', 'eligibility'),
  field('eligibility.response.eligible', 'bool', 'eligibility'),
  field('eligibility.response.siteEligibility', 'text', 'eligibility'),
  field('eligibility.response.transfer', 'bool', 'eligibility'),
  field('eligibility.response.newborn', 'bool', 'eligibility'),
  field('eligibility.response.gender', 'text', 'eligibility'),
  field('eligibility.response.idType', 'text', 'eligibility'),
  field('eligibility.coverage.subscriberId', 'text', 'eligibility'),
  field('eligibility.coverage.memberId', 'text', 'eligibility'),
  field('eligibility.coverage.inForce', 'bool', 'eligibility'),
  field('eligibility.coverage.network', 'text', 'eligibility'),
  field('eligibility.coverage.plan', 'text', 'eligibility'),
  field('eligibility.coverage.class', 'text', 'eligibility'),
  field('eligibility.coverage.group', 'text', 'eligibility'),
  field('eligibility.coverage.holder', 'text', 'eligibility'),
  // EligibilityPathType — the parameterised keys: a benefit's field, and a table-of-benefits entry (a number)
  ...BENEFIT_FIELDS.map(([f, type]) => keyed(`eligibility.benefit[${CODE_PLACEHOLDER}].${f}`, type, `eligibility.benefit.${f}`)),
  keyed(`eligibility.tob[${CODE_PLACEHOLDER}]`, 'number', 'eligibility.tob'),
]

/** What a click on a field puts in: its path, with a key's placeholder selected. */
export function guardFieldChip(f: GuardFxField): { text: string; caret?: number; select?: number } {
  if (!f.placeholder) return { text: f.path }
  const at = f.path.indexOf(f.placeholder)
  return { text: f.path, caret: at, select: f.placeholder.length }
}

/** The functions that type-check in a guard formula (`ExpressionReader.ReadCall` without items), with guard examples. */
export const GUARD_FX_FUNCTIONS: readonly RuleFormulaFunction[] = [
  { name: 'in', signature: 'in(x, list(a, b, ...))', example: "in(request.payer, list('0001100041', '0001100052'))", snippet: "in(, list(''))", caret: 3 },
  { name: 'if', signature: 'if(test, then, else)', example: 'line.quantity > if(patient.age < 12, 1, 3)', snippet: 'if(, , )', caret: 3 },
  { name: 'min', signature: 'min(a, b, ...)', example: 'line.quantity > min(line.daysSupply, 30)', snippet: 'min(, 100)', caret: 4 },
  { name: 'max', signature: 'max(a, b, ...)', example: 'line.daysSupply > max(line.quantity, 30)', snippet: 'max(, 5)', caret: 4 },
  { name: 'abs', signature: 'abs(x)', example: 'abs(line.daysSupply - 30) > 5', snippet: 'abs()', caret: 4 },
  { name: 'round', signature: 'round(x, decimals, mode)', example: 'round(line.price, 0, halfUp) > 500', snippet: 'round(, 0, halfUp)', caret: 6 },
  { name: 'floor', signature: 'floor(x)', example: 'floor(line.daysSupply / 30) >= 3', snippet: 'floor()', caret: 6 },
  { name: 'ceil', signature: 'ceil(x)', example: 'ceil(line.daysSupply / 30) > 1', snippet: 'ceil()', caret: 5 },
  { name: 'band', signature: 'band(x, from:rate, ...)', example: 'line.quantity > band(patient.age, 0:1, 12:2, 18:4)', snippet: 'band(, 0:1, 12:2)', caret: 5 },
]

/** The operator chips, in order: the promotion's. */
export const GUARD_FX_OPERATORS: readonly string[] = ['+', '-', '*', '/', '(', ')', '>=', '>', '<=', '<', '==', '!=', 'and', 'or', 'not']

/** A ready-made guard test: a true/false formula. */
export interface GuardFxRecipe {
  key: string
  formula: string
}

export const GUARD_FX_RECIPES: readonly GuardFxRecipe[] = [
  { key: 'childQuantity', formula: 'patient.age < 12 and line.quantity > 2' },
  { key: 'priceAbove', formula: 'line.price > 500' },
  { key: 'longSupply', formula: 'line.daysSupply > 30' },
  { key: 'ageBandPayer', formula: "patient.age >= 18 and patient.age < 65 and request.payer == '0001100041'" },
  { key: 'payerOneOf', formula: "in(request.payer, list('0001100041', '0001100052'))" },
  { key: 'notInForce', formula: 'not eligibility.coverage.inForce' },
  { key: 'notFirstChoice', formula: 'line.idfPriority > 1' },
  { key: 'womanOver50', formula: "patient.gender == 'F' and patient.age > 50" },
]
