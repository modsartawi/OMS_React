// The insurance rule documents as SIS.Rules READS them, and the editor's model of them (oms 618: the reconcile of 608's
// guesses with BackOffice 3129-3172 / SIS.Rules 1.0.26 as built). Pure: no React, no http.
//
// The screens keep the model 608 drew (`./model`): a rule binds item lists to local filter ids (`filters`), a typed fact
// is ONE `fact` block named by its `$`-path, a formula is text, and a line field is compared `above` / `below`. The
// engine spells the same rules differently, and refuses a field it does not know (`RulesetReader.Guards`):
// - a rule has NO `filters`: `history` / `volume` / `supply` name a list as `match: "list:<list id>"` and a `line`
//   block as `inList: "<list id>"` — the ruleset's own list ids;
// - a fact is a block of its scope: `{ check: patient|request|eligibility|line, field, anyOf | above | atLeast | under |
//   atMost | before | … }` (`noneOf` is `anyOf` under `not`);
// - a formula is `{ check: "formula", expr: [operator-first JSON] }`;
// - the upper bound is `under` (strictly below), not `below`.
// This codec turns one into the other at the doors (`api.ts`, the templates' doors), so a component never sees the wire.
// On the way in each list a rule names becomes a filter whose id IS the list id; on the way out every filter alias is
// resolved to its list. Anything the editor cannot draw faithfully (a patient block with two bounds, an eligibility date
// test) is passed through as the engine wrote it, never rewritten.
import { parseExpr, printExpr } from '@/core/rules/expr'
import type { RuleExpr } from '@/core/models/rule-campaign'
import type { GuardList, GuardListFilter, GuardRule, GuardRuleFilter, GuardRuleset } from './model'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** The fact scopes the engine reads as a block of their own (`$<scope>.<field>` in the editor). */
const FACT_SCOPES = ['patient', 'request', 'eligibility', 'line'] as const
/** The bounds an engine fact block takes; the editor draws one of `atLeast` / `under` (its `below`) / `anyOf`. */
const FACT_TESTS = ['anyOf', 'above', 'atLeast', 'under', 'atMost', 'is', 'before', 'onOrBefore', 'after', 'onOrAfter', 'unit'] as const

const LIST_MATCH = /^list:(.+)$/

// ── conditions ───────────────────────────────────────────────────────────────────────────────────

/** One engine block → the editor's (a fact block, `below`, formula text), keeping everything it cannot draw. */
function conditionIn(raw: unknown): unknown {
  if (!isObj(raw)) return raw
  const c: Obj = { ...raw }
  if (c.check === 'group') return { ...c, conditions: arr(c.conditions).map(conditionIn) }
  if (c.check === 'formula') {
    const { expr, ...rest } = c
    const text = expr === undefined ? '' : (printExpr(expr as RuleExpr, { filters: [] }) ?? JSON.stringify(expr))
    return { ...rest, formula: text }
  }
  if (c.check === 'line' && typeof c.field === 'string' && c.under !== undefined && c.below === undefined) {
    const { under, ...rest } = c
    return { ...rest, below: under }
  }
  const scope = c.check as string
  const factScope = scope === 'patient' || scope === 'eligibility' ? scope : null
  if (factScope && typeof c.field === 'string' && c.inList === undefined) {
    const tests = FACT_TESTS.filter((k) => c[k] !== undefined)
    const one = tests.length === 1 ? tests[0] : null
    const op = one === 'atLeast' ? 'atLeast' : one === 'under' ? 'below' : one === 'anyOf' ? 'anyOf' : null
    if (op) {
      const fact: Obj = { check: 'fact', path: `$${factScope}.${c.field}`, op, value: c[one!] }
      if (c.not === true) fact.not = true
      return fact
    }
  }
  return c
}

/** One editor block → the engine's. */
function conditionOut(raw: unknown, alias: ReadonlyMap<string, string>): unknown {
  if (!isObj(raw)) return raw
  const c: Obj = { ...raw }
  if (c.check === 'group') return { ...c, conditions: arr(c.conditions).map((x) => conditionOut(x, alias)) }
  if (typeof c.match === 'string') {
    const m = LIST_MATCH.exec(c.match)
    if (m) c.match = `list:${alias.get(m[1]) ?? m[1]}`
  }
  if (c.check === 'line' && typeof c.inList === 'string') c.inList = alias.get(c.inList) ?? c.inList
  if (c.check === 'line' && c.below !== undefined) {
    c.under = c.below
    delete c.below
  }
  if (c.check === 'formula') {
    const text = typeof c.formula === 'string' ? c.formula : ''
    delete c.formula
    const read = parseExpr(text, { filters: [] })
    c.expr = read.ok ? read.expr : jsonOr(text)
    return c
  }
  if (c.check === 'fact' && typeof c.path === 'string') {
    const m = /^\$([A-Za-z]+)\.(.+)$/.exec(c.path)
    const scope = m?.[1]
    if (m && (FACT_SCOPES as readonly string[]).includes(scope!)) {
      const out: Obj = { check: scope, field: m[2] }
      let not = c.not === true
      if (c.op === 'atLeast') out.atLeast = c.value
      else if (c.op === 'below') out.under = c.value
      else if (c.op === 'anyOf') out.anyOf = c.value
      else if (c.op === 'noneOf') {
        out.anyOf = c.value
        not = !not
      }
      if (not) out.not = true
      return out
    }
  }
  return c
}

/** A formula the text codec cannot read is sent as the JSON it may be, else as typed: HQ's Validate names the block. */
function jsonOr(text: string): unknown {
  try {
    const v: unknown = JSON.parse(text)
    return Array.isArray(v) ? v : text
  } catch {
    return text
  }
}

/** The list ids a rule's blocks name (`match: list:<id>`, a line's `inList`), in order. */
function listsNamed(conditions: readonly unknown[], out: string[] = []): string[] {
  for (const c of conditions) {
    if (!isObj(c)) continue
    if (c.check === 'group') listsNamed(arr(c.conditions), out)
    const m = typeof c.match === 'string' ? LIST_MATCH.exec(c.match) : null
    if (m && !out.includes(m[1])) out.push(m[1])
    if (c.check === 'line' && typeof c.inList === 'string' && c.inList && !out.includes(c.inList)) out.push(c.inList)
  }
  return out
}

// ── rules ────────────────────────────────────────────────────────────────────────────────────────

/**
 * A rule's audience as built holds only the keys it sets (`{ excludeClassLists: […] }`): no `channels` = EVERY channel,
 * no `stores` = every store. The editor reads both as arrays (empty = every one); the wire leaves an empty one out.
 */
function audienceIn(raw: unknown): GuardRule['audience'] {
  if (!isObj(raw)) return null
  return { ...raw, channels: arr(raw.channels), stores: arr(raw.stores) } as GuardRule['audience']
}
function audienceOut(a: unknown): unknown {
  if (!isObj(a)) return a
  const out: Obj = { ...a }
  for (const k of ['channels', 'stores', 'excludePatientLists', 'excludePolicyLists', 'excludeClassLists'])
    if (Array.isArray(out[k]) && (out[k] as unknown[]).length === 0) delete out[k]
  return out
}

/** An engine rule (or a template's rule body) → the editor's: defaults filled, its lists bound as filters. */
export function guardRuleIn(raw: unknown): GuardRule {
  const r: Obj = isObj(raw) ? { ...raw } : {}
  if ('audience' in r) r.audience = audienceIn(r.audience)
  const when = arr(r.when).map(conditionIn)
  const filters: GuardRuleFilter[] = listsNamed(arr(r.when)).map((id) => ({ id, list: id }))
  return {
    ...r,
    id: typeof r.id === 'string' ? r.id : '',
    name: isObj(r.name) ? { en: String(r.name.en ?? ''), ar: String(r.name.ar ?? '') } : { en: '', ar: '' },
    folder: typeof r.folder === 'string' ? r.folder : '',
    state: (r.state ?? 'draft') as GuardRule['state'],
    filters,
    when: when as GuardRule['when'],
    onUnknown: r.onUnknown === 'warn' ? 'warn' : 'none',
    then: arr(r.then) as GuardRule['then'],
  } as GuardRule
}

/** The editor's rule → the engine's: no `filters`, every alias resolved to its list. */
export function guardRuleOut(rule: GuardRule): Obj {
  const { filters, ...rest } = rule as GuardRule & Obj
  const alias = new Map((filters ?? []).map((f: GuardRuleFilter) => [f.id, f.list || f.id]))
  const out: Obj = { ...rest, when: arr(rule.when).map((c) => conditionOut(c, alias)) }
  if (isObj(out.audience)) out.audience = audienceOut(out.audience)
  return out
}

/** A category / coverage rule: the guard rule's blocks, no filters, no `onUnknown`. */
function otherRuleIn(raw: unknown): unknown {
  if (!isObj(raw)) return raw
  const out: Obj = { ...raw, when: arr(raw.when).map(conditionIn), then: arr(raw.then) }
  if ('audience' in raw) out.audience = audienceIn(raw.audience)
  return out
}
function otherRuleOut(raw: unknown): unknown {
  if (!isObj(raw)) return raw
  const out: Obj = { ...raw, when: arr(raw.when).map((c) => conditionOut(c, new Map())) }
  if (isObj(out.audience)) out.audience = audienceOut(out.audience)
  return out
}

// ── lists and documents ──────────────────────────────────────────────────────────────────────────

function listIn(raw: unknown): GuardList {
  const l: Obj = isObj(raw) ? raw : {}
  return {
    ...l,
    id: String(l.id ?? ''),
    name: isObj(l.name) ? { en: String(l.name.en ?? ''), ar: String(l.name.ar ?? '') } : { en: '', ar: '' },
    filters: arr<Obj>(l.filters).map(
      (f): GuardListFilter => ({ ...f, articles: arr(f.articles), categories: arr(f.categories), attributes: arr(f.attributes) }),
    ),
    include: arr(l.include),
    exclude: arr(l.exclude),
  } as GuardList
}

/** `GET …/Guards/Draft`'s `document` → the editor's ruleset. */
export function guardRulesetIn(raw: unknown): GuardRuleset {
  const d: Obj = isObj(raw) ? raw : {}
  return {
    ...d,
    schema: 1,
    kind: 'guard',
    revision: typeof d.revision === 'number' ? d.revision : 0,
    lists: arr(d.lists).map(listIn),
    rules: arr(d.rules).map(guardRuleIn),
  } as GuardRuleset
}

/** The editor's ruleset → the document `PUT …/Guards/Draft`, Validate and Simulate take. */
export function guardRulesetOut(doc: GuardRuleset): Obj {
  return { ...doc, rules: doc.rules.map(guardRuleOut) }
}

/** A category / coverage document either way (617): the guard blocks' codec, its lists defaulted. */
export function rulesetIn<T>(raw: unknown): T {
  const d: Obj = isObj(raw) ? raw : {}
  const out: Obj = { ...d, rules: arr(d.rules).map(otherRuleIn) }
  if (d.lists !== undefined) out.lists = arr(d.lists).map(listIn)
  return out as T
}
export function rulesetOut(doc: unknown): Obj {
  const d: Obj = isObj(doc) ? doc : {}
  return { ...d, rules: arr(d.rules).map(otherRuleOut) }
}

/** Either kind of document, by its own `kind`. */
export const documentIn = <T>(raw: unknown): T => (isObj(raw) && raw.kind === 'guard' ? (guardRulesetIn(raw) as T) : rulesetIn<T>(raw))
export const documentOut = (doc: unknown): Obj =>
  isObj(doc) && doc.kind === 'guard' ? guardRulesetOut(doc as unknown as GuardRuleset) : rulesetOut(doc)
