import type {
  CampaignRule,
  RuleFormulaCheck,
  RuleFormulaCheckRequest,
  RuleFormulaExpect,
  RuleFormulaGuide,
  RuleFormulaRecipe,
  RuleFormulaType,
  RuleNamedValue,
} from '@/core/models/rule-campaign'

// The guided ƒx helper's pure half (ticket 507). A named value and the formula condition are
// written through it: a field, a function, a recipe or an operator goes in where the cursor was,
// and HQ's check (BackOffice 2758) is read into what the box shows — the error under the bad word,
// or the result on the sample basket.
//
// The client NEVER parses the expression language (ADR 0089). Nothing here reads a formula's
// meaning: an insert only looks at the characters either side of the cursor, so two names never
// run together and an operator is not given a second space; the bad word is the span HQ answered.

/** Where the cursor is in the formula box: a caret (`start === end`) or a selection. */
export interface Selection {
  start: number
  end: number
}

/** What one click puts in, and where the cursor goes inside it (absent = after it). */
export interface Chip {
  text: string
  caret?: number
}

const WORD_END = /[A-Za-z0-9_)']$/
const WORD_START = /^[A-Za-z0-9_('"]/
const NAME_END = /[A-Za-z0-9_)]$/
const NAME_START = /^[A-Za-z0-9_(]/

/**
 * Puts `chip` at the cursor — over a selection, in place of it; with no cursor yet, at the end —
 * and answers the new formula and where the caret goes. A space goes between the chip and a name
 * either side of it; an operator's own spaces are dropped where a space is already there.
 */
export function insertAtCursor(formula: string, at: Selection | null, chip: Chip): { formula: string; caret: number } {
  const len = formula.length
  const start = Math.min(Math.max(at?.start ?? len, 0), len)
  const end = Math.min(Math.max(at?.end ?? start, start), len)
  const before = formula.slice(0, start)
  const after = formula.slice(end)
  let text = chip.text
  let caret = chip.caret ?? text.length
  let pastSpace = 0

  if (text.startsWith(' ') && (before === '' || /\s$/.test(before))) {
    text = text.slice(1)
    caret = Math.max(caret - 1, 0)
  }
  if (text.endsWith(' ') && /^\s/.test(after)) {
    const atEnd = caret === text.length
    text = text.slice(0, -1)
    caret = Math.min(caret, text.length)
    // The caret goes past the space that was already there, where the chip's own would have put it.
    if (atEnd) pastSpace = 1
  }
  const padBefore = WORD_END.test(before) && WORD_START.test(text) ? ' ' : ''
  const padAfter = NAME_END.test(text) && NAME_START.test(after) ? ' ' : ''
  return { formula: before + padBefore + text + padAfter + after, caret: start + padBefore.length + caret + pastSpace }
}

/** An operator chip: a bracket pair with the caret inside, a closing bracket as it is, else the operator between spaces. */
export function operatorChip(op: string): Chip {
  if (op === '(') return { text: '()', caret: 1 }
  if (op === ')') return { text: ')' }
  return { text: ` ${op} ` }
}

/** The text chip: a pair of single quotes with the caret between them. */
export const TEXT_CHIP: Chip = { text: "''", caret: 1 }

const FILTER_SLOT = '{filter}'
const CURRENT_SLOT = '{current}'

/** Whether a recipe names one of the rule's filters. */
export const recipeNeedsFilter = (recipe: RuleFormulaRecipe): boolean => recipe.formula.includes(FILTER_SLOT)

/** Whether a recipe wraps what the box already has (a cap); it needs something written first. */
export const recipeNeedsCurrent = (recipe: RuleFormulaRecipe): boolean => recipe.formula.includes(CURRENT_SLOT)

/** A recipe's formula with the picked filter's current name, and the box's formula as written, in it. */
export const recipeFormula = (recipe: RuleFormulaRecipe, filterName: string, current = ''): string =>
  recipe.formula.split(FILTER_SLOT).join(filterName).split(CURRENT_SLOT).join(current.trim())

/** The named values a formula may read: those above the value being written; the formula condition reads them all. */
export function valuesBefore(rule: Pick<CampaignRule, 'values'>, valueId: string | null): RuleNamedValue[] {
  if (valueId === null) return rule.values
  const i = rule.values.findIndex((v) => v.id === valueId)
  return i < 0 ? rule.values : rule.values.slice(0, i)
}

/** What the validator sends for a formula of `rule`, as it is on screen. */
export function checkRequest(
  campaignId: string,
  rule: Pick<CampaignRule, 'filters' | 'values'>,
  valueId: string | null,
  expect: RuleFormulaExpect,
  formula: string,
): RuleFormulaCheckRequest {
  return { campaignId, expect, formula, filters: rule.filters, values: valuesBefore(rule, valueId) }
}

/** One entry of the Fields tab. `group` is `rule` for this rule's own filters and values. */
export interface FxField {
  key: string
  kind: 'filter' | 'value' | 'field'
  group: string
  /** What Insert puts in: a filter's or value's current name, or the field's path. */
  insert: string
  type: RuleFormulaType
}

/** The Fields tab: this rule's filters, the values above the one being written, then HQ's fields. */
export function fxFields(guide: RuleFormulaGuide, rule: Pick<CampaignRule, 'filters' | 'values'>, valueId: string | null): FxField[] {
  return [
    ...rule.filters.map((f): FxField => ({ key: `filter:${f.id}`, kind: 'filter', group: 'rule', insert: f.name, type: 'items' })),
    ...valuesBefore(rule, valueId).map((v): FxField => ({ key: `value:${v.id}`, kind: 'value', group: 'rule', insert: v.name, type: 'number' })),
    ...guide.fields.map((f): FxField => ({ key: `field:${f.path}`, kind: 'field', group: f.group, insert: f.path, type: f.type })),
  ]
}

/** The part of the formula HQ marked: the bad word, between what comes before and after it. */
export interface Underline {
  before: string
  bad: string
  after: string
}

/** What the box shows for HQ's check. */
export type FormulaReading =
  | { state: 'ok'; type: RuleFormulaType | null; result: RuleFormulaCheck['result']; warnings: string[] }
  | { state: 'bad'; message: string; underline: Underline | null; more: string[] }

/**
 * HQ's check, read for the box. A bad formula shows its first error's message with that error's
 * span underlined — held to the formula; an empty span marks one character, or a space at the end
 * for what is missing there — and its other errors under it. A good one shows its type, its
 * result on the sample basket and HQ's warnings.
 */
export function readFormulaCheck(formula: string, check: RuleFormulaCheck): FormulaReading {
  if (check.ok) return { state: 'ok', type: check.type, result: check.result, warnings: check.warnings.map((w) => w.message) }
  const [first, ...rest] = check.errors
  return { state: 'bad', message: first?.message ?? '', underline: first ? underlineOf(formula, first.start, first.end) : null, more: rest.map((e) => e.message) }
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
