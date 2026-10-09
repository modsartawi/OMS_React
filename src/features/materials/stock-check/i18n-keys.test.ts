/**
 * Ticket 453 — the `materials-stock-check` namespace ships English and Arabic together, and the
 * Arabic file mirrors the English keys exactly. An English plural (`_one` / `_other`) is all SIX
 * Arabic forms (`_zero _one _two _few _many _other`) — ticket 433 was reviewed SERIOUS for two.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/materials-stock-check.json'
import ar from '@/locales/ar/materials-stock-check.json'
import searchEn from '@/locales/en/materials-search.json'
import searchAr from '@/locales/ar/materials-search.json'
import { STOCK_CAP_REFUSAL_KEY } from '@/core/materials/stock-cap'
import { STORE_SET_KINDS } from './api'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const pluralBase = (key: string, forms: string[]) => forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null

/** The keys with each plural family folded to its base, plus the set of plural bases. */
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

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

describe('materials-stock-check — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)

  it('the same non-plural keys', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
  })

  it('the same plural families', () => {
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
  })

  it('every English plural has exactly _one and _other', () => {
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
  })

  it('every Arabic plural has all six forms', () => {
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })
})

describe('materials-stock-check — the keys the code builds exist', () => {
  it.each([en, ar])('each store-set kind', (locale) => {
    for (const kind of STORE_SET_KINDS) expect([kind, has(locale, `sets.kinds.${kind}`)]).toEqual([kind, true])
  })

  it.each([en, ar])('the ScreenGate access block', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint']) expect(has(locale, `access.${key}`)).toBe(true)
  })

  it.each([searchEn, searchAr])('the shared words it borrows: the cap refusal and the MAT-00004 panel', (locale) => {
    const [, key] = STOCK_CAP_REFUSAL_KEY.split(':')
    for (const k of [key, 'shared.stockUnavailableTitle', 'shared.stockUnavailableBody', 'shared.stockUnavailableRetry'])
      expect([k, has(locale, k)]).toEqual([k, true])
  })
})
