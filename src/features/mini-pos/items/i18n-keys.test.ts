/**
 * oms 915 — `mini-pos-items` ships English and Arabic together, the Arabic mirroring the English keys exactly, and every
 * form problem the screen builds exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/mini-pos-items.json'
import ar from '@/locales/ar/mini-pos-items.json'
import { hasLocaleKey } from '@/core/test/locale'

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))

describe('mini-pos-items — en and ar', () => {
  it('mirror each other', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('hold every key the screen builds', (locale) => {
    const keys = [
      ...['required', 'tooLong'].map((p) => `category.problem.${p}`),
      ...['item', 'itemTooLong', 'reason', 'reasonTooLong'].map((p) => `refused.problem.${p}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
