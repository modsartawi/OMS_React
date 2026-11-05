/**
 * Ticket 789 — the delivery money strip's words ship in English and Arabic together:
 * `document:moneyStrip.*` mirrors key for key, and every figure the strip draws has words in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/document.json'
import ar from '@/locales/ar/document.json'
import { hasLocaleKey } from '@/core/test/locale'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('document:moneyStrip — en and ar mirror each other', () => {
  it('the same keys', () => {
    expect(leaves(ar.moneyStrip).sort()).toEqual(leaves(en.moneyStrip).sort())
  })

  it.each([en, ar])('every key the strip uses has words', (locale) => {
    const keys = ['heading', 'loadFailed', 'link', ...['patient', 'insurer', 'amountDue'].map((f) => `figures.${f}`)].map((k) => `moneyStrip.${k}`)
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
