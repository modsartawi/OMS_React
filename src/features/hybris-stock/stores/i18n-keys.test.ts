/**
 * Ticket 847 — the `hybris-stock-stores` namespace ships English and Arabic together, the Arabic
 * file mirrors the English keys exactly, and an English plural (`_one` / `_other`) is all SIX Arabic
 * forms. The keys the code builds from a value exist in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-stores.json'
import ar from '@/locales/ar/hybris-stock-stores.json'
import { HEALTH_READINGS, UNHEALTHY_CAUSES } from './health'

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

const has = (locale: unknown, key: string) =>
  typeof key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) === 'string'

describe('hybris-stock-stores — en and ar mirror each other', () => {
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

describe('hybris-stock-stores — the keys the code builds exist', () => {
  it.each([en, ar])('the menu, every health reading and cause, mark and unmark', (locale) => {
    const keys = [
      ...['hybrisStock', 'stores', 'materials', 'pushes'].map((k) => `menu.${k}`),
      ...HEALTH_READINGS.map((r) => `health.${r}`),
      ...UNHEALTHY_CAUSES.flatMap((c) => [`health.cause.${c}`, `health.causeShort.${c}`]),
      ...['mark', 'unmark'].flatMap((v) => ['button', 'title', 'note', 'confirm', 'done', 'doneDetail'].map((k) => `${v}.${k}`)),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
      'reason.label',
      'reason.hint',
      'reason.tooLong',
      'dialog.cancel',
      'dialog.sending',
      'dialog.failed',
      'dialog.failedHint',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
