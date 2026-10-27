/**
 * Ticket 609 — the `insurance-templates` namespace ships English and Arabic together, the Arabic mirroring the
 * English keys (an English plural being all SIX Arabic forms); every key the gallery builds exists in both, and
 * every blank word (`insurance-rules:template.blank.*`) the label draws.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-templates.json'
import ar from '@/locales/ar/insurance-templates.json'
import rulesEn from '@/locales/en/insurance-rules.json'
import rulesAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { BLANK_WORDS } from '@/core/insurance-rules/templates'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const pluralBase = (key: string, forms: string[]) => forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null
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

describe('insurance-templates — en and ar mirror each other', () => {
  const e = shape(leaves(en), EN_PLURAL)
  const a = shape(leaves(ar), AR_PLURAL)
  it('the same non-plural keys', () => {
    expect([...a.plain].sort()).toEqual([...e.plain].sort())
  })
  it('the same plural families, English two forms and Arabic six', () => {
    expect([...a.plurals.keys()].sort()).toEqual([...e.plurals.keys()].sort())
    for (const [base, forms] of e.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
    for (const [base, forms] of a.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })
})

describe('the keys the templates screens build exist', () => {
  it.each([en, ar])('each source heading, hint and empty line', (locale) => {
    for (const s of ['phase1', 'team']) for (const k of ['', 'Hint', 'Empty']) expect([s + k, hasLocaleKey(locale, `source.${s}${k}`)]).toEqual([s + k, true])
  })
  it.each([rulesEn, rulesAr])('every blank word, and the menu leaf', (locale) => {
    for (const w of [...BLANK_WORDS, 'other']) expect([w, hasLocaleKey(locale, `template.blank.${w}`)]).toEqual([w, true])
    expect(hasLocaleKey(locale, 'menu.templates')).toBe(true)
  })
})
