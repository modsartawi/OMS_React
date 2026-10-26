/**
 * Ticket 607 — the `insurance-rules` (area + core words) and `insurance-guards` namespaces ship English and
 * Arabic together; each Arabic file mirrors the English keys exactly, an English plural (`_one` / `_other`)
 * being all SIX Arabic forms. And every key the code builds — states, severities, flags, and every sentence
 * of every stub rule — exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-rules.json'
import ar from '@/locales/ar/insurance-rules.json'
import guardsEn from '@/locales/en/insurance-guards.json'
import guardsAr from '@/locales/ar/insurance-guards.json'
import type { KeySentence, Sentence, SentenceValue } from '@/core/rules/sentence'
import { LISTS, RULES } from '../../../tools/insurance-rules-stubs.mjs'
import { GUARD_FLAG_KINDS, GUARD_SEVERITIES, GUARD_STATES } from './model'
import { guardSentence, type ConditionNode } from './sentence'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const pluralBase = (key: string, forms: string[]) =>
  forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null

function shape(keys: string[], forms: string[]) {
  const plain = new Set<string>()
  const plurals = new Map<string, Set<string>>()
  for (const key of keys) {
    const base = pluralBase(key, forms)
    if (base === null) plain.add(key)
    else plurals.set(base, (plurals.get(base) ?? new Set()).add(key.slice(base.length)))
  }
  return { plain, plurals }
}

const at = (locale: unknown, key: string): unknown => key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)
const has = (locale: unknown, key: string): boolean => typeof at(locale, key) === 'string'

for (const [ns, enFile, arFile] of [
  ['insurance-rules', en, ar],
  ['insurance-guards', guardsEn, guardsAr],
] as const) {
  describe(`${ns} — en and ar mirror each other`, () => {
    const enShape = shape(leaves(enFile), EN_PLURAL)
    const arShape = shape(leaves(arFile), AR_PLURAL)
    it('the same non-plural keys', () => {
      expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
    })
    it('the same plural families, English two forms and Arabic six', () => {
      expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
      for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
      for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
    })
  })
}

function sentenceKeys(s: Sentence, out: KeySentence[] = []): KeySentence[] {
  if (!('key' in s)) return out
  out.push(s)
  const walk = (v: SentenceValue) => {
    if (v.kind === 'phrase') sentenceKeys(v.sentence, out)
    if (v.kind === 'list') v.items.forEach(walk)
  }
  Object.values(s.values).forEach(walk)
  return out
}
const nodeKeys = (n: ConditionNode): KeySentence[] => [
  ...sentenceKeys(n.sentence),
  ...n.clauses.flatMap((c) => sentenceKeys(c)),
  ...(n.children ?? []).flatMap(nodeKeys),
]

describe('insurance-rules — the keys the code builds exist', () => {
  it.each([en, ar])('the menu, every state, severity and flag', (locale) => {
    const keys = [
      'menu.group',
      'menu.guards',
      ...GUARD_STATES.map((s) => `state.${s}`),
      ...GUARD_SEVERITIES.map((s) => `severity.${s}`),
      ...GUARD_FLAG_KINDS.flatMap((f) => [`flag.${f}`, `flag.${f}Hint`]),
      'flag.since',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([
    ['en', en, '_other'],
    ['ar', ar, '_many'],
  ] as const)('every sentence of every stub rule (%s)', (_lang, locale, plural) => {
    const sentences = RULES.flatMap((r) => {
      const g = guardSentence(r, LISTS)
      return [
        ...g.when.flatMap((s) => sentenceKeys(s)),
        ...g.conditions.flatMap(nodeKeys),
        ...sentenceKeys(g.onUnknown),
        ...g.then.flatMap((e) => [e.does, ...e.codes, ...e.suggest].flatMap((s) => sentenceKeys(s))),
      ]
    })
    for (const s of sentences) {
      const key = s.count === undefined ? s.key : `${s.key}${plural}`
      expect([key, has(locale, key)]).toEqual([key, true])
    }
  })

  it('a sentence slot isolates its value as a tag, never a bare interpolation', () => {
    for (const locale of [en, ar])
      for (const key of leaves(locale.sentence))
        for (const m of String(at(locale.sentence, key)).matchAll(/\{\{(\w+)\}\}/g))
          if (key !== 'unit.percent') expect([key, String(at(locale.sentence, key))]).toEqual([key, expect.stringContaining(`<${m[1].toLowerCase()}>{{${m[1]}}}</${m[1].toLowerCase()}>`)])
  })
})
