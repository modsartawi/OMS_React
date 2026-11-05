/**
 * Ticket 787 — the Insurance section's words ship in English and Arabic together: `document:insurance.*`
 * mirrors key for key, and every key the model builds from data (a money source, a figure) has words in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/document.json'
import ar from '@/locales/ar/document.json'
import { hasLocaleKey } from '@/core/test/locale'
import { MONEY_FIGURES, moneySourceBadge } from './insurance-section'

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('document:insurance — en and ar mirror each other', () => {
  it('the same keys', () => {
    expect(leaves(ar.insurance).sort()).toEqual(leaves(en.insurance).sort())
  })
})

describe('document:insurance — the keys the model builds exist', () => {
  it.each([en, ar])('every money source, its meaning, and every figure', (locale) => {
    const keys = [
      ...['CHANNEL', 'ENGINE', 'SOMETHING_NEW'].flatMap((s) => [moneySourceBadge(s).labelKey, moneySourceBadge(s).meaningKey]),
      ...MONEY_FIGURES.map((f) => `insurance.money.figures.${f}`),
      ...['channel', 'current', 'engine'].map((c) => `insurance.money.columns.${c}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
