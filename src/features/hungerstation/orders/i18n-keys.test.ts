/**
 * Ticket 556 — the `hungerstation-orders` namespace ships English and Arabic together, the Arabic file
 * mirrors the English keys exactly, and an English plural (`_one` / `_other`) is all SIX Arabic
 * forms (ticket 433 was reviewed SERIOUS for shipping two).
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-orders.json'
import ar from '@/locales/ar/hungerstation-orders.json'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const pluralBase = (key: string, forms: string[]) =>
  forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null

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

describe('hungerstation-orders — en and ar mirror each other', () => {
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

describe('hungerstation-orders — the keys the code builds exist', () => {
  it.each([en, ar])('the five ScreenGate sentences', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
      expect([key, has(locale, `access.${key}`)]).toEqual([key, true])
  })

  it.each([en, ar])('each window problem, each outcome filter, each retry outcome', (locale) => {
    const keys = [
      'filters.windowInvalid',
      'filters.windowReversed',
      'filters.windowTooLong_other',
      'filters.windowOutOfBounds',
      ...['created', 'cancelled', 'failed', 'pending', 'replacedLines', 'unmatched'].map((o) => `outcomeFilters.${o}`),
      'retry.note',
      'retry.notFailed',
      'retry.noSuchOrder',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it('🚩 the retry note says it re-runs the LATEST run only, in neutral words (open question, BackOffice 3028)', () => {
    expect(en.retry.note).toMatch(/latest run only/)
  })
})
