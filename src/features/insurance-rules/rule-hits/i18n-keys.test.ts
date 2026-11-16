/**
 * BackOffice 3981 — the `insurance-rule-hits` namespace ships English and Arabic together: the Arabic mirrors the
 * English keys, an English plural (`_one` / `_other`) being all SIX Arabic forms, with the same `{{values}}` and
 * `<tags>` in each. Every key the page builds exists in both, and the area's menu names the leaf.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-rule-hits.json'
import ar from '@/locales/ar/insurance-rule-hits.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey, localeAt } from '@/core/test/locale'
import { RULE_HIT_OUTCOMES } from './api'
import { RULE_HIT_KINDS } from './query'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const base = (key: string, forms: string[]) => forms.reduce((k, f) => (k.endsWith(f) ? k.slice(0, -f.length) : k), key)
const marks = (s: string) => [...s.matchAll(/\{\{\w+\}\}|<\/?\w+>/g)].map((m) => m[0]).sort()

describe('insurance-rule-hits — en and ar mirror each other', () => {
  it('the same keys, English plurals two forms and Arabic six', () => {
    expect([...new Set(leaves(ar).map((k) => base(k, AR_PLURAL)))].sort()).toEqual([...new Set(leaves(en).map((k) => base(k, EN_PLURAL)))].sort())
    expect(leaves(en).filter((k) => k.startsWith('total'))).toEqual(EN_PLURAL.map((f) => `total${f}`))
    expect(leaves(ar).filter((k) => k.startsWith('total')).sort()).toEqual(AR_PLURAL.map((f) => `total${f}`).sort())
  })

  it('the same {{values}} and <tags> in each pair', () => {
    for (const key of leaves(en).filter((k) => !k.startsWith('total')))
      expect([key, marks(String(localeAt(ar, key)))]).toEqual([key, marks(String(localeAt(en, key)))])
    for (const key of leaves(ar).filter((k) => k.startsWith('total')))
      expect([key, marks(String(localeAt(ar, key)))]).toEqual([key, marks(String(localeAt(en, 'total_other')))])
  })
})

describe('insurance-rule-hits — the keys the page builds exist', () => {
  it.each([en, ar])('kinds, outcomes, checkpoints, window refusals', (locale) => {
    const keys = [
      ...RULE_HIT_KINDS.map((k) => `kind.${k}`),
      ...RULE_HIT_OUTCOMES.map((k) => `outcome.${k}`),
      ...['submit', 'dispense'].map((k) => `checkpoint.${k}`),
      ...['invalid', 'reversed', 'tooLong', 'outOfBounds'].map((k) => `window.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([areaEn, areaAr])('the menu leaf', (locale) => {
    expect(hasLocaleKey(locale, 'menu.ruleHits')).toBe(true)
  })
})
