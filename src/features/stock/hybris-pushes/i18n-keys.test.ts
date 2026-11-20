/**
 * Ticket 849 — `hybris-stock-pushes` ships English and Arabic together; the Arabic file mirrors the
 * English keys, and an English plural is all six Arabic forms. Every type, status and target key the
 * labels build exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-pushes.json'
import ar from '@/locales/ar/hybris-stock-pushes.json'
import { PUSH_STATUSES, PUSH_TYPES, statusLabel, targetLabel, typeLabel } from './push-labels'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']
const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
const strip = (keys: string[], forms: string[]) => [...new Set(keys.map((k) => forms.reduce((s, f) => (s.endsWith(f) ? s.slice(0, -f.length) : s), k)))].sort()
const has = (locale: unknown, key: string) => typeof key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], locale) === 'string'

describe('hybris-stock-pushes — en and ar', () => {
  it('mirror each other, plurals aside', () => {
    expect(strip(leaves(ar), AR_PLURAL)).toEqual(strip(leaves(en), EN_PLURAL))
  })

  it('Arabic carries all six forms of every English plural', () => {
    for (const base of leaves(en).filter((k) => k.endsWith('_other')).map((k) => k.slice(0, -'_other'.length)))
      for (const f of AR_PLURAL) expect([base + f, has(ar, base + f)]).toEqual([base + f, true])
  })

  it.each([en, ar])('every type, status and target label', (locale) => {
    const keys = [
      ...[...PUSH_TYPES, 'X'].map((x) => typeLabel(x)),
      ...[...PUSH_STATUSES, 'X'].map((x) => statusLabel(x).key),
      ...['shadow', 'live', 'X'].map((x) => targetLabel(x).key),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
