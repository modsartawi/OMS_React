/**
 * Ticket 482 — the `deliverect-terms` namespace ships English and Arabic together, the Arabic file
 * mirrors the English keys exactly, and an English plural (`_one` / `_other`) is all SIX Arabic
 * forms (ticket 433 was reviewed SERIOUS for shipping two).
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/deliverect-terms.json'
import ar from '@/locales/ar/deliverect-terms.json'

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

describe('deliverect-terms — en and ar mirror each other', () => {
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

describe('deliverect-terms — the keys the code builds exist', () => {
  it.each([en, ar])('the five ScreenGate sentences', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
      expect([key, has(locale, `access.${key}`)]).toEqual([key, true])
  })

  it.each([en, ar])('every read state, column, field and problem the code builds', (locale) => {
    const keys = [
      ...['accounts', 'platforms', 'timeline'].flatMap((w) => ['loading', 'failed', 'empty'].map((k) => `${w}.${k}`)),
      ...['platform', 'platformKey', 'channelId', 'creditCustomer', 'active', 'actions'].map((c) => `platforms.columns.${c}`),
      ...['customerDiscountPct', 'commissionPct', 'deliveryFee', 'deliveryFeeThreshold'].map((f) => `add.${f}`),
      ...['required', 'date', 'number', 'percent'].map((p) => `add.problems.${p}`),
      ...['required', 'wholeNumber', 'noCreditCustomer'].map((p) => `edit.problems.${p}`),
      ...['inside', 'insideOpen', 'before'].map((k) => `add.conflict.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it('the edit dialog says why a platform with no credit customer cannot be active', () => {
    expect(en.edit.activeBlocked).toMatch(/no credit customer cannot be active: its orders would be refused/i)
  })

  it('the add dialog says the previous row closes the day before, and rows are never edited', () => {
    expect(en.add.closesOn).toMatch(/the day before the new row starts/)
    expect(en.add.neverEdited).toMatch(/never edited: a correction is a new row/)
  })

  it('🚩 copy never says "chain", and "channel" only as the Deliverect channel id (CONTEXT.md, Deliverect)', () => {
    const words = JSON.stringify(en).toLowerCase()
    expect(words).not.toMatch(/\bchain\b/)
    expect(words.replace(/deliverect channel id/g, '')).not.toMatch(/\bchannel\b/)
  })
})
