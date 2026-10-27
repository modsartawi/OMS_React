/**
 * Ticket 616 — the `insurance-order-guards` namespace ships English and Arabic together: the Arabic file
 * mirrors the English keys, an English plural (`_one` / `_other`) being all six Arabic forms; and every key
 * the code builds (states, problems, suggestions) exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-order-guards.json'
import ar from '@/locales/ar/insurance-order-guards.json'
import { ORDER_GUARD_STATES } from './guard-check'
import { PROBLEM_KEYS, SUGGESTION_KEYS } from './guard-words'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

function shape(keys: string[], forms: string[]) {
  const plain = new Set<string>()
  const plurals = new Map<string, Set<string>>()
  for (const key of keys) {
    const form = forms.find((f) => key.endsWith(f))
    if (!form) plain.add(key)
    else {
      const base = key.slice(0, -form.length)
      plurals.set(base, (plurals.get(base) ?? new Set()).add(form))
    }
  }
  return { plain, plurals }
}

const has = (locale: unknown, key: string): boolean =>
  typeof key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) === 'string'

describe('insurance-order-guards — en and ar mirror each other', () => {
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
  it('every key the code builds exists in both', () => {
    const built = [
      ...ORDER_GUARD_STATES.map((s) => `state.${s}`),
      ...ORDER_GUARD_STATES.filter((s) => s !== 'none').map((s) => `panel.hint.${s}`),
      ...Object.values(PROBLEM_KEYS),
      ...Object.values(SUGGESTION_KEYS),
    ]
    for (const key of built) expect([key, has(en, key), has(ar, key)]).toEqual([key, true, true])
  })
})
