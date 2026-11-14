/**
 * BackOffice ticket 3874 — the `expired-approval-picks` namespace ships English and Arabic together, and the Arabic file mirrors the
 * English keys exactly. An English plural (`_one` / `_other`) is all SIX Arabic forms. Every key the screen builds
 * from data (a tab, a tile, a group, a column) exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/expired-approval-picks.json'
import ar from '@/locales/ar/expired-approval-picks.json'
import { OUTCOMES, REPORT_TABS } from './filters'
import { COLUMN_IDS } from './columns'

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

describe('expired-approval-picks — en and ar mirror each other', () => {
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

describe('expired-approval-picks — the keys the code builds exist', () => {
  const TILES = ['picks', 'soldNotBilled', 'neverSold', 'units', 'stores', 'pharmacists']

  it.each([en, ar])('every tab, tile, group, column and access sentence', (locale) => {
    const keys = [
      ...REPORT_TABS.map((tab) => `tabs.${tab}`),
      ...TILES.flatMap((tile) => [`tile.${tile}`, `tileHint.${tile}`]),
      ...OUTCOMES.filter(Boolean).flatMap((o) => [`outcome.${o}`, `outcomeShort.${o}`]),
      ...COLUMN_IDS.map((c) => `column.${c}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
      'menu.expiredApprovalPicks',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
