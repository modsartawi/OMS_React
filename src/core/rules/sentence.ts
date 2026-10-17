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
  RuleSaysRole,
  Says,
} from '@/core/models/rule-campaign'
import { RULE_GROUP_CHECK, RULE_PERCENT_KIND, RULE_POINTS_UNIT } from '@/core/models/rule-campaign'
import { formatMoneyIn, formatMoneyOfUnknownCurrency } from '@/core/money'
import { formatDay } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { printExpr } from './expr'

// A rule read as sentences (ticket 504, re-pointed onto schema 1 in 522). Pure: a block in, a
// sentence out — a locale KEY and its typed VALUES, never English. The wording lives in
// `campaign-workspace.json` under `sentence.*`; the builder renders a sentence through <Trans>, each
// value in its own slot isolated by kind (.claude/rules/bidi.md), and the sentence is formatted whole.
//
// The catalogue says which fields a block has and what kind each is; this module turns each field
// into a value by its kind. A condition is found in it by its `check`, an effect by its `effect`.
// Filters are named by their CURRENT name, looked up by id, so a rename reads through. An expression
// is printed as text by `./expr` (its raw JSON when it cannot be printed).
//
// Keys (all under the `campaign-workspace` namespace):
//   sentence.<condition|effect>.<type>[.<variant>]   the block's sentence
//   sentence.clause.<type>.<field>                   a trailing clause, only when the field is set
//   sentence.option.<type>.<field>.<value>           one choice's words
//   sentence.unit.* · sentence.timing.* · sentence.filter.* · sentence.when.* · sentence.bundle*

/** One value in a sentence, by the kind that decides how it is formatted and isolated. */
export type SentenceValue =
  | { kind: 'money'; amount: number; currency: string | null }
  | { kind: 'number'; n: number }
  | { kind: 'percent'; n: number }
  | { kind: 'code'; code: string }
  | { kind: 'formula'; formula: string }
  /** A name the marketer gave — a filter, a named value, a budget, an audience. */
  | { kind: 'name'; name: string }
  /** A local day, `yyyy-MM-dd`. */
  | { kind: 'day'; day: string }
  /** Words of their own — an option, a unit, "all merchandise". */
  | { kind: 'phrase'; sentence: Sentence }
  | { kind: 'list'; items: SentenceValue[]; join: 'and' | 'or' }

export interface Sentence {
  key: string
  values: Record<string, SentenceValue>
  /** The number the sentence agrees with (i18next plurals). */
  count?: number
}

/** A marketer's EN + AR text under a block — "not met", a receipt label, a cashier prompt. */
export interface SaysLine {
  /** The block's field it came from — unique within the block. */
  field: string
  role: RuleSaysRole
  says: Says
}

export interface BlockSentence {
  sentence: Sentence
  /** Trailing clauses, in field order (", over merchandise"). */
  clauses: Sentence[]
  says: SaysLine[]
  /** False when the catalogue does not know the block's type, or has no words for it. */
  known: boolean
}

export interface SentenceContext {
  campaign: Pick<RuleCampaign, 'budgets' | 'audience'>
  rule: Pick<CampaignRule, 'filters' | 'values'>
  catalogue: RuleBlockCatalogue
  /** Whether a locale key exists (with its plural, when `count` is given). */
  has: (key: string, count?: number) => boolean
}

const S = (key: string, values: Record<string, SentenceValue> = {}, count?: number): Sentence =>
  count === undefined ? { key, values } : { key, values, count }
const phrase = (key: string, values: Record<string, SentenceValue> = {}, count?: number): SentenceValue => ({
  kind: 'phrase',
  sentence: S(key, values, count),
})

/** The category a filter must keep out unless the marketer means it (ADR 0094, ruled A006 only). */
export const RX_CATEGORY = 'A006'

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
 * A formula field's value (a number, a named value or an expression), or null when it is a plain
 * number (the caller formats that by its unit). A `"$name"` reads the named value by name.
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

/** True for a field a clause leaves out: empty, zero, false, "none", or its default. */
function isAbsent(field: RuleCatalogueField, raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '' || raw === 0 || raw === false) return true
  if (Array.isArray(raw) && raw.length === 0) return true
  if (field.kind === 'timing') return timingOf(raw) === null
  return field.default !== undefined && raw === field.default
}

/** One field's value, by its kind; null for a field that only switches a clause on (`flag`). */
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
    const key = `sentence.option.${block.type}.${field.key}.${String(value)}`
    return ctx.has(key) ? phrase(key) : { kind: 'code', code: String(value) }
  }
  switch (field.kind) {
    case 'items':
      return itemsValue(raw, ctx.rule.filters)
    case 'money':
      return isNumber(raw) ? { kind: 'money', amount: raw, currency } : notPicked
    case 'count':
      return isNumber(raw) ? { kind: 'number', n: raw } : notPicked
    case 'days':
      return isNumber(raw) ? phrase('sentence.unit.days', { n: { kind: 'number', n: raw } }, raw) : notPicked
    case 'discount': {
      const named = formulaValue(raw, ctx.rule)
      if (named) return named
      if (!isNumber(raw)) return notPicked
      const unit = field.unitFrom ? item[field.unitFrom] : undefined
      return unit === RULE_PERCENT_KIND ? { kind: 'percent', n: raw } : { kind: 'money', amount: raw, currency }
    }
    case 'points': {
      const unit = field.unitFrom ? item[field.unitFrom] : undefined
      const named = formulaValue(raw, ctx.rule)
      if (!named && !isNumber(raw)) return notPicked
      if (unit === RULE_POINTS_UNIT)
        return named ? phrase('sentence.unit.pointsNamed', { name: named }) : phrase('sentence.unit.points', { n: { kind: 'number', n: raw as number } }, raw as number)
      // `SAR` is a riyal's worth of points; the campaign's currency otherwise.
      const worthIn = typeof unit === 'string' && /^[A-Z]{3}$/.test(unit) ? unit : currency
      if (named && !worthIn) return phrase('sentence.unit.pointsWorthNamedUnknown', { name: named })
      return named
        ? phrase('sentence.unit.pointsWorthNamed', { name: named, currency: { kind: 'code', code: worthIn ?? '' } })
        : phrase('sentence.unit.pointsWorth', { money: { kind: 'money', amount: raw as number, currency: worthIn } })
    }
    case 'code':
      return typeof raw === 'string' && raw ? { kind: 'code', code: raw } : notPicked
    case 'codes': {
      const codes = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x !== '') : []
      return codes.length ? { kind: 'list', join: 'or', items: codes.map((code) => ({ kind: 'code', code })) } : phrase('sentence.nothingPicked')
    }
    case 'text':
      return typeof raw === 'string' && raw ? { kind: 'name', name: raw } : notPicked
    case 'choice':
      return raw === undefined || raw === null || raw === '' ? notPicked : option(raw)
    case 'choices': {
      const picked = Array.isArray(raw) ? raw : []
      return picked.length ? { kind: 'list', join: 'or', items: picked.map(option) } : phrase('sentence.nothingPicked')
    }
    case 'formula':
      return raw === undefined || raw === null || raw === '' ? notPicked : { kind: 'formula', formula: exprText(raw as RuleExpr, ctx.rule) }
    case 'timing': {
      const t = timingOf(raw)
      if (!t) return notPicked
      if ('on' in t) return phrase('sentence.timing.on', { day: { kind: 'day', day: t.on } })
      return phrase('sentence.timing.afterDays', { n: { kind: 'number', n: t.afterDays } }, t.afterDays)
    }
    case 'budget': {
      const b = (ctx.campaign.budgets ?? []).find((x) => x.id === raw)
      return b ? { kind: 'name', name: b.name.en || b.id } : phrase('sentence.missingBudget')
    }
    case 'flag':
    case 'says':
      return null
  }
}

/** A block's catalogue type: a condition's `check`, an effect's `effect`. */
export const blockType = (item: RuleCondition | RuleEffect): string =>
  String(('check' in item ? item.check : (item as RuleEffect).effect) ?? '')

/** Where a block's catalogue entry is, by its type and kind. */
export function catalogueBlock(catalogue: RuleBlockCatalogue, kind: RuleBlockKind, type: string): RuleCatalogueBlock | undefined {
  return catalogue.blocks.find((b) => b.kind === kind && b.type === type)
}

const unknownBlock = (type: string): BlockSentence => ({
  sentence: S('sentence.unknown', { type: { kind: 'code', code: type } }),
  clauses: [],
  says: [],
  known: false,
})

const pluralCount = (x: unknown): number => (isNumber(x) ? x : 2)

/** A condition or an effect, as a sentence with its clauses and its EN + AR lines. */
export function blockSentence(kind: RuleBlockKind, item: RuleCondition | RuleEffect, ctx: SentenceContext): BlockSentence {
  const type = blockType(item)
  const block = catalogueBlock(ctx.catalogue, kind, type)
  if (!block) return unknownBlock(type)
  const currency = campaignCurrency(ctx.campaign.audience)
  const raw = item as Record<string, unknown>

  const variantField = block.variant ? block.fields.find((f) => f.key === block.variant) : undefined
  const variant = block.variant ? (raw[block.variant] ?? variantField?.default) : undefined
  const key = `sentence.${kind}.${block.type}${block.variant ? `.${String(variant)}` : ''}`
  // A sentence that agrees in number reads in its "other" form while its number is not set yet.
  const pluralField = block.fields.find((f) => f.plural && !f.clause)
  const count = pluralField ? pluralCount(raw[pluralField.key]) : undefined
  if (!ctx.has(key, count)) return unknownBlock(type)

  const values: Record<string, SentenceValue> = {}
  const clauses: Sentence[] = []
  const says: SaysLine[] = []
  for (const field of block.fields) {
    if (field.key === block.variant) continue
    const v = raw[field.key]
    if (field.kind === 'says') {
      const pair = v as Partial<Says> | undefined
      if (pair && (pair.en || pair.ar)) says.push({ field: field.key, role: field.role ?? 'message', says: { en: pair.en ?? '', ar: pair.ar ?? '' } })
      continue
    }
    if (field.clause) {
      if (isAbsent(field, v)) continue
      const value = fieldValue(block, field, v, raw, ctx, currency)
      const clauseKey = `sentence.clause.${block.type}.${field.key}`
      const clauseCount = field.plural ? pluralCount(v) : undefined
      if (ctx.has(clauseKey, clauseCount)) clauses.push(S(clauseKey, value ? { [field.key]: value } : {}, clauseCount))
      continue
    }
    const value = fieldValue(block, field, v, raw, ctx, currency)
    if (value) values[field.key] = value
  }
  return { sentence: S(key, values, count), clauses, says, known: true }
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
export function bundleSentence(bundle: RuleBundle, rule: Pick<CampaignRule, 'filters'>): { sentence: Sentence; clauses: Sentence[] } {
  const lists: SentenceValue = bundle.lists.length
    ? {
        kind: 'list',
        join: 'and',
        items: bundle.lists.map((l) =>
          phrase('sentence.part', { count: isNumber(l.count) ? { kind: 'number', n: l.count } : phrase('sentence.notPicked'), filter: itemsValue(l.filter, rule.filters) }),
        ),
      }
    : phrase('sentence.nothingPicked')
  const clauses: Sentence[] = []
  if (isNumber(bundle.max) && bundle.max > 0) clauses.push(S('sentence.bundleMax', { max: { kind: 'number', n: bundle.max } }, bundle.max))
  if (bundle.sameAttribute) clauses.push(S('sentence.bundleSame', { attribute: { kind: 'code', code: bundle.sameAttribute } }))
  return { sentence: S('sentence.bundle', { lists }), clauses }
}

/** A named cart-item filter as a chain: its name, then what it looks at and keeps out. */
export interface FilterChain {
  id: string
  name: string
  links: Sentence[]
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
  const links: Sentence[] = []
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

/**
 * A sentence as plain text — for a string-only sink and for the tests that read every sentence.
 * `t` resolves a key; `lang` joins lists. The template is read RAW (its plural form picked, nothing
 * interpolated), its slot tags are stripped, and only then do the values go in — so a value that
 * looks like a tag (`a<b>c`) is kept as written, and a plural sentence's `count` slot reads its
 * value ("not picked yet") rather than the number its form was picked by.
 */
export function plainSentence(
  s: Sentence,
  t: (key: string, options: Record<string, unknown>) => string,
  lang = 'en',
): string {
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
    case 'day':
      return formatDay(v.day)
    case 'phrase':
      return plainSentence(v.sentence, t, lang)
    case 'list':
      return new Intl.ListFormat(lang, { type: v.join === 'and' ? 'conjunction' : 'disjunction' }).format(v.items.map((x) => plainValue(x, t, lang)))
  }
}
