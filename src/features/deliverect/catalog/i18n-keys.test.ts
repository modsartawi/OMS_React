/**
 * Ticket 479 — the `deliverect-catalog` namespace ships English and Arabic together, the Arabic file
 * mirrors the English keys exactly, and an English plural (`_one` / `_other`) is all SIX Arabic
 * forms (ticket 433 was reviewed SERIOUS for shipping two).
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/deliverect-catalog.json'
import ar from '@/locales/ar/deliverect-catalog.json'

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

describe('deliverect-catalog — en and ar mirror each other', () => {
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

describe('deliverect-catalog — the keys the code builds exist', () => {
  it.each([en, ar])('the five ScreenGate sentences', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
      expect([key, has(locale, `access.${key}`)]).toEqual([key, true])
  })

  it.each([en, ar])('every state, every row write, every refusal sentence the code builds', (locale) => {
    const keys = [
      ...['active', 'disabled', 'deleted', 'any'].map((s) => `states.${s}`),
      ...['disable', 'delete', 'restore'].flatMap((a) => [`actions.${a}`, ...['title', 'note', 'confirm', 'done', 'doneDetail'].map((k) => `${a}.${k}`)]),
      'flags.disabled',
      'flags.deleted',
      'exclusions.unavailable',
      'push.deliverectAnswer',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it('the exclusion note says excluded means out of stock on that platform only', () => {
    expect(en.exclusions.note).toMatch(/out of stock on that platform only/i)
  })

  it('🚩 copy never says "chain" and never an unqualified "channel" (CONTEXT.md, Deliverect)', () => {
    const words = JSON.stringify(en).toLowerCase()
    expect(words).not.toMatch(/\bchain\b/)
    expect(words).not.toMatch(/\bchannel\b/)
  })
})
