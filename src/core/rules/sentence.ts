import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleBlockKind,
  RuleBundle,
  RuleCampaign,
  RuleCatalogueBlock,
  RuleCatalogueField,
  RuleCondition,
  RuleConditionGroup,
  RuleEffect,
  RuleExpr,
  RuleItemFilter,
  RuleNamedValue,
  Says,
} from '@/core/models/rule-campaign'
import { RULE_GROUP_CHECK, RULE_PERCENT_KIND, RULE_POINTS_UNIT } from '@/core/models/rule-campaign'
import { formatMoneyIn, formatMoneyOfUnknownCurrency } from '@/core/money'
import { formatDay } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { printExpr } from './expr'

// A rule read as sentences (ticket 504; schema 1 in 522; HQ's catalogue in 523). Pure: a block in,
// a sentence out, never English of its own.
//
// A condition or an effect reads in HQ's own words: its catalogue block's `sentence` ({en, ar}), its
// fields named in braces ("the subtotal of {of} is at least {amount}"). This module fills each braced
// field with a typed VALUE by the field's `type`; the builder renders the template, each value in its
// own slot isolated by kind (.claude/rules/bidi.md). A field the template does not name is read only
// when it says something more: an EN + AR `text` field (a "not met" line, a receipt label, a cashier
// prompt) as a line under the sentence, and any other as a trailing clause from the bundle
// (`sentence.clause.<type>.<field>`) when the field is set and the bundle has words for it.
//
// Filters are named by their CURRENT name, looked up by id, so a rename reads through. An expression
// is printed as text by `./expr` (its raw JSON when it cannot be printed). The rule's other lines (its
// When, a filter's chain, a named value, the bundle) are the bundle's own sentences: a locale KEY and
// its values, under `sentence.*` in `campaign-workspace.json`.

/** One value in a sentence, by the kind that decides how it is formatted and isolated. */
export type SentenceValue =
  | { kind: 'money'; amount: number; currency: string | null }
  | { kind: 'number'; n: number }
  | { kind: 'percent'; n: number }
  | { kind: 'code'; code: string }
  | { kind: 'formula'; formula: string }
  /** A name the marketer gave — a filter, a named value, a budget, an audience. */
  | { kind: 'name'; name: string }
  /** A marketer's text in both languages, read in the reader's. */
  | { kind: 'says'; says: Says }
  /** A local day, `yyyy-MM-dd`. */
  | { kind: 'day'; day: string }
  /** Words of their own — an option, a unit, "all merchandise". */
  | { kind: 'phrase'; sentence: Sentence }
  | { kind: 'list'; items: SentenceValue[]; join: 'and' | 'or' }

/** A sentence of the bundle: a locale key and its values. */
export interface KeySentence {
  key: string
  values: Record<string, SentenceValue>
  /** The number the sentence agrees with (i18next plurals). */
  count?: number
}

/** A sentence in HQ's own words: a catalogue block's `sentence`, its fields in braces. */
export interface TemplateSentence {
  template: Says
  values: Record<string, SentenceValue>
}

export type Sentence = KeySentence | TemplateSentence

/** What an EN + AR line under a block is for. */
export type SaysRole = 'notMet' | 'receiptLabel' | 'cashierPrompt' | 'message'

/** A marketer's EN + AR text under a block — "not met", a receipt label, a cashier prompt. */
export interface SaysLine {
  /** The block's field it came from — unique within the block. */
  field: string
  role: SaysRole
  says: Says
}

export interface BlockSentence {
  sentence: Sentence
  /** Trailing clauses, in field order (", over merchandise"). */
  clauses: KeySentence[]
  says: SaysLine[]
  /** False when the catalogue does not list the block's type. */
  known: boolean
}

export interface SentenceContext {
  campaign: Pick<RuleCampaign, 'budgets' | 'audience'>
  rule: Pick<CampaignRule, 'filters' | 'values'>
  catalogue: RuleBlockCatalogue
  /** Whether a locale key exists (with its plural, when `count` is given). */
  has: (key: string, count?: number) => boolean
}

const S = (key: string, values: Record<string, SentenceValue> = {}, count?: number): KeySentence =>
  count === undefined ? { key, values } : { key, values, count }
const phrase = (key: string, values: Record<string, SentenceValue> = {}, count?: number): SentenceValue => ({
  kind: 'phrase',
  sentence: S(key, values, count),
})

/** The category a filter must keep out unless the marketer means it (ADR 0094, ruled A006 only). */
export const RX_CATEGORY = 'A006'

/** A block's own field naming its type (`check` / `effect`) — never read as a value. */
const TYPE_FIELDS = new Set(['check', 'effect'])

/** What an EN + AR field the sentence does not name is for, by its name; any other is a message. */
const SAYS_ROLE: Record<string, SaysRole> = { says: 'notMet', label: 'receiptLabel', prompt: 'cashierPrompt' }
export const saysRoleOf = (field: string): SaysRole => SAYS_ROLE[field] ?? 'message'

/** HQ's text in the reader's language: Arabic when the reader reads Arabic and HQ has it, else English. */
export const saysIn = (s: Says, lang: string): string => (lang.startsWith('ar') && s.ar ? s.ar : s.en || s.ar)

/** The fields a template names, in braces. */
export function bracedFields(template: Says): Set<string> {
  const out = new Set<string>()
  for (const text of [template.en, template.ar]) for (const m of (text ?? '').matchAll(/\{(\w+)\}/g)) out.add(m[1])
  return out
}

/**
 * The currency a campaign's amounts are in. PROVISIONAL: the campaign carries no currency on the
 * wire, so it is read from the audience's countries — one country's currency, or null (an amount
 * then shows its own decimals, with no code) when the audience spans both or names none.
 */
const COUNTRY_CURRENCY: Record<string, string> = { SA: 'SAR', BH: 'BHD' }
export function campaignCurrency(audience: Pick<NonNullable<RuleCampaign['audience']>, 'countries'> | null | undefined): string | null {
  const currencies = new Set((audience?.countries ?? []).map((c) => COUNTRY_CURRENCY[c.toUpperCase()]).filter(Boolean))
  return currencies.size === 1 ? [...currencies][0] : null
}

/** A percent as one string, `15%` — where the sign sits is the locale's (`sentence.unit.percent`). */
export const percentText = (n: number, t: (key: string, options: Record<string, unknown>) => string): string =>
  t('sentence.unit.percent', { n: formatNumber(n) })

/** A money value as one string — the code and the figure, isolated once by the renderer. */
export function moneyText(v: { amount: number; currency: string | null }): string {
  return v.currency ? `${v.currency} ${formatMoneyIn(v.amount, v.currency)}` : formatMoneyOfUnknownCurrency(v.amount)
}

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** A filter of the rule, named by its current name — all merchandise when absent, or words saying it is gone. */
function itemsValue(id: unknown, filters: readonly RuleItemFilter[]): SentenceValue {
  if (id === '' || id == null) return phrase('sentence.allItems')
  const f = filters.find((x) => x.id === id)
  return f ? { kind: 'name', name: f.name } : phrase('sentence.missingFilter')
}

/** An expression as text, or its raw JSON when the codec cannot print it. */
export function exprText(expr: RuleExpr, rule: Pick<CampaignRule, 'filters'>): string {
  return printExpr(expr, { filters: rule.filters }) ?? JSON.stringify(expr)
}

/**
 * A formula field's value (a named value or an expression), or null when it is a plain number (the
 * caller formats that by its unit). A `"$name"` reads the named value by name.
 */
function formulaValue(raw: unknown, rule: SentenceContext['rule']): SentenceValue | null {
  if (typeof raw === 'string' && /^\$[A-Za-z_]\w*$/.test(raw)) {
    const v = rule.values.find((x) => x.name === raw.slice(1))
    return v ? { kind: 'name', name: v.name } : phrase('sentence.missingValue')
  }
  if (Array.isArray(raw) || typeof raw === 'string') return { kind: 'formula', formula: exprText(raw as RuleExpr, rule) }
  return null
}

/** A points date: `{ afterDays }` or `{ on }`; anything else is not set. */
function timingOf(raw: unknown): { afterDays: number } | { on: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as { afterDays?: unknown; on?: unknown }
  if (isNumber(t.afterDays)) return { afterDays: t.afterDays }
  if (typeof t.on === 'string' && t.on) return { on: t.on }
  return null
}

/** True for a field a clause leaves out: empty, zero, false, or its default. */
function isAbsent(field: RuleCatalogueField, raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '' || raw === 0 || raw === false) return true
  if (Array.isArray(raw) && raw.length === 0) return true
  if (field.type === 'pointsDate') return timingOf(raw) === null
  return field.default != null && JSON.stringify(raw) === JSON.stringify(field.default)
}

/**
 * A field's unit for this block: the catalogue's, or — for a unit of two words, which the field's
 * sibling decides — the one the block's sibling says: `currency|%` by a discount's `kind`, `SAR|PTS`
 * by a points effect's `unit` (`points` for PTS; SAR names its own unit in HQ's sentence, so none).
 */
export function unitOf(field: Pick<RuleCatalogueField, 'unit'>, item: Record<string, unknown>): string | null {
  if (field.unit === 'currency|%') return item.kind === RULE_PERCENT_KIND ? '%' : 'currency'
  if (field.unit === 'SAR|PTS') return item.unit === RULE_POINTS_UNIT ? 'points' : null
  return field.unit
}

/**
 * A number field's figure by its unit: money in the campaign's currency, a percent, or a plain
 * number (the template carries "units", "points", "days" and a `%` written after the value).
 */
function figure(field: RuleCatalogueField, n: number, item: Record<string, unknown>, currency: string | null): SentenceValue {
  const unit = unitOf(field, item)
  if (field.type === 'money' || unit === 'currency') return { kind: 'money', amount: n, currency }
  if (unit === '%' && field.type !== 'percent') return { kind: 'percent', n }
  return { kind: 'number', n }
}

/** One field's value, by its type; null for a field that has no value of its own to show (nested conditions, objects). */
function fieldValue(
  block: RuleCatalogueBlock,
  field: RuleCatalogueField,
  raw: unknown,
  item: Record<string, unknown>,
  ctx: SentenceContext,
  currency: string | null,
): SentenceValue | null {
  const notPicked = phrase('sentence.notPicked')
  const option = (value: unknown): SentenceValue => {
    const key = `sentence.option.${block.type}.${field.name}.${String(value)}`
    return ctx.has(key) ? phrase(key) : { kind: 'code', code: String(value) }
  }
  switch (field.type) {
    case 'filter':
      return itemsValue(raw, ctx.rule.filters)
    case 'money':
    case 'count':
    case 'points':
    case 'percent':
    case 'number':
      return isNumber(raw) ? figure(field, raw, item, currency) : notPicked
    case 'formula': {
      if (isNumber(raw)) return figure(field, raw, item, currency)
      if (raw === undefined || raw === null || raw === '') return notPicked
      // A named value or an expression; anything else (`true`) is printed as the codec prints it.
      return formulaValue(raw, ctx.rule) ?? { kind: 'formula', formula: exprText(raw as RuleExpr, ctx.rule) }
    }
    case 'code':
    case 'time':
      return typeof raw === 'string' && raw ? { kind: 'code', code: raw } : notPicked
    case 'codes': {
      const codes = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x !== '') : []
      if (!codes.length) return phrase('sentence.nothingPicked')
      return { kind: 'list', join: 'or', items: codes.map(option) }
    }
    case 'text': {
      const pair = raw as Partial<Says> | undefined
      return pair && (pair.en || pair.ar) ? { kind: 'says', says: { en: pair.en ?? '', ar: pair.ar ?? '' } } : notPicked
    }
    case 'choice':
      return raw === undefined || raw === null || raw === '' ? notPicked : option(raw)
    case 'bool':
      return phrase(raw === true ? 'sentence.yes' : 'sentence.no')
    case 'budget': {
      const b = (ctx.campaign.budgets ?? []).find((x) => x.id === raw)
      // A budget's name is the marketer's EN + AR text, read in the reader's language; its id when unnamed.
      if (!b) return phrase('sentence.missingBudget')
      return b.name.en || b.name.ar ? { kind: 'says', says: b.name } : { kind: 'code', code: b.id }
    }
    case 'pointsDate': {
      const t = timingOf(raw)
      if (!t) return notPicked
      if ('on' in t) return phrase('sentence.timing.on', { day: { kind: 'day', day: t.on } })
      return phrase('sentence.timing.afterDays', { n: { kind: 'number', n: t.afterDays } }, t.afterDays)
    }
    case 'date':
      return typeof raw === 'string' && raw ? { kind: 'day', day: raw } : notPicked
    case 'conditions':
    case 'object':
    case 'objects':
    case 'entries':
      return null
  }
}

/** A block's catalogue type: a condition's `check`, an effect's `effect`. */
export const blockType = (item: RuleCondition | RuleEffect): string =>
  String(('check' in item ? item.check : (item as RuleEffect).effect) ?? '')

/** A condition's or an effect's catalogue entry, by its type. */
export function catalogueBlock(catalogue: RuleBlockCatalogue, kind: RuleBlockKind, type: string): RuleCatalogueBlock | undefined {
  return (kind === 'condition' ? catalogue.conditions : catalogue.effects).find((b) => b.type === type)
}

/** A block's own fields — every one but the field naming its type. */
export const blockFields = (block: RuleCatalogueBlock): RuleCatalogueField[] => block.fields.filter((f) => !TYPE_FIELDS.has(f.name))

const unknownBlock = (type: string): BlockSentence => ({
  sentence: S('sentence.unknown', { type: { kind: 'code', code: type } }),
  clauses: [],
  says: [],
  known: false,
})

/** A condition or an effect, as HQ's sentence with its clauses and its EN + AR lines. */
export function blockSentence(kind: RuleBlockKind, item: RuleCondition | RuleEffect, ctx: SentenceContext): BlockSentence {
  const type = blockType(item)
  const block = catalogueBlock(ctx.catalogue, kind, type)
  if (!block || !(block.sentence?.en || block.sentence?.ar)) return unknownBlock(type)
  const currency = campaignCurrency(ctx.campaign.audience)
  const raw = item as Record<string, unknown>
  const braced = bracedFields(block.sentence)

  const values: Record<string, SentenceValue> = {}
  const clauses: KeySentence[] = []
  const says: SaysLine[] = []
  for (const field of blockFields(block)) {
    const v = raw[field.name]
    if (braced.has(field.name)) {
      const value = fieldValue(block, field, v, raw, ctx, currency)
      if (value) values[field.name] = value
      continue
    }
    if (field.type === 'text') {
      const pair = v as Partial<Says> | undefined
      if (pair && (pair.en || pair.ar)) says.push({ field: field.name, role: saysRoleOf(field.name), says: { en: pair.en ?? '', ar: pair.ar ?? '' } })
      continue
    }
    if (isAbsent(field, v)) continue
    const clauseKey = `sentence.clause.${block.type}.${field.name}`
    if (!ctx.has(clauseKey)) continue
    const value = fieldValue(block, field, v, raw, ctx, currency)
    clauses.push(S(clauseKey, value ? { [field.name]: value } : {}))
  }
  return { sentence: { template: block.sentence, values }, clauses, says, known: true }
}

/** How a nested group of conditions opens: "All of these" / "Any of these". */
export function groupSentence(mode: unknown): Sentence {
  return S(mode === 'any' ? 'sentence.group.any' : 'sentence.group.all')
}

/** The rule's When line: every condition must hold — or "always", for a rule with none. */
export function whenSentence(rule: Pick<CampaignRule, 'when'>): Sentence {
  return S(leafConditions(rule.when).length ? 'sentence.when.all' : 'sentence.when.always')
}

/** A rule's bundle (`rule.bundle`): its lists — N of a filter each — and its limits, as clauses. */
export function bundleSentence(bundle: RuleBundle, rule: Pick<CampaignRule, 'filters'>): { sentence: KeySentence; clauses: KeySentence[] } {
  const lists: SentenceValue = bundle.lists.length
    ? {
        kind: 'list',
        join: 'and',
        items: bundle.lists.map((l) =>
          phrase('sentence.part', { count: isNumber(l.count) ? { kind: 'number', n: l.count } : phrase('sentence.notPicked'), filter: itemsValue(l.filter, rule.filters) }),
        ),
      }
    : phrase('sentence.nothingPicked')
  const clauses: KeySentence[] = []
  if (isNumber(bundle.max) && bundle.max > 0) clauses.push(S('sentence.bundleMax', { max: { kind: 'number', n: bundle.max } }, bundle.max))
  if (bundle.sameAttribute) clauses.push(S('sentence.bundleSame', { attribute: { kind: 'code', code: bundle.sameAttribute } }))
  return { sentence: S('sentence.bundle', { lists }), clauses }
}

/** A named cart-item filter as a chain: its name, then what it looks at and keeps out. */
export interface FilterChain {
  id: string
  name: string
  links: KeySentence[]
}

export function filterChain(f: RuleItemFilter): FilterChain {
  const codes = (list: readonly string[], join: 'and' | 'or' = 'or'): SentenceValue => ({
    kind: 'list',
    join,
    items: list.map((code) => (code === RX_CATEGORY ? phrase('sentence.filter.rx', { code: { kind: 'code', code } }) : { kind: 'code', code })),
  })
  const cats = f.categories ?? []
  const articles = f.articles ?? []
  const never = f.exclude?.categories ?? []
  const links: KeySentence[] = []
  if (cats.length) links.push(S('sentence.filter.categories', { cats: codes(cats) }))
  if (articles.length) links.push(S('sentence.filter.products', { skus: codes(articles) }))
  // A filter that picks nothing matches every cart item; say so before what it keeps out.
  if (!links.length) links.push(S('sentence.filter.all'))
  if (never.length) links.push(S('sentence.filter.never', { cats: codes(never) }))
  return { id: f.id, name: f.name, links }
}

/** A named value: its name and its expression as text (its JSON when it cannot be printed). */
export function valueSentence(v: RuleNamedValue, rule: Pick<CampaignRule, 'filters'>): Sentence {
  return S('sentence.value', { name: { kind: 'name', name: v.name }, formula: { kind: 'formula', formula: exprText(v.expr, rule) } })
}

/** A nested group of conditions (the catalogue's `group` block): its own all / any, its own conditions. */
export function isConditionGroup(c: RuleCondition): c is RuleConditionGroup {
  return c.check === RULE_GROUP_CHECK && Array.isArray(c.conditions)
}

/** Every leaf condition under a list of conditions, nested groups opened. */
export function leafConditions(when: readonly RuleCondition[]): RuleCondition[] {
  return when.flatMap((c) => (isConditionGroup(c) ? leafConditions(c.conditions) : [c]))
}

/** A collapsed rule's one-line summary: how many filters, conditions and effects. */
export function ruleSummary(rule: Pick<CampaignRule, 'filters' | 'when' | 'then'>) {
  return { filters: rule.filters.length, conditions: leafConditions(rule.when).length, effects: rule.then.length }
}

/** A template's text and its slots, in order: `"at least {amount}"` → text, then the `amount` slot. */
export function templateParts(template: string): ({ text: string } | { slot: string })[] {
  const parts: ({ text: string } | { slot: string })[] = []
  let at = 0
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if (m.index > at) parts.push({ text: template.slice(at, m.index) })
    parts.push({ slot: m[1] })
    at = m.index + m[0].length
  }
  if (at < template.length) parts.push({ text: template.slice(at) })
  return parts
}

/**
 * A sentence as plain text — for a string-only sink and for the tests that read every sentence.
 * `t` resolves a key; `lang` picks HQ's template and joins lists. A bundle template is read RAW (its
 * plural form picked, nothing interpolated), its slot tags are stripped, and only then do the values
 * go in — so a value that looks like a tag (`a<b>c`) is kept as written, and a plural sentence's
 * `count` slot reads its value ("not picked yet") rather than the number its form was picked by.
 */
export function plainSentence(
  s: Sentence,
  t: (key: string, options: Record<string, unknown>) => string,
  lang = 'en',
): string {
  if ('template' in s)
    return templateParts(saysIn(s.template, lang))
      .map((p) => ('text' in p ? p.text : p.slot in s.values ? plainValue(s.values[p.slot], t, lang) : ''))
      .join('')
  const template = t(s.key, { skipInterpolation: true, ...(s.count === undefined ? {} : { count: s.count }) })
  return template
    .replace(/<\/?[A-Za-z][\w-]*\s*\/?>/g, '')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (k in s.values ? plainValue(s.values[k], t, lang) : k === 'count' && s.count !== undefined ? String(s.count) : ''))
}

export function plainValue(v: SentenceValue, t: (key: string, options: Record<string, unknown>) => string, lang = 'en'): string {
  switch (v.kind) {
    case 'money':
      return moneyText(v)
    case 'number':
      return formatNumber(v.n)
    case 'percent':
      return percentText(v.n, t)
    case 'code':
      return v.code
    case 'formula':
      return v.formula
    case 'name':
      return v.name
    case 'says':
      return saysIn(v.says, lang)
    case 'day':
      return formatDay(v.day)
    case 'phrase':
      return plainSentence(v.sentence, t, lang)
    case 'list':
      return new Intl.ListFormat(lang, { type: v.join === 'and' ? 'conjunction' : 'disjunction' }).format(v.items.map((x) => plainValue(x, t, lang)))
  }
}

/** What a sentence is, for a `data-` mark: a bundle sentence's key, or `fallback` (the block's type) for HQ's own words. */
export const sentenceId = (s: Sentence, fallback: string): string => ('key' in s ? s.key : fallback)
