import type { CampaignRule, RuleExpr, RuleNamedValue } from '@/core/models/rule-campaign'
import type { RuleFormulaGuide, RuleFormulaRecipe, RuleFormulaType } from '@/core/rules/formula-guide'
import { parseExpr, printExpr, type ExprProblem } from '@/core/rules/expr'
import { keyOf } from './block-keys'

// The guided ƒx helper's promotion half (ticket 507; schema 1 in 522). A named value and the formula
// condition are written through it. The box holds TEXT; `@/core/rules/expr` reads it into the stored
// JSON expression and prints a stored one back (ticket 522 reverses 507's "the client never parses":
// it had no contract). The insertion at the cursor and the helper itself are core's
// (`@/core/rules/fx-helper`, oms 657); this rule's filters, values and recipe slots are here.

const FILTER_SLOT = '{filter}'
const CURRENT_SLOT = '{current}'

/** Whether a recipe names one of the rule's filters. */
export const recipeNeedsFilter = (recipe: RuleFormulaRecipe): boolean => recipe.formula.includes(FILTER_SLOT)

/** Whether a recipe wraps what the box already has (a cap); it needs something written first. */
export const recipeNeedsCurrent = (recipe: RuleFormulaRecipe): boolean => recipe.formula.includes(CURRENT_SLOT)

/** A recipe's formula with the picked filter's current name, and the box's formula as written, in it.
 *  The recipe writes its own `items('{filter}')` around the name. */
export const recipeFormula = (recipe: RuleFormulaRecipe, filterName: string, current = ''): string =>
  recipe.formula.split(FILTER_SLOT).join(filterName).split(CURRENT_SLOT).join(current.trim())

/** The named values a formula may read: those above the value being written; the formula condition reads them all. */
export function valuesBefore(rule: Pick<CampaignRule, 'values'>, valueKey: string | null): RuleNamedValue[] {
  if (valueKey === null) return rule.values
  const i = rule.values.findIndex((v) => keyOf(v) === valueKey)
  return i < 0 ? rule.values : rule.values.slice(0, i)
}

/** How a filter is written in a formula: `items('Name')`, its current name. */
export const filterRef = (name: string): string => `items('${name}')`

/** One entry of the Fields tab. `group` is `rule` for this rule's own filters and values. */
export interface FxField {
  key: string
  kind: 'filter' | 'value' | 'field'
  group: string
  /** What Insert puts in: a filter's `items('name')`, a value's current name, or the field's path. */
  insert: string
  type: RuleFormulaType
}

/** The Fields tab: this rule's filters, the values above the one being written, then HQ's fields. */
export function fxFields(guide: RuleFormulaGuide, rule: Pick<CampaignRule, 'filters' | 'values'>, valueKey: string | null): FxField[] {
  return [
    ...rule.filters.map((f): FxField => ({ key: `filter:${f.id}`, kind: 'filter', group: 'rule', insert: filterRef(f.name), type: 'items' })),
    ...valuesBefore(rule, valueKey).map((v, i): FxField => ({ key: `value:${keyOf(v) || i}`, kind: 'value', group: 'rule', insert: v.name, type: 'number' })),
    ...guide.fields.map((f): FxField => ({ key: `field:${f.path}`, kind: 'field', group: f.group, insert: f.path, type: f.type })),
  ]
}

/** The part of the formula a problem marks: the bad word, between what comes before and after it. */
export interface Underline {
  before: string
  bad: string
  after: string
}

/**
 * What the box holds for a stored expression: its text, or — for one the codec cannot print — its
 * JSON, edited as JSON. An empty one is empty text.
 */
export function boxOf(expr: RuleExpr | undefined, rule: Pick<CampaignRule, 'filters'>): { text: string; json: boolean } {
  if (expr === null || expr === undefined || expr === '') return { text: '', json: false }
  const text = printExpr(expr, { filters: rule.filters })
  return text === null ? { text: JSON.stringify(expr), json: true } : { text, json: false }
}

/** What the box's text reads as: the expression to store, or why it cannot be read yet. */
export type BoxReading = { ok: true; expr: RuleExpr } | { ok: false; problem: ExprProblem | null; underline: Underline | null }

/** Reads the box: text through the codec, or JSON for a box that shows JSON. Empty is no expression. */
export function readBox(text: string, json: boolean, rule: Pick<CampaignRule, 'filters'>): BoxReading {
  if (!text.trim()) return { ok: true, expr: null }
  if (json) {
    try {
      return { ok: true, expr: JSON.parse(text) as RuleExpr }
    } catch {
      return { ok: false, problem: null, underline: null }
    }
  }
  const read = parseExpr(text, { filters: rule.filters })
  if (read.ok) return read
  return { ok: false, problem: read.problem, underline: underlineOf(text, read.problem.at, read.problem.at + (read.problem.token?.length ?? 1)) }
}

function underlineOf(formula: string, start: number | null, end: number | null): Underline | null {
  if (start === null || !Number.isFinite(start)) return null
  const len = formula.length
  const s = Math.min(Math.max(Math.trunc(start), 0), len)
  let e = Math.min(Math.max(Math.trunc(end ?? s), s), len)
  if (e === s && s < len) e = s + 1
  const bad = formula.slice(s, e)
  return { before: formula.slice(0, s), bad: bad === '' ? ' ' : bad, after: formula.slice(e) }
}
