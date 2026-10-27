import { bracedFields } from '@/core/rules/sentence'
import type { GuardCheck, GuardCondition, GuardEffect, GuardRule, GuardRuleset, Says } from './model'

// The guard editor's pure edits (oms ticket 608; 609 templates, 611 approval, 612 simulator and 617's
// category / coverage editors build on them, so they live in core). A condition is found by its PATH: the
// indexes from the rule's `when` down through groups' `conditions` (`[0, 2]` = the third condition of the
// first group). Every edit copies on the path and gives back the SAME array when nothing changed, so the
// history (`./editor-history`) pushes no step for a refused or empty edit.
//
// Two rules of the language are kept here, not in the screen:
// - groups nest up to THREE levels (K13; the top-level group is level 1, as in G-007's outer All of) — a 4th
//   is refused, HQ refusing it again at publish;
// - a rule's codes default from its FIRST block (K11) and follow that block until the author edits them.

/** Indexes from `when` down through groups' `conditions`. */
export type ConditionPath = readonly number[]

/** How deep All of / Any of groups may nest (K13). */
export const MAX_GROUP_LEVELS = 3

/** The deepest group level in some conditions: 0 with no group, 1 for a group holding only leaves. */
export function groupDepth(conditions: readonly GuardCondition[]): number {
  let deepest = 0
  for (const c of conditions) if (c.check === 'group') deepest = Math.max(deepest, 1 + groupDepth(c.conditions))
  return deepest
}

/** The condition at a path, or undefined. */
export function conditionAt(conditions: readonly GuardCondition[], path: ConditionPath): GuardCondition | undefined {
  let list = conditions
  let c: GuardCondition | undefined
  for (let i = 0; i < path.length; i++) {
    c = list[path[i]]
    if (!c) return undefined
    if (i < path.length - 1) {
      if (c.check !== 'group') return undefined
      list = c.conditions
    }
  }
  return c
}

/** The group level of the list a path names: 0 for `when` itself, n inside a level-n group; null if no group. */
function levelOf(conditions: readonly GuardCondition[], parent: ConditionPath): number | null {
  if (parent.length === 0) return 0
  const g = conditionAt(conditions, parent)
  return g?.check === 'group' ? parent.length : null
}

/** How many group levels a condition brings with it: 0 for a leaf. */
const levelsOf = (c: GuardCondition): number => (c.check === 'group' ? 1 + groupDepth(c.conditions) : 0)

/**
 * Whether a group (an empty one, or `c`) may go into the list at `parent` (`[]` = the rule's `when`) without
 * reaching a 4th level.
 */
export function canAddGroup(conditions: readonly GuardCondition[], parent: ConditionPath, c?: GuardCondition): boolean {
  const level = levelOf(conditions, parent)
  return level !== null && level + (c ? Math.max(1, levelsOf(c)) : 1) <= MAX_GROUP_LEVELS
}

/** Copy-on-path: the list at `parent` replaced by `fn(list)`; the same conditions when `fn` changes nothing. */
function atList(
  conditions: GuardCondition[],
  parent: ConditionPath,
  fn: (list: GuardCondition[]) => GuardCondition[],
): GuardCondition[] {
  if (parent.length === 0) return fn(conditions)
  const [head, ...rest] = parent
  const g = conditions[head]
  if (!g || g.check !== 'group') return conditions
  const inner = atList(g.conditions, rest, fn)
  if (inner === g.conditions) return conditions
  const next = conditions.slice()
  next[head] = { ...g, conditions: inner }
  return next
}

/** A condition added at the end of the list at `parent`; refused (same conditions) past the 3rd level. */
export function addCondition(conditions: GuardCondition[], parent: ConditionPath, c: GuardCondition): GuardCondition[] {
  const level = levelOf(conditions, parent)
  if (level === null || level + levelsOf(c) > MAX_GROUP_LEVELS) return conditions
  return atList(conditions, parent, (list) => [...list, c])
}

/** The condition at `path` replaced by `fn(it)`; the same conditions when `fn` gives it back unchanged. */
export function updateCondition(
  conditions: GuardCondition[],
  path: ConditionPath,
  fn: (c: GuardCondition) => GuardCondition,
): GuardCondition[] {
  if (path.length === 0) return conditions
  const parent = path.slice(0, -1)
  const at = path[path.length - 1]
  return atList(conditions, parent, (list) => {
    const c = list[at]
    if (!c) return list
    const next = fn(c)
    if (next === c) return list
    // A group may not be grown past the 3rd level by an update either.
    if (next.check === 'group' && (levelOf(conditions, parent) ?? 0) + levelsOf(next) > MAX_GROUP_LEVELS) return list
    const copy = list.slice()
    copy[at] = next
    return copy
  })
}

export function removeCondition(conditions: GuardCondition[], path: ConditionPath): GuardCondition[] {
  if (path.length === 0) return conditions
  const at = path[path.length - 1]
  return atList(conditions, path.slice(0, -1), (list) => (at < list.length ? list.filter((_, i) => i !== at) : list))
}

/** NOT on any condition, groups included (K13); off is written as no `not` at all. */
export function toggleNot(conditions: GuardCondition[], path: ConditionPath): GuardCondition[] {
  return updateCondition(conditions, path, (c) => {
    if (c.not) {
      const { not: _drop, ...rest } = c
      void _drop
      return rest as GuardCondition
    }
    return { ...c, not: true }
  })
}

// ── The palette ────────────────────────────────────────────────────────────────────────────

/** The palette's groups, in order; each names the blocks it offers (ticket 608). */
export const PALETTE: readonly { group: string; checks: readonly GuardCheck[] }[] = [
  { group: 'history', checks: ['history', 'supply'] },
  { group: 'volume', checks: ['volume'] },
  { group: 'line', checks: ['line'] },
  { group: 'reference', checks: ['sfda', 'formulary'] },
  { group: 'patient', checks: ['patient', 'policy', 'fact'] },
  { group: 'formula', checks: ['formula'] },
  { group: 'structure', checks: ['group'] },
]

/** A new block from the palette, with the templates' defaults (3093). */
export function newCondition(check: GuardCheck): GuardCondition {
  switch (check) {
    case 'history':
      return { check, match: 'sameItem', windowDays: 30, measure: 'dispenses', atLeast: 1, includeThisLine: false }
    case 'supply':
      return { check, match: 'sameKind', eligibleDaysBeforeDue: 10, accumulate: { surplusDays: 10, overDays: 90 }, unknownSupply: { assumeDays: 30 } }
    case 'volume':
      return { check, by: 'pharmacist', match: 'sameItem', window: 'day', atLeast: 20, includeThisLine: true }
    case 'line':
      return { check, field: 'daysSupply', above: 90 }
    case 'sfda':
      return { check, status: 'notMarketed' }
    case 'formulary':
      return { check, indication: 'notListed' }
    case 'patient':
      return { check, inList: '' }
    case 'policy':
      return { check, inList: '' }
    case 'fact':
      return { check, path: DEFAULT_FACT_PATH, op: 'atLeast', value: 0 }
    case 'formula':
      return { check, formula: '' }
    case 'group':
      return { check, mode: 'all', conditions: [] }
  }
}

// ── Typed facts (3131) ─────────────────────────────────────────────────────────────────────

/**
 * The fact a new `fact` block starts on. The facts themselves (and the `line` block's numeric fields) are the
 * Fields registry's — `./registry-facts` (oms 617 switched 608's local `FACTS` / `LINE_FIELDS` to it).
 * ⚠️ PROVISIONAL `$`-path (`$<scope>.<key>`); 618 reconciles.
 */
export const DEFAULT_FACT_PATH = '$patient.age'

// ── Codes (K11) ────────────────────────────────────────────────────────────────────────────

export interface GuardCodes {
  conflict: string | null
  nphies: string | null
}

const NO_CODES: GuardCodes = { conflict: null, nphies: null }

/** The first leaf block, depth first. */
function firstLeaf(conditions: readonly GuardCondition[]): GuardCondition | undefined {
  for (const c of conditions) {
    if (c.check !== 'group') return c
    const inner = firstLeaf(c.conditions)
    if (inner) return inner
  }
  return undefined
}

/** The codes one block defaults (K11, the templates' table): conflict (NCPDP) and NPHIES adjudication. */
export function blockCodes(c: GuardCondition | undefined): GuardCodes {
  if (!c) return NO_CODES
  switch (c.check) {
    case 'supply':
      return { conflict: 'ER', nphies: 'CV-4-8' }
    case 'history':
      if (c.measure === 'quantity') return { conflict: 'HD', nphies: null }
      if (c.measure !== 'dispenses') return NO_CODES
      if (c.match === 'sameItem') return { conflict: '83', nphies: null }
      if (c.match === 'sameKind') return { conflict: 'ID', nphies: null }
      if (c.match === 'sameClass') return { conflict: 'TD', nphies: null }
      return NO_CODES
    case 'line':
      return c.field === 'daysSupply' && c.above !== undefined && c.inList === undefined ? { conflict: 'MX', nphies: 'CV-4-2' } : NO_CODES
    case 'sfda':
      if (c.status === 'notMarketed') return { conflict: null, nphies: 'CV-4-10' }
      if (c.priceAbove !== undefined) return { conflict: null, nphies: 'BE-1-6' }
      return NO_CODES
    case 'formulary':
      if (c.indication === 'notListed') return { conflict: null, nphies: 'CV-4-5' }
      if (c.edit === 'QL') return { conflict: null, nphies: 'SE-1-9' }
      if (c.edit === 'PA') return { conflict: null, nphies: 'BE-1-4' }
      if (c.edit === 'AGE') return { conflict: null, nphies: 'AD-3-7' }
      if (c.edit === 'G') return { conflict: null, nphies: 'AD-3-8' }
      return NO_CODES
    default:
      return NO_CODES
  }
}

/** The codes a rule's conditions default: its first block's (K11). */
export const defaultCodes = (conditions: readonly GuardCondition[]): GuardCodes => blockCodes(firstLeaf(conditions))

const codesOf = (e: GuardEffect): GuardCodes => ({ conflict: e.codes?.conflict || null, nphies: e.codes?.nphies || null })
export const sameCodes = (a: GuardCodes, b: GuardCodes): boolean => a.conflict === b.conflict && a.nphies === b.nphies

/** Whether an effect's codes are still the ones the rule's first block defaults (not the author's). */
export const codesAreDefault = (rule: Pick<GuardRule, 'when'>, e: GuardEffect): boolean => sameCodes(codesOf(e), defaultCodes(rule.when))

/**
 * One rule edited by `fn`, its codes following the first block: an effect whose codes were the old first
 * block's default (or none) takes the new one's; an effect whose codes the author edited keeps them.
 */
export function editRule(rule: GuardRule, fn: (r: GuardRule) => GuardRule): GuardRule {
  const next = fn(rule)
  if (next === rule || next.when === rule.when) return next
  const was = defaultCodes(rule.when)
  const now = defaultCodes(next.when)
  const then = next.then.map((e) => (sameCodes(codesOf(e), was) && !sameCodes(codesOf(e), now) ? { ...e, codes: { ...now } } : e))
  return then.some((e, i) => e !== next.then[i]) ? { ...next, then } : next
}

/** The ruleset with one rule edited by `fn` (codes following, see `editRule`); the same document if unchanged. */
export function editGuard(doc: GuardRuleset, ruleId: string, fn: (r: GuardRule) => GuardRule): GuardRuleset {
  const i = doc.rules.findIndex((r) => r.id === ruleId)
  if (i < 0) return doc
  const next = editRule(doc.rules[i], fn)
  if (next === doc.rules[i]) return doc
  const rules = doc.rules.slice()
  rules[i] = next
  return { ...doc, rules }
}

// ── Lists named by a rule ──────────────────────────────────────────────────────────────────

/**
 * The filter id a rule names a ruleset list by, adding the filter when the rule has none for it. A rule's
 * filter is `{ id, list }` (an alias the conditions name, bound to a list by id); a new one takes the list's
 * own id as its alias, as G-007's `glp1` does.
 */
export function withListFilter(rule: GuardRule, listId: string): { rule: GuardRule; alias: string } {
  const f = rule.filters.find((x) => x.list === listId)
  if (f) return { rule, alias: f.id }
  return { rule: { ...rule, filters: [...rule.filters, { id: listId, list: listId }] }, alias: listId }
}

/** The ruleset list a rule's filter alias names (the alias itself when no filter has it). */
export const listOfAlias = (rule: Pick<GuardRule, 'filters'>, alias: string): string => rule.filters.find((f) => f.id === alias)?.list ?? alias

// ── A new rule ─────────────────────────────────────────────────────────────────────────────

/**
 * The next free guard id: `G-` and one more than the highest number in the ruleset, three digits.
 * ⚠️ PROVISIONAL (608): the brief has no door that mints an id; HQ may refuse one and 618 reconciles.
 */
export function nextGuardId(rules: readonly Pick<GuardRule, 'id'>[]): string {
  let high = 0
  for (const r of rules) {
    const m = /^G-(\d+)$/.exec(r.id)
    if (m) high = Math.max(high, Number(m[1]))
  }
  return `G-${String(high + 1).padStart(3, '0')}`
}

/** A blank draft rule: every channel, every store, no conditions, one OVERRIDE effect with no message yet. */
export function newGuardRule(id: string, folder = ''): GuardRule {
  return {
    id,
    name: { en: '', ar: '' },
    folder,
    state: 'draft',
    window: { from: null, until: null },
    audience: { channels: ['nphies', 'waseel', 'oms', 'bupa'], stores: [] },
    filters: [],
    when: [],
    onUnknown: 'none',
    then: [{ effect: 'guard', severity: 'OVERRIDE', says: { en: '', ar: '' }, codes: { ...NO_CODES }, suggest: null }],
  }
}

// ── Message placeholders ───────────────────────────────────────────────────────────────────

/** The placeholders a message may use (3093 / 3130). `{lastStore}` is NEVER offered in phase 1 (privacy). */
export const GUARD_PLACEHOLDERS = [
  'eligibleOn',
  'consumedPct',
  'lastDispensedOn',
  'surplusDays',
  'count',
  'limit',
  'windowDays',
  'remaining',
  'otherItem',
  'daysSupply',
  'supplyEndsOn',
  'periodEnd',
  'daysToPeriodEnd',
] as const

/** Placeholders HQ refuses at publish in phase 1. */
export const REFUSED_PLACEHOLDERS: readonly string[] = ['lastStore']

/** The refused placeholders a message uses, in either language. */
export function refusedPlaceholders(says: Says): string[] {
  const used = new Set([...bracedFields(says)])
  return REFUSED_PLACEHOLDERS.filter((p) => used.has(p))
}

/** `{name}` typed into a text at the caret (`at`, a selection start), with the caret after it. */
export function insertPlaceholder(text: string, at: number | null, name: string): { text: string; caret: number } {
  const i = at === null || at < 0 || at > text.length ? text.length : at
  const token = `{${name}}`
  return { text: text.slice(0, i) + token + text.slice(i), caret: i + token.length }
}

/** The suggestions an effect may carry, with the placeholder each one usually takes (3093). */
export const SUGGESTIONS: readonly { key: string; value: string }[] = [
  { key: 'maxQuantity', value: '{remaining}' },
  { key: 'maxDaysSupply', value: '{daysToPeriodEnd}' },
]
