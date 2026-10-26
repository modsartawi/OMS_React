/**
 * Ticket 555 — the `hungerstation-materials` namespace ships English and Arabic together, and the
 * Arabic file mirrors the English keys exactly. An English plural (`_one` / `_other`) is all SIX
 * Arabic forms — ticket 433 was reviewed SERIOUS for shipping two.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-materials.json'
import ar from '@/locales/ar/hungerstation-materials.json'
import { MATERIAL_STATES } from './materials-query'

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

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

describe('hungerstation-materials — en and ar mirror each other', () => {
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

describe('hungerstation-materials — the keys the code builds exist', () => {
  it.each([en, ar])('every state option, flag, problem kind and the five ScreenGate sentences', (locale) => {
    const keys = [
      ...MATERIAL_STATES.map((s) => `filters.state${cap(s)}`),
      'flag.disabled',
      'flag.deleted',
      'columns.disabled',
      'columns.deleted',
      'import.problems.material',
      'import.problems.mark',
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('the core answer dialog’s chrome (it reads `result.*` in this namespace)', (locale) => {
    for (const key of ['title', 'close', 'unknown', 'unknownHint', 'copy', 'copied', 'copiedDetail_other', 'copyFailed', 'noneUnknown'])
      expect([`result.${key}`, has(locale, `result.${key}`)]).toEqual([`result.${key}`, true])
  })

  it('every interpolated value sits in a slot or is isolated by the caller — never a bare `{{a}} / {{b}}`', () => {
    for (const locale of [en, ar]) {
      expect(locale.results.page).toMatch(/<range>\{\{range\}\}<\/range>/)
      expect(locale.import.problems.material).toMatch(/<line>\{\{line\}\}<\/line>.*<value>\{\{value\}\}<\/value>/)
      expect(locale.import.preview.header).toMatch(/<header>\{\{header\}\}<\/header>/)
    }
  })
})
