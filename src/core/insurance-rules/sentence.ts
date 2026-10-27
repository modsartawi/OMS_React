import type { KeySentence, SentenceValue } from '@/core/rules/sentence'
import {
  severityRank,
  type GuardCheck,
  type GuardCondition,
  type GuardEffect,
  type GuardList,
  type GuardMatch,
  type GuardRule,
  type GuardSeverity,
  type Says,
} from './model'
import { factOf } from './guard-edit'

// A guard rule read as sentences (ticket 607): WHEN (channels, stores, window), IF (the conditions, a
// tree for All of / Any of, NOT on any node), THEN (what each severity does, its codes, its suggestion,
// its EN + AR message). Pure: a block in, a sentence out — every word is a key of the `insurance-rules`
// namespace under `sentence.*`; the values are typed (`SentenceValue` of `@/core/rules/sentence`) so the
// renderer isolates each by kind (bidi.md) and `plainSentence` reads them for a string-only sink.
//
// A list is named by its CURRENT name, looked up by id (a rule's filter id → the ruleset's list id), so a
// rename reads through. A patient or policy list is named by its id: its name lives behind another door.

export interface GuardSentenceContext {
  rule: Pick<GuardRule, 'filters'>
  lists: readonly GuardList[]
}

/** One node of the IF tree: the sentence (NOT already folded in), its clauses, and a group's children. */
export interface ConditionNode {
  check: GuardCheck | string
  not: boolean
  sentence: KeySentence
  /** More about the same block, read after it ("7 days for Controlled drugs"). */
  clauses: KeySentence[]
  /** A group's conditions, in order. */
  children?: ConditionNode[]
}

export interface EffectSentence {
  severity: GuardSeverity
  /** What the severity does to the line. */
  does: KeySentence
  /** The EN + AR message, its `{placeholder}`s as written. */
  says: Says
  codes: KeySentence[]
  suggest: KeySentence[]
}

export interface GuardSentences {
  when: KeySentence[]
  conditions: ConditionNode[]
  onUnknown: KeySentence
  then: EffectSentence[]
}

const S = (key: string, values: Record<string, SentenceValue> = {}, count?: number): KeySentence =>
  count === undefined ? { key: `sentence.${key}`, values } : { key: `sentence.${key}`, values, count }
const phrase = (key: string, values: Record<string, SentenceValue> = {}): SentenceValue => ({ kind: 'phrase', sentence: S(key, values) })
const num = (n: number): SentenceValue => ({ kind: 'number', n })
const code = (c: string): SentenceValue => ({ kind: 'code', code: c })

const KNOWN_FIELDS = new Set(['daysSupply', 'supplyEndsOn', 'qty', 'price'])
/** A `$`-path the sentence names in words, by its locale key (a key may not hold the path's dots). */
const KNOWN_PATHS: Record<string, string> = { '$eligibility.coverage.periodEnd': 'coveragePeriodEnd' }
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

/** An item list by a rule's filter id (or a ruleset list id): its current name, else the id as written. */
function listValue(id: string, ctx: GuardSentenceContext): SentenceValue {
  const listId = ctx.rule.filters.find((f) => f.id === id)?.list ?? id
  const list = ctx.lists.find((l) => l.id === listId)
  return list ? { kind: 'says', says: list.name } : code(id)
}

function matchValue(match: GuardMatch, ctx: GuardSentenceContext, otherKind = false): SentenceValue {
  if (match.startsWith('list:')) return phrase('match.list', { list: listValue(match.slice(5), ctx) })
  if (match === 'sameClass' && otherKind) return phrase('match.sameClassOtherKind')
  return phrase(`match.${match}`)
}

const lineScope = (include: boolean): SentenceValue => phrase(include ? 'lineScope.include' : 'lineScope.exclude')
const fieldValue = (field: string): SentenceValue => (KNOWN_FIELDS.has(field) ? phrase(`field.${field}`) : code(field))
const afterValue = (v: string): SentenceValue =>
  KNOWN_PATHS[v] ? phrase(`path.${KNOWN_PATHS[v]}`) : isDay(v) ? { kind: 'day', day: v } : code(v)

/** One condition — a leaf or a group — read whole, NOT folded in. */
export function conditionSentence(c: GuardCondition, ctx: GuardSentenceContext): ConditionNode {
  const not = c.not === true
  if (c.check === 'group') {
    const key = c.mode === 'any' ? (not ? 'group.notAny' : 'group.any') : not ? 'group.notAll' : 'group.all'
    return { check: 'group', not, sentence: S(key), clauses: [], children: c.conditions.map((x) => conditionSentence(x, ctx)) }
  }
  const { sentence, clauses } = leafSentence(c, ctx)
  return { check: c.check, not, sentence: not ? S('not', { inner: { kind: 'phrase', sentence } }) : sentence, clauses }
}

function leafSentence(c: Exclude<GuardCondition, { check: 'group' }>, ctx: GuardSentenceContext): { sentence: KeySentence; clauses: KeySentence[] } {
  const clauses: KeySentence[] = []
  switch (c.check) {
    case 'history':
      return {
        sentence: S(
          `history.${c.measure}`,
          { match: matchValue(c.match, ctx, c.excludeSameKind === true), atLeast: num(c.atLeast), windowDays: num(c.windowDays), lineScope: lineScope(c.includeThisLine) },
          c.atLeast,
        ),
        clauses,
      }
    case 'supply': {
      const match = matchValue(c.match, ctx)
      const sentence =
        c.eligibleDaysBeforeDue !== undefined
          ? S('supply.daysBeforeDue', { match, days: num(c.eligibleDaysBeforeDue) }, c.eligibleDaysBeforeDue)
          : S('supply.consumedBelow', { match, pct: { kind: 'percent', n: Math.round((c.consumedBelow ?? 0) * 100) } })
      for (const f of c.eligibleDaysBeforeDueFor ?? []) clauses.push(S('supply.daysFor', { days: num(f.value), list: listValue(f.list, ctx) }))
      if (c.accumulate) clauses.push(S('supply.accumulate', { surplusDays: num(c.accumulate.surplusDays), overDays: num(c.accumulate.overDays) }))
      if (c.unknownSupply) clauses.push(S('supply.unknownSupply', { assumeDays: num(c.unknownSupply.assumeDays) }))
      return { sentence, clauses }
    }
    case 'line': {
      if (c.inList !== undefined) return { sentence: S('line.inList', { list: listValue(c.inList, ctx) }), clauses }
      const field = fieldValue(c.field ?? '')
      if (c.above !== undefined) return { sentence: S('line.above', { field, value: num(c.above) }), clauses }
      if (c.below !== undefined) return { sentence: S('line.below', { field, value: num(c.below) }), clauses }
      if (c.after !== undefined) return { sentence: S('line.after', { field, value: afterValue(c.after) }), clauses }
      return { sentence: S('line.any', { field }), clauses }
    }
    case 'volume':
      return {
        sentence: S(
          `volume.${c.by}`,
          { atLeast: num(c.atLeast), match: matchValue(c.match, ctx), window: phrase(`volume.window.${c.window}`), lineScope: lineScope(c.includeThisLine) },
          c.atLeast,
        ),
        clauses,
      }
    case 'sfda':
      if (c.status === 'notMarketed') return { sentence: S('sfda.notMarketed'), clauses }
      if (c.priceAbove !== undefined) return { sentence: S('sfda.priceAbove', { amount: { kind: 'money', amount: c.priceAbove, currency: 'SAR' } }), clauses }
      if (c.packMismatch) return { sentence: S('sfda.packMismatch'), clauses }
      return { sentence: S('sfda.any'), clauses }
    case 'formulary':
      if (c.indication) return { sentence: S(`formulary.${c.indication}`), clauses }
      if (c.edit) return { sentence: S(`formulary.${c.edit}`), clauses }
      return { sentence: S('formulary.any'), clauses }
    case 'patient':
      return { sentence: S('patient.inList', { list: code(c.inList) }), clauses }
    case 'policy':
      return { sentence: S('policy.inList', { list: code(c.inList) }), clauses }
    case 'fact': {
      const def = factOf(c.path)
      const fact = def ? phrase(`fact.name.${def.id}`) : code(c.path)
      if (c.op === 'atLeast' || c.op === 'below')
        return { sentence: S(`fact.${c.op}`, { fact, value: num(Number(c.value)), unit: phrase(`fact.unit.${def?.unit ?? 'units'}`) }), clauses }
      const codes = Array.isArray(c.value) ? c.value : [String(c.value)]
      return { sentence: S(`fact.${c.op}`, { fact, codes: { kind: 'list', join: 'or', items: codes.map(code) } }), clauses }
    }
    case 'formula':
      return { sentence: S('formula', { formula: { kind: 'formula', formula: c.formula } }), clauses }
    default:
      // A block this build does not know (a newer schema): its check id, never a blank line.
      return { sentence: S('unknownBlock', { check: code(String((c as { check?: unknown }).check ?? '')) }), clauses }
  }
}

/** WHEN: who is checked (channels, stores) and the window. */
function whenSentences(rule: GuardRule): KeySentence[] {
  const channels = rule.audience?.channels ?? []
  const stores = rule.audience?.stores ?? []
  const out: KeySentence[] = [
    S('when.audience', {
      channels: channels.length ? { kind: 'list', join: 'and', items: channels.map((ch) => phrase(`channel.${ch}`)) } : phrase('when.noChannel'),
      stores: stores.length ? phrase('when.stores', { stores: { kind: 'list', join: 'and', items: stores.map(code) } }) : phrase('when.allStores'),
    }),
  ]
  const from = rule.window?.from
  const until = rule.window?.until
  if (from && until) out.push(S('when.fromUntil', { from: { kind: 'day', day: from }, until: { kind: 'day', day: until } }))
  else if (from) out.push(S('when.from', { from: { kind: 'day', day: from } }))
  else if (until) out.push(S('when.until', { until: { kind: 'day', day: until } }))
  else out.push(S('when.always'))
  return out
}

const SUGGESTIONS = new Set(['maxQuantity', 'maxDaysSupply'])

function effectSentence(e: GuardEffect): EffectSentence {
  const codes: KeySentence[] = []
  if (e.codes?.conflict) codes.push(S('then.conflict', { code: code(e.codes.conflict) }))
  if (e.codes?.nphies) codes.push(S('then.nphies', { code: code(e.codes.nphies) }))
  const suggest = Object.entries(e.suggest ?? {}).map(([k, v]) =>
    SUGGESTIONS.has(k)
      ? S(`then.suggest.${k}`, { value: code(String(v)) })
      : S('then.suggest.other', { key: code(k), value: code(String(v)) }),
  )
  return { severity: e.severity, does: S(`then.${e.severity}`), says: e.says, codes, suggest }
}

/** A whole guard rule read as sentences; its effects heaviest first (the most severe decides the line). */
export function guardSentence(rule: GuardRule, lists: readonly GuardList[]): GuardSentences {
  const ctx: GuardSentenceContext = { rule, lists }
  const then = rule.then
    .map((e, i) => ({ e, i }))
    .sort((a, b) => severityRank(a.e.severity) - severityRank(b.e.severity) || a.i - b.i)
    .map(({ e }) => effectSentence(e))
  return {
    when: whenSentences(rule),
    conditions: rule.when.map((c) => conditionSentence(c, ctx)),
    onUnknown: S(`onUnknown.${rule.onUnknown === 'warn' ? 'warn' : 'none'}`),
    then,
  }
}

