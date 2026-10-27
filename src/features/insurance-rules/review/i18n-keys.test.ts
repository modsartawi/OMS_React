/**
 * Ticket 614 — the `insurance-review` namespace ships English and Arabic together; the Arabic file mirrors the
 * English keys exactly, an English plural (`_one` / `_other`) being all SIX Arabic forms. And every key the code
 * builds from a kind, a mark, a scope, a status, a problem or a log entry exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-review.json'
import ar from '@/locales/ar/insurance-review.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { EXCEPTION_SCOPE_KINDS } from './exception'
import { EXCEPTION_LOG_KINDS, REVIEW_KINDS, REVIEW_MARKS } from './model'

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

describe('insurance-review — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)
  it('the same non-plural keys', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
  })
  it('the same plural families, English two forms and Arabic six', () => {
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })
})

describe('insurance-review — the keys the code builds exist', () => {
  it.each([en, ar])('every kind, mark, scope, status, problem and log entry', (locale) => {
    const keys = [
      ...REVIEW_KINDS.map((k) => `kind.${k}`),
      ...REVIEW_MARKS.map((m) => `mark.${m}`),
      ...EXCEPTION_SCOPE_KINDS.map((s) => `scope.${s}`),
      ...['active', 'expired', 'revoked'].map((s) => `status.${s}`),
      ...['missing', 'invalid', 'past', 'tooLong'].map((p) => `problem.${p}`),
      ...EXCEPTION_LOG_KINDS.map((k) => `log.${k}`),
      'review.rows_other',
      'exceptions.uses_other',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([areaEn, areaAr])('the two menu leaves, in the area namespace', (locale) => {
    for (const key of ['menu.review', 'menu.exceptions']) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
