/**
 * Ticket 848 — `hybris-stock-materials` ships English and Arabic together; the Arabic file mirrors
 * the English keys, and an English plural is all six Arabic forms. The keys the code builds exist.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-materials.json'
import ar from '@/locales/ar/hybris-stock-materials.json'
import { OUTCOMES, REFUSAL_KINDS } from './upload-preview'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']
const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
const strip = (keys: string[], forms: string[]) => [...new Set(keys.map((k) => forms.reduce((s, f) => (s.endsWith(f) ? s.slice(0, -f.length) : s), k)))].sort()
const has = (locale: unknown, key: string) => typeof key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], locale) === 'string'

describe('hybris-stock-materials — en and ar', () => {
  it('mirror each other, plurals aside', () => {
    expect(strip(leaves(ar), AR_PLURAL)).toEqual(strip(leaves(en), EN_PLURAL))
  })

  it('Arabic carries all six forms of every English plural', () => {
    for (const base of leaves(en).filter((k) => k.endsWith('_other')).map((k) => k.slice(0, -'_other'.length)))
      for (const f of AR_PLURAL) expect([base + f, has(ar, base + f)]).toEqual([base + f, true])
  })

  it.each([en, ar])('every outcome, refusal, change and verb key the dialogs build', (locale) => {
    const keys = [
      ...OUTCOMES.map((o) => `upload.outcome.${o}`),
      ...REFUSAL_KINDS.flatMap((k) => [`upload.refusal.${k}`, `upload.refusalTally.${k}`]),
      'upload.change.enable',
      'upload.change.disable',
      ...['enable', 'disable'].flatMap((v) => ['button', 'title', 'note', 'confirm', 'done', 'doneDetail'].map((k) => `${v}.${k}`)),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
