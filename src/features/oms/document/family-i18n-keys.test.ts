/**
 * Ticket 906 — the Family section's words ship in English and Arabic together: `document:family.*`
 * mirrors key for key, and every key the panel builds (the title, "You are here", each category's
 * name) has words in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/document.json'
import ar from '@/locales/ar/document.json'
import { hasLocaleKey } from '@/core/test/locale'
import { familyCategoryKey } from './family-tree'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('document:family — en and ar mirror each other', () => {
  it('the same keys', () => {
    expect(leaves(ar.family).sort()).toEqual(leaves(en.family).sort())
  })

  it.each([en, ar])('every key the panel uses has words', (locale) => {
    const categories = ['Q', 'O', 'X', 'D', 'T', 'R', 'E', 'B', 'C', 'V', 'Z'].map(familyCategoryKey)
    const keys = ['family.heading', 'family.youAreHere', 'family.ariaLabel', ...categories]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('an unlisted category reads as the unknown one, never a raw key', () => {
    expect(familyCategoryKey('Z')).toBe('family.categories.unknown')
    expect(familyCategoryKey(' O ')).toBe('family.categories.O')
  })
})
