/**
 * BackOffice ticket 3873 — the `held-stock-report` namespace ships English and Arabic together, and the Arabic file mirrors
 * the English keys exactly. An English plural (`_one` / `_other`) is all SIX Arabic forms. Every key the two screens build
 * from data (a tab, a tile, a kind, a column, a hint, a note, an empty line) exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/held-stock-report.json'
import ar from '@/locales/ar/held-stock-report.json'
import { REFUSAL_KINDS, REFUSAL_TABS, REFUSAL_TILES } from './refusals'
import { HELD_TABS, HELD_TILES } from './held'
import { REFUSAL_COLUMN_HINTS, REFUSAL_COLUMN_IDS } from './refusal-columns'
import { HELD_COLUMN_HINTS, HELD_COLUMN_IDS } from './held-columns'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

/** Every leaf key, dotted. */
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

describe('held-stock-report — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)

  it('the same non-plural keys', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
  })

  it('the same plural families, English with _one/_other and Arabic with all six', () => {
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })
})

describe('held-stock-report — the keys the code builds exist', () => {
  it.each([en, ar])('every tab, tile, kind, column, hint, note, empty line and access sentence', (locale) => {
    const keys = [
      ...REFUSAL_TABS.flatMap((tab) => [`refusals.tabs.${tab}`, `refusals.note.${tab}`, `refusals.empty.${tab}`]),
      ...REFUSAL_TILES.flatMap((tile) => [`refusals.tile.${tile}`, `refusals.tileHint.${tile}`]),
      ...REFUSAL_KINDS.map((k) => `kind.${k || 'any'}`),
      ...HELD_TABS.flatMap((tab) => [`held.tabs.${tab}`, `held.note.${tab}`, `held.empty.${tab}`]),
      ...HELD_TILES.flatMap((tile) => [`held.tile.${tile}`, `held.tileHint.${tile}`]),
      ...[...REFUSAL_COLUMN_IDS, ...HELD_COLUMN_IDS].map((c) => `column.${c}`),
      ...[...REFUSAL_COLUMN_HINTS, ...HELD_COLUMN_HINTS].map((c) => `columnHint.${c}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
      'menu.refusals',
      'menu.held',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
