/**
 * Ticket 786 — the `orders` namespace ships English and Arabic together, and the Arabic file mirrors
 * the English keys exactly (an English plural `_one` / `_other` is all six Arabic forms). Every key
 * the screen builds from data — a lens, a criterion, a money source, a category, a refusal — has
 * words in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/orders.json'
import ar from '@/locales/ar/orders.json'
import { hasLocaleKey } from '@/core/test/locale'
import { LENS_IDS } from './lenses'
import { DATE_PRESETS, MONEY_SOURCES, QUERY_FIELDS, QUERY_GROUPS, type SearchProblem } from './query-model'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

/** The keys with their plural suffixes folded: `query.pending_one` → `query.pending`. */
function folded(keys: string[], forms: string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const key of keys) {
    const form = forms.find((f) => key.endsWith(f))
    const base = form ? key.slice(0, -form.length) : key
    out.set(base, (out.get(base) ?? new Set()).add(form ?? ''))
  }
  return out
}

const PROBLEMS: SearchProblem[] = ['needsDate', 'rangeTooLong', 'rangeInvalid']

describe('orders — en and ar mirror each other', () => {
  const enKeys = folded(leaves(en), EN_PLURAL)
  const arKeys = folded(leaves(ar), AR_PLURAL)

  it('names the same keys', () => {
    expect([...arKeys.keys()].sort()).toEqual([...enKeys.keys()].sort())
  })

  it('gives every English plural all six Arabic forms', () => {
    for (const [base, forms] of enKeys) {
      if (forms.has('')) continue
      expect([...(arKeys.get(base) ?? [])].sort(), base).toEqual([...AR_PLURAL].sort())
    }
  })

  it('has words for every key built from data, in both', () => {
    const built = [
      ...LENS_IDS.flatMap((id) => [`lens.name.${id}`, `lens.show.${id}`]),
      ...QUERY_FIELDS.map((f) => `query.field.${f.id}`),
      ...QUERY_GROUPS.map((g) => `query.group.${g}`),
      ...DATE_PRESETS.map((p) => `query.date.${p}`),
      ...MONEY_SOURCES.map((m) => `moneySource.${m}`),
      'category.O',
      'category.X',
      ...PROBLEMS.map((p) => `search.refused.${p}`),
    ]
    for (const key of built) {
      expect(hasLocaleKey(en, key), `en ${key}`).toBe(true)
      expect(hasLocaleKey(ar, key), `ar ${key}`).toBe(true)
    }
  })
})
